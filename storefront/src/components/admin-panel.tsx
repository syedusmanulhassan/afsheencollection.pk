"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  defaultSettings,
  formatPrice,
  hasSupabaseConfig,
  slugify,
  type Collection,
  type DiscountCode,
  type Product,
  type StoreOrder,
  type StoreSettings,
} from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { BlogManager } from "@/components/blog-manager";

type Tab = "Products" | "Collections" | "Discounts" | "Orders" | "Blog" | "Store design";
type ProductForm = {
  id?: string;
  title: string;
  description: string;
  price: string;
  compare_at_price: string;
  sku: string;
  stock: string;
  image_url: string;
  published: boolean;
  collection_ids: string[];
};
type CollectionForm = {
  id?: string;
  title: string;
  description: string;
  image_url: string;
  published: boolean;
};
type DiscountForm = {
  id?: string;
  code: string;
  kind: "percentage" | "fixed";
  amount: string;
  minimum_order: string;
  usage_limit: string;
  used_count: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
};

const emptyProduct: ProductForm = {
  title: "", description: "", price: "", compare_at_price: "", sku: "",
  stock: "0", image_url: "", published: false, collection_ids: [],
};
const emptyCollection: CollectionForm = {
  title: "", description: "", image_url: "", published: false,
};
const emptyDiscount: DiscountForm = {
  code: "", kind: "percentage", amount: "", minimum_order: "0",
  usage_limit: "", used_count: 0, starts_at: "", ends_at: "", active: true,
};
const tabs: Tab[] = ["Products", "Collections", "Discounts", "Orders", "Blog", "Store design"];

function textValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

