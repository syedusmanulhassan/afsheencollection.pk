"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addToCart } from "@/lib/cart";
import {
  defaultSettings,
  formatPrice,
  hasSupabaseConfig,
  type Product,
  type StoreSettings,
} from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

export function ProductDetail({ slug }: { slug: string }) {
  const configured = hasSupabaseConfig();
  const [product, setProduct] = useState<Product | null>(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;

    async function load() {
      const supabase = getSupabase();
      const [productResult, settingsResult] = await Promise.all([
        supabase.from("products").select("*").eq("slug", slug).eq("published", true).maybeSingle(),
        supabase.from("store_settings").select("*").eq("id", true).maybeSingle(),
      ]);
      if (productResult.error || settingsResult.error) {
        setError(productResult.error?.message ?? settingsResult.error?.message ?? "Unable to load product.");
      } else {
        setProduct((productResult.data as Product | null) ?? null);
        if (settingsResult.data) setSettings(settingsResult.data as StoreSettings);
      }
      setLoading(false);
    }

    void load().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Unable to load product.");
      setLoading(false);
    });
  }, [configured, slug]);

  if (loading) return <main className="content-page">Loading product…</main>;
  if (!configured) return <main className="content-page"><div className="setup-banner">Connect Supabase to load product data.</div></main>;
  if (error) return <main className="content-page"><div className="error-banner">{error}</div></main>;
  if (!product) {
    return (
      <main className="content-page not-found">
        <h1>Product not found</h1>
        <Link className="text-link" href="/">Back to the store</Link>
      </main>
    );
  }

  return (
    <main className="content-page">
      <p className="breadcrumb"><Link href="/">Home</Link> / {product.title}</p>
      <section className="product-detail">
        <div
          className="detail-image"
          role={product.image_url ? "img" : undefined}
          aria-label={product.image_url ? product.title : undefined}
          style={product.image_url ? { backgroundImage: `url("${product.image_url}")` } : undefined}
        >
          {!product.image_url && "Product image"}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{settings.store_name}</p>
          <h1>{product.title}</h1>
          <div className="product-prices">
            <strong>{formatPrice(product.price, settings.currency)}</strong>
            {product.compare_at_price !== null && product.compare_at_price > product.price && (
              <del>{formatPrice(product.compare_at_price, settings.currency)}</del>
            )}
          </div>
          <p className="detail-description">{product.description || "A thoughtful find, selected by Afsheen Collection."}</p>
          <p className="stock-note">
            {product.stock > 0 ? `${product.stock} available` : "Currently out of stock"}
          </p>
          <button
            className="button button-primary"
            type="button"
            disabled={product.stock < 1}
            onClick={() => addToCart(product.id)}
          >
            {product.stock > 0 ? "Add to bag" : "Sold out"}
          </button>
          <p className="stock-note">{settings.delivery_note}</p>
        </div>
      </section>
    </main>
  );
}
