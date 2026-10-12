export type StoreSettings = {
  store_name: string;
  logo_url: string | null;
  tagline: string;
  announcement_text: string;
  hero_title: string;
  hero_text: string;
  hero_image_url: string | null;
  primary_color: string;
  accent_color: string;
  currency: string;
  delivery_note: string;
  bank_transfer_instructions: string;
  contact_email: string;
  contact_phone: string;
};

export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  stock: number;
  image_url: string | null;
  published: boolean;
};

export type Collection = {
  id: string;
  title: string;
  slug: string;
  description: string;
  image_url: string | null;
  published: boolean;
};

export type DiscountCode = {
  id: string;
  code: string;
  kind: "percentage" | "fixed";
  amount: number;
  minimum_order: number;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

export type StoreOrder = {
  id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  city: string;
  total: number;
  status: string;
  payment_method: "cod" | "bank_transfer";
  payment_status: string;
  created_at: string;
  items?: { title: string; quantity: number; unit_price: number }[];
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author_name: string;
  image_url: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

export type CartEntry = { productId: string; quantity: number };

export const defaultSettings: StoreSettings = {
  store_name: "Afsheen Collection",
  logo_url: null,
  tagline: "A little something for every day.",
  announcement_text: "Thoughtful finds, delivered across Pakistan",
  hero_title: "Find something you’ll love.",
  hero_text: "Explore our latest arrivals and customer favourites.",
  hero_image_url: null,
  primary_color: "#183e35",
  accent_color: "#d7a85d",
  currency: "PKR",
  delivery_note: "Delivery charges are confirmed when your order is placed.",
  bank_transfer_instructions: "",
  contact_email: "",
  contact_phone: "",
};

export function formatPrice(amount: number, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
