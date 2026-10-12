"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_UPDATED, readCart } from "@/lib/cart";
import { defaultSettings, hasSupabaseConfig, type StoreSettings } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

export function StoreHeader() {
  const [settings, setSettings] = useState(defaultSettings);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const syncCart = () =>
      setCartCount(readCart().reduce((sum, entry) => sum + entry.quantity, 0));
    syncCart();
    window.addEventListener(CART_UPDATED, syncCart);
    window.addEventListener("storage", syncCart);

    if (hasSupabaseConfig()) {
      void getSupabase()
        .from("store_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error("Could not load store branding:", error.message);
          else if (data) setSettings(data as StoreSettings);
        });
    }

    return () => {
      window.removeEventListener(CART_UPDATED, syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  return (
    <>
      <div className="announcement-bar">{settings.announcement_text}</div>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label={`${settings.store_name} home`}>
          {settings.logo_url ? (
            <span
              className="wordmark-image"
              role="img"
              aria-label={settings.store_name}
              style={{ backgroundImage: `url("${settings.logo_url}")` }}
            />
          ) : (
            settings.store_name
          )}
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/">Shop</Link>
          <Link href="/#collections">Collections</Link>
          <Link href="/blog">Journal</Link>
          <Link href="/account">Account</Link>
        </nav>
        <Link className="cart-link" href="/cart">
          Bag <span className="cart-count">{cartCount}</span>
        </Link>
        <Link className="admin-link" href="/admin">Manage store</Link>
      </header>
    </>
  );
}
