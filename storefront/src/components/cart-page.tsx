"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CART_UPDATED, readCart, writeCart } from "@/lib/cart";
import {
  defaultSettings,
  formatPrice,
  hasSupabaseConfig,
  type CartEntry,
  type Product,
  type StoreSettings,
} from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

type CustomerFields = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  note: string;
};

export function CartPage() {
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [fields, setFields] = useState<CustomerFields>({
    name: "", email: "", phone: "", address: "", city: "", note: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "bank_transfer">("cod");
  const [discountCode, setDiscountCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountMessage, setDiscountMessage] = useState("");
  const [error, setError] = useState("");
  const configured = hasSupabaseConfig();
  const [loading, setLoading] = useState(configured);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<{ order_number: number; total: number } | null>(null);

  useEffect(() => {
    const sync = () => setCart(readCart());
    queueMicrotask(sync);
    window.addEventListener(CART_UPDATED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_UPDATED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!configured) return;
    async function load() {
      const supabase = getSupabase();
      const [productsResult, settingsResult] = await Promise.all([
        cart.length
          ? supabase.from("products").select("*").in("id", cart.map((entry) => entry.productId)).eq("published", true)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("store_settings").select("*").eq("id", true).maybeSingle(),
      ]);
      if (productsResult.error || settingsResult.error) {
        setError(productsResult.error?.message ?? settingsResult.error?.message ?? "Could not load your cart.");
      } else {
        setProducts((productsResult.data ?? []) as Product[]);
        if (settingsResult.data) setSettings(settingsResult.data as StoreSettings);
      }
      setLoading(false);
    }
    void load().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not load your cart.");
      setLoading(false);
    });
  }, [cart, configured]);

  const rows = useMemo(
    () => cart.flatMap((entry) => {
      const product = products.find((item) => item.id === entry.productId);
      return product ? [{ product, quantity: entry.quantity }] : [];
    }),
    [cart, products],
  );
  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
  const total = Math.max(subtotal - discount, 0);

  function updateQuantity(productId: string, value: number) {
    const quantity = Math.max(0, Math.min(99, value));
    const next = cart
      .map((entry) => entry.productId === productId ? { ...entry, quantity } : entry)
      .filter((entry) => entry.quantity > 0);
    writeCart(next);
  }

  async function applyDiscount() {
    setDiscountMessage("");
    setDiscount(0);
    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountCode, subtotal }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Discount code could not be applied.");
      setDiscount(result.discount);
      setDiscountCode(result.code);
      setDiscountMessage(`Discount applied: ${formatPrice(result.discount, settings.currency)}`);
    } catch (cause) {
      setDiscountMessage(cause instanceof Error ? cause.message : "Discount code could not be applied.");
    }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data: sessionData, error: sessionError } = await getSupabase().auth.getSession();
      if (sessionError) throw new Error(`Could not verify your account session: ${sessionError.message}`);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionData.session?.access_token) {
        headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      }
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer: fields,
          items: cart,
          discountCode,
          paymentMethod,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your order could not be created.");
      setOrder(result.order);
      writeCart([]);
      setDiscount(0);
      setDiscountCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your order could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  if (order) {
    return (
      <main className="content-page">
        <section className="empty-state">
          <p className="eyebrow">Order received</p>
          <h1 className="page-title">Thank you for your order.</h1>
          <p>Your order number is <strong>#{order.order_number}</strong>.</p>
          <p>Total: <strong>{formatPrice(order.total, settings.currency)}</strong></p>
          <p>We’ll contact you to confirm delivery and payment.</p>
          {paymentMethod === "bank_transfer" && (
            <p>{settings.bank_transfer_instructions || "Please contact the store for bank transfer details before sending payment."}</p>
          )}
          <Link className="button button-primary" href="/">Continue shopping</Link>
        </section>
      </main>
    );
  }

  if (loading) return <main className="content-page">Loading your bag…</main>;

  return (
    <main className="content-page">
      <p className="breadcrumb"><Link href="/">Home</Link> / Your bag</p>
      <h1 className="page-title">Your bag</h1>
      {!hasSupabaseConfig() && <div className="setup-banner">Connect Supabase before checkout.</div>}
      {error && <div className="error-banner">{error}</div>}
      {!cart.length ? (
        <div className="empty-state">
          <h3>Your bag is waiting for something lovely.</h3>
          <Link className="text-link" href="/">Continue shopping</Link>
        </div>
      ) : !rows.length ? (
        <div className="empty-state">
          <h3>These products are no longer available.</h3>
          <button className="plain-button" type="button" onClick={() => writeCart([])}>Clear bag</button>
        </div>
      ) : (
        <div className="cart-layout">
          <section>
            <div className="admin-table-wrap">
              <table className="cart-table">
                <thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Total</th><th /></tr></thead>
                <tbody>
                  {rows.map(({ product, quantity }) => (
                    <tr key={product.id}>
                      <td>
                        <span className="cart-item-title">
                          <span className="cart-thumb" style={product.image_url ? { backgroundImage: `url("${product.image_url}")` } : undefined} />
                          <Link href={`/products/${product.slug}`}>{product.title}</Link>
                        </span>
                      </td>
                      <td>{formatPrice(product.price, settings.currency)}</td>
                      <td>
                        <input
                          className="quantity-control"
                          aria-label={`Quantity for ${product.title}`}
                          type="number"
                          min="0"
                          max={Math.min(99, product.stock)}
                          value={quantity}
                          onChange={(event) => updateQuantity(product.id, Number(event.target.value))}
                        />
                      </td>
                      <td>{formatPrice(product.price * quantity, settings.currency)}</td>
                      <td><button className="remove-button" type="button" onClick={() => updateQuantity(product.id, 0)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form className="checkout-form" onSubmit={placeOrder} style={{ marginTop: 30 }}>
              <h2 className="page-title" style={{ fontSize: 30 }}>Delivery details</h2>
              <div className="form-grid">
                <label>Full name<input required maxLength={120} value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} /></label>
                <label>Phone number<input required maxLength={30} autoComplete="tel" value={fields.phone} onChange={(event) => setFields({ ...fields, phone: event.target.value })} /></label>
                <label>Email (optional)<input type="email" maxLength={254} autoComplete="email" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} /></label>
                <label>City<input required maxLength={100} autoComplete="address-level2" value={fields.city} onChange={(event) => setFields({ ...fields, city: event.target.value })} /></label>
              </div>
              <label>Delivery address<textarea required minLength={8} maxLength={350} autoComplete="street-address" value={fields.address} onChange={(event) => setFields({ ...fields, address: event.target.value })} /></label>
              <label>Order note (optional)<textarea maxLength={500} value={fields.note} onChange={(event) => setFields({ ...fields, note: event.target.value })} /></label>
              <label>Payment method
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cod" | "bank_transfer")}>
                  <option value="cod">Cash on Delivery</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </label>
              <button className="button button-primary" type="submit" disabled={submitting || !hasSupabaseConfig()}>
                {submitting ? "Placing order…" : "Place order"}
              </button>
            </form>
          </section>
          <aside className="cart-summary">
            <h2>Order summary</h2>
            <div className="summary-row"><span>Subtotal</span><span>{formatPrice(subtotal, settings.currency)}</span></div>
            {discount > 0 && <div className="summary-row"><span>Discount</span><span>-{formatPrice(discount, settings.currency)}</span></div>}
            <div className="discount-row">
              <input aria-label="Discount code" placeholder="Discount code" value={discountCode} onChange={(event) => { setDiscountCode(event.target.value); setDiscount(0); setDiscountMessage(""); }} />
              <button className="plain-button" type="button" onClick={applyDiscount} disabled={!discountCode.trim()}>Apply</button>
            </div>
            {discountMessage && <p className="discount-message">{discountMessage}</p>}
            <div className="summary-row summary-total"><span>Total</span><span>{formatPrice(total, settings.currency)}</span></div>
            <p className="stock-note">{settings.delivery_note}</p>
          </aside>
        </div>
      )}
    </main>
  );
}
