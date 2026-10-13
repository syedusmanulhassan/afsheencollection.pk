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
          <p className="eyebrow">A considered edit from {settings.store_name}</p>
          <h1>{settings.hero_title}</h1>
          <p className="hero-description">{settings.hero_text}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#products">
              Shop the collection <span aria-hidden="true">↗</span>
            </a>
            <a className="hero-secondary-link" href="#collections">
              Browse our edits
            </a>
          </div>
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
              <span>THE AFSHEEN EDIT</span>
              <strong>Little details.<br />A lovely difference.</strong>
              <i aria-hidden="true">A</i>
              <small>Thoughtfully chosen for you</small>
            </div>
          )}
          {settings.hero_image_url && (
            <span className="hero-image-caption">{settings.store_name}</span>
          )}
        </div>
      </section>

      <section className="service-strip" aria-label="Shopping details">
        <div>
          <span className="service-icon" aria-hidden="true">01</span>
          <span><strong>Made for everyday</strong><small>Thoughtful finds, picked with care</small></span>
        </div>
        <div>
          <span className="service-icon" aria-hidden="true">02</span>
          <span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span>
        </div>
        <div>
          <span className="service-icon" aria-hidden="true">03</span>
          <span><strong>Across Pakistan</strong><small>{settings.delivery_note}</small></span>
        </div>
      </section>

      {collections.length > 0 && (
        <section className="section-block" id="collections">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Find your kind of lovely</p>
              <h2>Shop by collection</h2>
            </div>
            <span className="muted">Thoughtfully gathered, just for you</span>
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
                <span className="collection-card-copy">
                  <strong>{collection.title}</strong>
                  {collection.description && <small>{collection.description}</small>}
                </span>
                <span className="arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section-block" id="products">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A fresh little something</p>
            <h2>New and noteworthy</h2>
          </div>
          {products.length > 0 && (
            <span className="muted">{products.length} thoughtful finds</span>
          )}
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
          <div className="catalog-empty">
            <div className="catalog-empty-mark" aria-hidden="true">A</div>
            <div>
              <p className="eyebrow">The first edit is yours</p>
              <h3>Something lovely is on its way.</h3>
              <p>We’re getting the shelves ready. Check back soon for our first collection.</p>
            </div>
          </div>
        )}
      </section>

      <section className="editorial-banner">
        <div>
          <p className="eyebrow">A little more about us</p>
          <h2>Good things, chosen with you in mind.</h2>
          <p>{settings.tagline}</p>
          <Link className="button button-outline" href="/blog">
            Visit our journal <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="editorial-monogram" aria-hidden="true">
          <span>A</span>
          <i>AFSHEEN COLLECTION</i>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <Link className="footer-wordmark" href="/">{settings.store_name}</Link>
          <p>{settings.tagline}</p>
        </div>
        <nav className="footer-links" aria-label="Explore">
          <strong>Explore</strong>
          <Link href="/">Shop all</Link>
          <Link href="/#collections">Collections</Link>
          <Link href="/blog">Journal</Link>
        </nav>
        <nav className="footer-links" aria-label="Your account">
          <strong>Your account</strong>
          <Link href="/account">My account</Link>
          <Link href="/cart">Shopping bag</Link>
        </nav>
        {(settings.contact_email || settings.contact_phone) && (
          <div className="footer-contact">
            <strong>We’re here to help</strong>
            {settings.contact_email && <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>}
            {settings.contact_phone && <a href={`tel:${settings.contact_phone}`}>{settings.contact_phone}</a>}
          </div>
        )}
        <div className="footer-bottom">
          <span>© {settings.store_name}</span>
          <span>Thoughtfully yours.</span>
        </div>
      </footer>
    </main>
  );
}
