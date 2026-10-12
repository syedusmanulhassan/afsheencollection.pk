import type { CartEntry } from "@/lib/store";

const CART_KEY = "afsheen-cart";
export const CART_UPDATED = "afsheen-cart-updated";

export function readCart(): CartEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is CartEntry =>
        typeof entry?.productId === "string" &&
        Number.isInteger(entry?.quantity) &&
        entry.quantity > 0 &&
        entry.quantity <= 99,
    );
  } catch {
    return [];
  }
}

export function writeCart(cart: CartEntry[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(CART_UPDATED));
}

export function addToCart(productId: string) {
  const cart = readCart();
  const existing = cart.find((entry) => entry.productId === productId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + 1, 99);
  } else {
    cart.push({ productId, quantity: 1 });
  }
  writeCart(cart);
}
