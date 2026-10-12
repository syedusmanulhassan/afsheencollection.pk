"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { addToCart } from "@/lib/cart";
import {
  defaultSettings,
  hasSupabaseConfig,
  type Collection,
  type Product,
  type StoreSettings,
} from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { ProductCard } from "@/components/product-card";

export function Storefront() {
  const configured = hasSupabaseConfig();
  const [settings, setSettings] = useState(defaultSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured) return;

    async function loadStore() {
      const supabase = getSupabase();
      const [settingsResult, productsResult, collectionsResult] =
        await Promise.all([
          supabase.from("store_settings").select("*").eq("id", true).maybeSingle(),
          supabase
            .from("products")
            .select("*")
            .eq("published", true)
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("collections")
            .select("*")
            .eq("published", true)
            .order("title"),
        ]);

      const failure =
        settingsResult.error ?? productsResult.error ?? collectionsResult.error;
      if (failure) {
        setError(failure.message);
      } else {
        if (settingsResult.data)
          setSettings(settingsResult.data as StoreSettings);
        setProducts((productsResult.data ?? []) as Product[]);
        setCollections((collectionsResult.data ?? []) as Collection[]);
      }
      setLoading(false);
    }

    void loadStore().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Unable to load store data.");
      setLoading(false);
    });
  }, [configured]);

  const brandStyle = {
    "--brand": settings.primary_color,
    "--accent": settings.accent_color,
  } as CSSProperties;

  return (
    <main style={brandStyle}>
      {!configured && (
        <div className="setup-banner">
          Store database is not connected yet. Add the Supabase values from
          <code> .env.example</code> to enable the catalog and CMS.
        </div>
      )}
      {error && <div className="error-banner">Store data could not load: {error}</div>}

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{settings.store_name}</p>
          <h1>{settings.hero_title}</h1>
          <p className="hero-description">{settings.hero_text}</p>
          <a className="button button-primary" href="#products">
            Explore the collection <span aria-hidden="true">↗</span>
          </a>
          <p className="hero-caption">{settings.delivery_note}</p>
        </div>
        <div
          className={`hero-art${settings.hero_image_url ? " has-image" : ""}`}
          role={settings.hero_image_url ? "img" : undefined}
          aria-label={settings.hero_image_url ? "Store collection" : undefined}
          style={
            settings.hero_image_url
              ? { backgroundImage: `url("${settings.hero_image_url}")` }
              : undefined
          }
        >
          {!settings.hero_image_url && (
            <div className="hero-art-note">
              <span>CURATED FOR YOU</span>
              <strong>Everyday finds.<br />Made to feel special.</strong>
              <i aria-hidden="true">✳</i>
            </div>
          )}
        </div>
      </section>

      {collections.length > 0 && (
        <section className="section-block" id="collections">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Browse by edit</p>
              <h2>Collections</h2>
            </div>
          </div>
          <div className="collection-grid">
            {collections.map((collection) => (
              <Link
                className="collection-card"
                href={`/collections/${collection.slug}`}
                key={collection.id}
              >
                <div
                  className={`collection-image${collection.image_url ? " has-image" : ""}`}
                  style={
                    collection.image_url
                      ? { backgroundImage: `url("${collection.image_url}")` }
                      : undefined
                  }
                  role={collection.image_url ? "img" : undefined}
                  aria-label={collection.image_url ? collection.title : undefined}
                />
                <span>{collection.title}</span>
                <span className="arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section-block" id="products">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The good things</p>
            <h2>Latest arrivals</h2>
          </div>
          <span className="muted">{products.length} products</span>
        </div>
        {loading ? (
          <p className="empty-state">Loading the collection…</p>
        ) : products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={settings.currency}
                onAdd={() => addToCart(product.id)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Your storefront is ready for its first products.</h3>
            <p>Add products and collections from the store CMS.</p>
            <Link className="text-link" href="/admin">Open the CMS <span aria-hidden="true">↗</span></Link>
          </div>
        )}
      </section>
      <footer className="site-footer">
        <span>{settings.store_name}</span>
        <p>{settings.tagline}</p>
        <span>{settings.contact_email}</span>
      </footer>
    </main>
  );
}