async function uploadImage(file: File) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Choose a JPG, PNG, WebP, or AVIF image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Images must be 5 MB or smaller.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["jpg", "jpeg", "png", "webp", "avif"].includes(extension)) {
    throw new Error("The image file name has an unsupported extension.");
  }
  const supabase = getSupabase();
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("store-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}

function ImageUpload({
  onUploaded,
  onError,
}: {
  onUploaded: (url: string) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      onUploaded(await uploadImage(file));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }
  return (
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif"
      aria-label="Upload image"
      disabled={uploading}
      onChange={handleChange}
    />
  );
}

export function AdminPanel() {
  const configured = hasSupabaseConfig();
  const [tab, setTab] = useState<Tab>("Products");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(configured);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberships, setMemberships] = useState<{ product_id: string; collection_id: string }[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [productForm, setProductForm] = useState<ProductForm | null>(null);
  const [collectionForm, setCollectionForm] = useState<CollectionForm | null>(null);
  const [discountForm, setDiscountForm] = useState<DiscountForm | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    if (!configured) return;
    void getSupabase().auth.getUser().then(({ data, error }) => {
      if (error) setFailure(error.message);
      setAuthenticated(data.user?.app_metadata.role === "store_admin");
      setCheckingSession(false);
    });
  }, [configured]);

  useEffect(() => {
    if (authenticated) void loadData();
  }, [authenticated]);

  async function loadData() {
    setLoading(true);
    setFailure("");
    const supabase = getSupabase();
    const [productResult, collectionResult, membershipResult, discountResult, orderResult, settingsResult] =
      await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("collections").select("*").order("title"),
        supabase.from("product_collections").select("product_id, collection_id"),
        supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("id, order_number, customer_name, phone, city, total, status, payment_method, payment_status, created_at, order_items(title, quantity, unit_price)").order("created_at", { ascending: false }),
        supabase.from("store_settings").select("*").eq("id", true).maybeSingle(),
      ]);
    const queryError =
      productResult.error ??
      collectionResult.error ??
      membershipResult.error ??
      discountResult.error ??
      orderResult.error ??
      settingsResult.error;
    if (queryError) {
      setFailure(`CMS data could not be loaded: ${queryError.message}`);
    } else {
      setProducts((productResult.data ?? []) as Product[]);
      setCollections((collectionResult.data ?? []) as Collection[]);
      setMemberships(membershipResult.data ?? []);
      setDiscounts((discountResult.data ?? []) as DiscountCode[]);
      setOrders((orderResult.data ?? []) as StoreOrder[]);
      if (settingsResult.data) setSettings(settingsResult.data as StoreSettings);
    }
    setLoading(false);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure("");
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      setFailure(error.message);
      return;
    }
    if (data.user?.app_metadata.role !== "store_admin") {
      await getSupabase().auth.signOut();
      setFailure("This account is not assigned store administrator access.");
      return;
    }
    setAuthenticated(true);
    setPassword("");
  }

  async function logout() {
    const { error } = await getSupabase().auth.signOut();
    if (error) setFailure(error.message);
    else setAuthenticated(false);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productForm) return;
    setFailure("");
    setNotice("");
    const title = productForm.title.trim();
    const slug = slugify(title);
    const price = Number(productForm.price);
    const stock = Number(productForm.stock);
    const compare = productForm.compare_at_price.trim() ? Number(productForm.compare_at_price) : null;
    if (!slug || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setFailure("Enter a product name, valid price, and non-negative whole-number stock.");
      return;
    }
    if (compare !== null && (!Number.isFinite(compare) || compare < price)) {
      setFailure("The compare-at price must be greater than or equal to the selling price.");
      return;
    }
    const supabase = getSupabase();
    const values = {
      title,
      slug,
      description: productForm.description.trim(),
      price,
      compare_at_price: compare,
      sku: productForm.sku.trim() || null,
      stock,
      image_url: productForm.image_url.trim() || null,
      published: productForm.published,
      updated_at: new Date().toISOString(),
    };
    const saved = productForm.id
      ? await supabase.from("products").update(values).eq("id", productForm.id).select("id").single()
      : await supabase.from("products").insert(values).select("id").single();
    if (saved.error) {
      setFailure(`Product could not be saved: ${saved.error.message}`);
      return;
    }
    const productId = saved.data.id;
    const cleared = await supabase.from("product_collections").delete().eq("product_id", productId);
    if (cleared.error) {
      setFailure(`Product saved, but its collections could not be updated: ${cleared.error.message}`);
      return;
    }
    if (productForm.collection_ids.length) {
      const joined = await supabase.from("product_collections").insert(
        productForm.collection_ids.map((collection_id) => ({ product_id: productId, collection_id })),
      );
      if (joined.error) {
        setFailure(`Product saved, but its collections could not be updated: ${joined.error.message}`);
        return;
      }
    }
    setNotice("Product saved.");
    setProductForm(null);
    await loadData();
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete “${product.title}”? This cannot be undone.`)) return;
    const { error } = await getSupabase().from("products").delete().eq("id", product.id);
    if (error) setFailure(`Product could not be deleted: ${error.message}`);
    else {
      setNotice("Product deleted.");
      await loadData();
    }
  }

  async function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!collectionForm) return;
    const title = collectionForm.title.trim();
    const slug = slugify(title);
    if (!slug) {
      setFailure("Enter a collection name.");
      return;
    }
    const values = {
      title,
      slug,
      description: collectionForm.description.trim(),
      image_url: collectionForm.image_url.trim() || null,
      published: collectionForm.published,
      updated_at: new Date().toISOString(),
    };
    const result = collectionForm.id
      ? await getSupabase().from("collections").update(values).eq("id", collectionForm.id)
      : await getSupabase().from("collections").insert(values);
    if (result.error) setFailure(`Collection could not be saved: ${result.error.message}`);
    else {
      setNotice("Collection saved.");
      setCollectionForm(null);
      await loadData();
    }
  }

  async function deleteCollection(collection: Collection) {
    if (!window.confirm(`Delete “${collection.title}”? Its product links will also be removed.`)) return;
    const { error } = await getSupabase().from("collections").delete().eq("id", collection.id);
    if (error) setFailure(`Collection could not be deleted: ${error.message}`);
    else {
      setNotice("Collection deleted.");
      await loadData();
    }
  }

  async function saveDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!discountForm) return;
    const amount = Number(discountForm.amount);
    const minimum = Number(discountForm.minimum_order || "0");
    const limit = discountForm.usage_limit.trim() ? Number(discountForm.usage_limit) : null;
    if (!discountForm.code.trim() || !Number.isFinite(amount) || amount <= 0 ||
      !Number.isFinite(minimum) || minimum < 0 ||
      (limit !== null && (!Number.isInteger(limit) || limit < discountForm.used_count))) {
      setFailure("Enter a valid discount code, amount, minimum order, and usage limit.");
      return;
    }
    if (discountForm.kind === "percentage" && amount > 100) {
      setFailure("Percentage discounts cannot exceed 100%.");
      return;
    }
    const values = {
      code: discountForm.code.trim().toUpperCase(),
      kind: discountForm.kind,
      amount,
      minimum_order: minimum,
      usage_limit: limit,
      used_count: discountForm.used_count,
      starts_at: discountForm.starts_at ? new Date(discountForm.starts_at).toISOString() : null,
      ends_at: discountForm.ends_at ? new Date(discountForm.ends_at).toISOString() : null,
      active: discountForm.active,
    };
    if (values.starts_at && values.ends_at && values.ends_at <= values.starts_at) {
      setFailure("The expiry time must be later than the start time.");
      return;
    }
    const result = discountForm.id
      ? await getSupabase().from("discount_codes").update(values).eq("id", discountForm.id)
      : await getSupabase().from("discount_codes").insert(values);
    if (result.error) setFailure(`Discount could not be saved: ${result.error.message}`);
    else {
      setNotice("Discount code saved.");
      setDiscountForm(null);
      await loadData();
    }
  }

  async function deleteDiscount(discount: DiscountCode) {
    if (!window.confirm(`Delete discount code ${discount.code}?`)) return;
    const { error } = await getSupabase().from("discount_codes").delete().eq("id", discount.id);
    if (error) setFailure(`Discount code could not be deleted: ${error.message}`);
    else {
      setNotice("Discount code deleted.");
      await loadData();
    }
  }

  async function updateOrder(id: string, field: "status" | "payment_status", value: string) {
    const current = orders.find((order) => order.id === id);
    if (!current) return;
    const nextStatus = field === "status" ? value : current.status;
    const nextPaymentStatus = field === "payment_status" ? value : current.payment_status;
    const { error } = await getSupabase().rpc("update_store_order", {
      p_order_id: id,
      p_status: nextStatus,
      p_payment_status: nextPaymentStatus,
    });
    if (error) setFailure(`Order could not be updated: ${error.message}`);
    else {
      setNotice("Order updated.");
      await loadData();
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const values = {
      store_name: textValue(form, "store_name"),
      logo_url: settings.logo_url,
      tagline: textValue(form, "tagline"),
      announcement_text: textValue(form, "announcement_text"),
      hero_title: textValue(form, "hero_title"),
      hero_text: textValue(form, "hero_text"),
      hero_image_url: settings.hero_image_url,
      primary_color: String(form.get("primary_color") ?? "#183e35"),
      accent_color: String(form.get("accent_color") ?? "#d7a85d"),
      currency: textValue(form, "currency").toUpperCase(),
      delivery_note: textValue(form, "delivery_note"),
      bank_transfer_instructions: textValue(form, "bank_transfer_instructions"),
      contact_email: textValue(form, "contact_email"),
      contact_phone: textValue(form, "contact_phone"),
      updated_at: new Date().toISOString(),
    };
    if (!values.store_name || !/^[A-Z]{3}$/.test(values.currency)) {
      setFailure("Enter a store name and a valid three-letter currency code.");
      return;
    }
    const { error } = await getSupabase().from("store_settings").upsert({ id: true, ...values });
    if (error) setFailure(`Store settings could not be saved: ${error.message}`);
    else {
      setSettings({ ...settings, ...values });
      setNotice("Store design and settings saved.");
    }
  }

  if (checkingSession) return <main className="admin-page">Checking access…</main>;
  if (!configured) {
    return <main className="admin-page"><div className="error-banner">Connect Supabase using the environment variables in <code>.env.example</code> to set up the CMS.</div></main>;
  }
  if (!authenticated) {
    return (
      <main className="admin-login">
        <p className="eyebrow">Store management</p>
        <h1>Sign in to your CMS</h1>
        <p>Use the administrator account configured in Supabase. Customer accounts cannot access store management.</p>
        {failure && <div className="notice error">{failure}</div>}
        <form className="checkout-form" onSubmit={login}>
          <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary" type="submit">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-topline">
        <div><p className="eyebrow">Afsheen Collection · store manager</p><h1>Your store</h1><p>Manage products, collections, promotions, orders and storefront content.</p></div>
        <div className="admin-actions"><Link className="plain-button" href="/">View store</Link><button type="button" onClick={logout}>Sign out</button></div>
      </div>
      {notice && <div className="notice">{notice}</div>}
      {failure && <div className="notice error">{failure}</div>}
      <div className="admin-layout">
        <nav className="admin-tabs" aria-label="CMS sections">
          {tabs.map((item) => <button className={tab === item ? "active" : ""} key={item} type="button" onClick={() => { setTab(item); setNotice(""); setFailure(""); }}>{item}</button>)}
        </nav>
        <section className="admin-content">
          {loading ? <p>Loading your store data…</p> : (
            <>
              {tab === "Products" && (
                <>
                  <div className="admin-section-heading"><h2>Products ({products.length})</h2><button className="button button-primary button-small" type="button" onClick={() => setProductForm({ ...emptyProduct })}>Add product</button></div>
                  {productForm && (
                    <div className="editor-panel">
                      <form className="editor-form" onSubmit={saveProduct}>
                        <label>Product name<input required maxLength={160} value={productForm.title} onChange={(event) => setProductForm({ ...productForm, title: event.target.value })} /></label>
                        <label>Price<input required min="0" step="0.01" type="number" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
                        <label>Compare-at price<input min="0" step="0.01" type="number" value={productForm.compare_at_price} onChange={(event) => setProductForm({ ...productForm, compare_at_price: event.target.value })} /></label>
                        <label>Stock<input required min="0" step="1" type="number" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label>
                        <label>SKU<input maxLength={80} value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} /></label>
                        <label className="wide">Description<textarea maxLength={5000} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
                        <label className="wide">Image URL<input type="url" value={productForm.image_url} onChange={(event) => setProductForm({ ...productForm, image_url: event.target.value })} placeholder="Paste an image URL or upload below" /><ImageUpload onUploaded={(url) => setProductForm({ ...productForm, image_url: url })} onError={setFailure} /></label>
                        <label>Collections<select multiple value={productForm.collection_ids} onChange={(event) => setProductForm({ ...productForm, collection_ids: Array.from(event.target.selectedOptions, (option) => option.value) })}>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label>
                        <label className="checkbox-field"><input type="checkbox" checked={productForm.published} onChange={(event) => setProductForm({ ...productForm, published: event.target.checked })} /> Published in storefront</label>
                        <div className="wide admin-actions"><button className="button button-primary button-small" type="submit">Save product</button><button type="button" onClick={() => setProductForm(null)}>Cancel</button></div>
                      </form>
                    </div>
                  )}
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead><tbody>
                    {products.map((product) => <tr key={product.id}><td>{product.title}</td><td>{formatPrice(product.price, settings.currency)}</td><td>{product.stock}</td><td><span className="status-pill">{product.published ? "Published" : "Draft"}</span></td><td><div className="admin-actions"><button type="button" onClick={() => setProductForm({ id: product.id, title: product.title, description: product.description, price: String(product.price), compare_at_price: product.compare_at_price === null ? "" : String(product.compare_at_price), sku: product.sku ?? "", stock: String(product.stock), image_url: product.image_url ?? "", published: product.published, collection_ids: memberships.filter((membership) => membership.product_id === product.id).map((membership) => membership.collection_id) })}>Edit</button><button className="danger-button" type="button" onClick={() => void deleteProduct(product)}>Delete</button></div></td></tr>)}
                    {!products.length && <tr><td colSpan={5}>No products yet. Add your first product above.</td></tr>}
                  </tbody></table></div>
                </>
              )}
              {tab === "Collections" && (
                <>
                  <div className="admin-section-heading"><h2>Collections ({collections.length})</h2><button className="button button-primary button-small" type="button" onClick={() => setCollectionForm({ ...emptyCollection })}>Add collection</button></div>
                  {collectionForm && <div className="editor-panel"><form className="editor-form" onSubmit={saveCollection}>
                    <label>Collection name<input required maxLength={120} value={collectionForm.title} onChange={(event) => setCollectionForm({ ...collectionForm, title: event.target.value })} /></label>
                    <label className="checkbox-field"><input type="checkbox" checked={collectionForm.published} onChange={(event) => setCollectionForm({ ...collectionForm, published: event.target.checked })} /> Published</label>
                    <label className="wide">Description<textarea maxLength={2000} value={collectionForm.description} onChange={(event) => setCollectionForm({ ...collectionForm, description: event.target.value })} /></label>
                    <label className="wide">Image URL<input type="url" value={collectionForm.image_url} onChange={(event) => setCollectionForm({ ...collectionForm, image_url: event.target.value })} /><ImageUpload onUploaded={(url) => setCollectionForm({ ...collectionForm, image_url: url })} onError={setFailure} /></label>
                    <div className="wide admin-actions"><button className="button button-primary button-small" type="submit">Save collection</button><button type="button" onClick={() => setCollectionForm(null)}>Cancel</button></div>
                  </form></div>}
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Collection</th><th>Products</th><th>Status</th><th /></tr></thead><tbody>
                    {collections.map((collection) => <tr key={collection.id}><td>{collection.title}</td><td>{memberships.filter((membership) => membership.collection_id === collection.id).length}</td><td><span className="status-pill">{collection.published ? "Published" : "Draft"}</span></td><td><div className="admin-actions"><button type="button" onClick={() => setCollectionForm({ id: collection.id, title: collection.title, description: collection.description, image_url: collection.image_url ?? "", published: collection.published })}>Edit</button><button className="danger-button" type="button" onClick={() => void deleteCollection(collection)}>Delete</button></div></td></tr>)}
                    {!collections.length && <tr><td colSpan={4}>No collections yet.</td></tr>}
                  </tbody></table></div>
                </>
              )}
              {tab === "Discounts" && (
                <>
                  <div className="admin-section-heading"><h2>Discount codes ({discounts.length})</h2><button className="button button-primary button-small" type="button" onClick={() => setDiscountForm({ ...emptyDiscount })}>Add discount</button></div>
                  {discountForm && <div className="editor-panel"><form className="editor-form" onSubmit={saveDiscount}>
                    <label>Code<input required maxLength={40} value={discountForm.code} onChange={(event) => setDiscountForm({ ...discountForm, code: event.target.value.toUpperCase() })} /></label>
                    <label>Discount type<select value={discountForm.kind} onChange={(event) => setDiscountForm({ ...discountForm, kind: event.target.value as "percentage" | "fixed" })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label>
                    <label>Amount<input required min="0.01" step="0.01" type="number" value={discountForm.amount} onChange={(event) => setDiscountForm({ ...discountForm, amount: event.target.value })} /></label>
                    <label>Minimum order<input min="0" step="0.01" type="number" value={discountForm.minimum_order} onChange={(event) => setDiscountForm({ ...discountForm, minimum_order: event.target.value })} /></label>
                    <label>Usage limit (blank = unlimited)<input min={discountForm.used_count} step="1" type="number" value={discountForm.usage_limit} onChange={(event) => setDiscountForm({ ...discountForm, usage_limit: event.target.value })} /></label>
                    <label>Starts at<input type="datetime-local" value={discountForm.starts_at} onChange={(event) => setDiscountForm({ ...discountForm, starts_at: event.target.value })} /></label>
                    <label>Expires at<input type="datetime-local" value={discountForm.ends_at} onChange={(event) => setDiscountForm({ ...discountForm, ends_at: event.target.value })} /></label>
                    <label className="checkbox-field"><input type="checkbox" checked={discountForm.active} onChange={(event) => setDiscountForm({ ...discountForm, active: event.target.checked })} /> Active</label>
                    <div className="wide admin-actions"><button className="button button-primary button-small" type="submit">Save discount</button><button type="button" onClick={() => setDiscountForm(null)}>Cancel</button></div>
                  </form></div>}
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Code</th><th>Offer</th><th>Uses</th><th>Expiry</th><th>Status</th><th /></tr></thead><tbody>
                    {discounts.map((discount) => <tr key={discount.id}><td>{discount.code}</td><td>{discount.kind === "percentage" ? `${discount.amount}%` : formatPrice(discount.amount, settings.currency)}</td><td>{discount.used_count}{discount.usage_limit === null ? "" : ` / ${discount.usage_limit}`}</td><td>{discount.ends_at ? new Date(discount.ends_at).toLocaleDateString() : "No expiry"}</td><td><span className="status-pill">{discount.active ? "Active" : "Inactive"}</span></td><td><div className="admin-actions"><button type="button" onClick={() => setDiscountForm({ id: discount.id, code: discount.code, kind: discount.kind, amount: String(discount.amount), minimum_order: String(discount.minimum_order), usage_limit: discount.usage_limit === null ? "" : String(discount.usage_limit), used_count: discount.used_count, starts_at: localDate(discount.starts_at), ends_at: localDate(discount.ends_at), active: discount.active })}>Edit</button><button className="danger-button" type="button" onClick={() => void deleteDiscount(discount)}>Delete</button></div></td></tr>)}
                    {!discounts.length && <tr><td colSpan={6}>No discount codes configured.</td></tr>}
                  </tbody></table></div>
                </>
              )}
              {tab === "Orders" && (
                <>
                  <div className="admin-section-heading"><h2>Orders ({orders.length})</h2><button className="plain-button" type="button" onClick={() => void loadData()}>Refresh</button></div>
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Order status</th><th>Payment status</th></tr></thead><tbody>
                    {orders.map((order) => <tr key={order.id}><td>#{order.order_number}<br /><span className="muted">{new Date(order.created_at).toLocaleDateString()}</span></td><td>{order.customer_name}<br /><span className="muted">{order.phone} · {order.city}</span><br /><span className="muted">{order.items?.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</span></td><td>{formatPrice(order.total, settings.currency)}</td><td>{order.payment_method === "cod" ? "Cash on Delivery" : "Bank transfer"}</td><td><select aria-label={`Order ${order.order_number} status`} value={order.status} onChange={(event) => void updateOrder(order.id, "status", event.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></td><td><select aria-label={`Order ${order.order_number} payment status`} value={order.payment_status} onChange={(event) => void updateOrder(order.id, "payment_status", event.target.value)}><option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option></select></td></tr>)}
                    {!orders.length && <tr><td colSpan={6}>No orders received yet.</td></tr>}
                  </tbody></table></div>
                </>
              )}
              {tab === "Blog" && <BlogManager />}
              {tab === "Store design" && (
                <>
                  <div className="admin-section-heading"><h2>Storefront content and settings</h2></div>
                  <div className="editor-panel"><form className="editor-form" onSubmit={saveSettings}>
                    <label>Store name<input name="store_name" required maxLength={100} defaultValue={settings.store_name} /></label>
                    <label>Currency code<input name="currency" required maxLength={3} defaultValue={settings.currency} /></label>
                    <label className="wide">Tagline<input name="tagline" maxLength={180} defaultValue={settings.tagline} /></label>
                    <label className="wide">Announcement bar<input name="announcement_text" maxLength={180} defaultValue={settings.announcement_text} /></label>
                    <label className="wide">Homepage heading<input name="hero_title" required maxLength={180} defaultValue={settings.hero_title} /></label>
                    <label className="wide">Homepage text<textarea name="hero_text" maxLength={800} defaultValue={settings.hero_text} /></label>
                    <label>Primary color<input name="primary_color" type="color" defaultValue={settings.primary_color} /></label>
                    <label>Accent color<input name="accent_color" type="color" defaultValue={settings.accent_color} /></label>
                    <label>Logo URL<input type="url" value={settings.logo_url ?? ""} onChange={(event) => setSettings({ ...settings, logo_url: event.target.value || null })} /><ImageUpload onUploaded={(url) => setSettings({ ...settings, logo_url: url })} onError={setFailure} /></label>
                    <label>Homepage image URL<input type="url" value={settings.hero_image_url ?? ""} onChange={(event) => setSettings({ ...settings, hero_image_url: event.target.value || null })} /><ImageUpload onUploaded={(url) => setSettings({ ...settings, hero_image_url: url })} onError={setFailure} /></label>
                    <label className="wide">Delivery information<textarea name="delivery_note" maxLength={400} defaultValue={settings.delivery_note} /></label>
                    <label className="wide">Bank transfer instructions<textarea name="bank_transfer_instructions" maxLength={1000} defaultValue={settings.bank_transfer_instructions} /></label>
                    <label>Contact email<input name="contact_email" type="email" maxLength={254} defaultValue={settings.contact_email} /></label>
                    <label>Contact phone<input name="contact_phone" maxLength={30} defaultValue={settings.contact_phone} /></label>
                    <div className="wide"><button className="button button-primary button-small" type="submit">Save store design</button></div>
                  </form></div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
