"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addToCart } from "@/lib/cart";
import { defaultSettings, hasSupabaseConfig, type Collection, type Product, type StoreSettings } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { ProductCard } from "@/components/product-card";

export function CollectionDetail({ slug }: { slug: string }) {
  const configured = hasSupabaseConfig();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;

    async function load() {
      const supabase = getSupabase();
      const collectionResult = await supabase
        .from("collections")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (collectionResult.error) throw new Error(collectionResult.error.message);
      if (!collectionResult.data) {
        setLoading(false);
        return;
      }

      const [membershipsResult, settingsResult] = await Promise.all([
        supabase
          .from("product_collections")
          .select("product_id")
          .eq("collection_id", collectionResult.data.id),
        supabase.from("store_settings").select("*").eq("id", true).maybeSingle(),
      ]);
      if (membershipsResult.error || settingsResult.error)
        throw new Error(membershipsResult.error?.message ?? settingsResult.error?.message);

      const productIds = (membershipsResult.data ?? []).map((membership) => membership.product_id);
      const productsResult = productIds.length
        ? await supabase.from("products").select("*").in("id", productIds).eq("published", true)
        : { data: [], error: null };
      if (productsResult.error) throw new Error(productsResult.error.message);
      setCollection(collectionResult.data as Collection);
      setProducts((productsResult.data ?? []) as Product[]);
      if (settingsResult.data) setSettings(settingsResult.data as StoreSettings);
      setLoading(false);
    }

    void load().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Unable to load this collection.");
      setLoading(false);
    });
  }, [configured, slug]);

  if (loading) return <main className="content-page">Loading collection…</main>;
  if (!configured) return <main className="content-page"><div className="setup-banner">Connect Supabase to load collections.</div></main>;
  if (error) return <main className="content-page"><div className="error-banner">{error}</div></main>;
  if (!collection) {
    return (
      <main className="content-page not-found">
        <h1>Collection not found</h1>
        <Link className="text-link" href="/">Back to the store</Link>
      </main>
    );
  }

  return (
    <main className="content-page">
      <p className="breadcrumb"><Link href="/">Home</Link> / {collection.title}</p>
      <section className="section-heading">
        <div><p className="eyebrow">Browse the edit</p><h1 className="page-title">{collection.title}</h1></div>
      </section>
      {collection.description && <p className="detail-description">{collection.description}</p>}
      {products.length ? (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} currency={settings.currency} onAdd={() => addToCart(product.id)} />
          ))}
        </div>
      ) : (
        <div className="empty-state"><h3>No published products in this collection yet.</h3></div>
      )}
    </main>
  );
}
