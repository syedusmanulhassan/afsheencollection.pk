# Afsheen Collection store and CMS

This is an independently implemented Next.js storefront and admin CMS backed by
Supabase. It does not require Shopify. The licensed Uminex Liquid theme remains
outside this public repository and is not redistributed by this project.

## Included

- Public product and collection pages, product images, cart, discount codes, and
  mobile-friendly storefront content.
- Admin-managed products, collections, stock, images, discount codes, orders,
  payment status, and homepage/store settings at `/admin`.
- Cash on Delivery and manual bank transfer. Online card payments are not
  enabled; connect a supported payment provider before accepting online card
  payments.
- Database row-level security and server-side order validation. The browser
  never receives the Supabase service-role key.

## Local setup

1. Create a Supabase project and run
   `supabase/migrations/0001_store.sql` in its SQL Editor.
2. In Supabase Auth, create your administrator user and disable public sign-ups.
   In the SQL Editor, assign the admin role to that account:

   ```sql
   update auth.users
   set raw_app_meta_data =
     coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"store_admin"}'::jsonb
   where email = 'your-admin-email@example.com';
   ```

   Sign out and back in after changing the role so the new role is included in
   the session token.
3. Copy `.env.example` to `.env.local`, then set:
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable/anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role secret; server-side only
4. Run `npm install` and `npm run dev`. Open `http://localhost:3000` and
   `http://localhost:3000/admin`.

Do not commit `.env.local` or place the service-role key in any variable prefixed
with `NEXT_PUBLIC_`.

## Deploy to Vercel

1. Import `syedusmanulhassan/afsheencollection.pk` from GitHub into Vercel.
2. Set **Root Directory** to `storefront`.
3. Add all three environment variables from the local setup to the Vercel
   project settings, including the server-only service-role key.
4. Deploy. Add `afsheencollection.pk` in Vercel's domain settings and follow its
   DNS instructions at the domain registrar.
5. Sign in at `/admin`, add products and collections, set bank transfer
   instructions and contact information, then publish the products.

The Supabase migration must be applied before deployment can load store data or
accept orders. GitHub Pages alone cannot run the database-backed CMS or checkout.
