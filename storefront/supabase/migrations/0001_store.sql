create extension if not exists pgcrypto;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= price),
  sku text unique,
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percentage', 'fixed')),
  amount numeric(12, 2) not null check (amount > 0),
  minimum_order numeric(12, 2) not null default 0 check (minimum_order >= 0),
  usage_limit integer check (usage_limit is null or usage_limit >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (kind <> 'percentage' or amount <= 100)
);

create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Afsheen Collection',
  logo_url text,
  tagline text not null default '',
  announcement_text text not null default 'Thoughtful finds, delivered across Pakistan',
  hero_title text not null default 'Discover your new favourites',
  hero_text text not null default 'Thoughtfully selected pieces, delivered to your door.',
  hero_image_url text,
  primary_color text not null default '#1f56d8',
  accent_color text not null default '#8b5cf6',
  currency text not null default 'PKR',
  delivery_note text not null default 'Delivery charges are confirmed when your order is placed.',
  bank_transfer_instructions text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null,
  email text not null default '',
  phone text not null,
  address text not null,
  city text not null,
  payment_method text not null check (payment_method in ('cod', 'bank_transfer')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'refunded')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null check (total >= 0),
  discount_code text,
  customer_note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  sku text,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0)
);

create index if not exists products_published_created_idx
  on public.products (published, created_at desc);
create index if not exists collections_published_title_idx
  on public.collections (published, title);
create index if not exists orders_created_idx
  on public.orders (created_at desc);

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'store_admin', false);
$$;

alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_collections enable row level security;
alter table public.discount_codes enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.collections, public.products, public.product_collections, public.store_settings
  to anon, authenticated;
grant insert, update, delete on public.collections, public.products,
  public.product_collections, public.discount_codes, public.store_settings
  to authenticated;
grant select on public.discount_codes, public.orders, public.order_items
  to authenticated;

create policy "Public can read published collections"
  on public.collections for select
  using (published or (select public.is_store_admin()));
create policy "Admins manage collections"
  on public.collections for all
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

create policy "Public can read published products"
  on public.products for select
  using (published or (select public.is_store_admin()));
create policy "Admins manage products"
  on public.products for all
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

create policy "Public can read published product memberships"
  on public.product_collections for select
  using (
    exists (
      select 1 from public.products p
      join public.collections c on c.id = product_collections.collection_id
      where p.id = product_collections.product_id and p.published and c.published
    )
    or (select public.is_store_admin())
  );
create policy "Admins manage product memberships"
  on public.product_collections for all
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

create policy "Admins manage discount codes"
  on public.discount_codes for all
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

create policy "Public can read store settings"
  on public.store_settings for select
  using (true);
create policy "Admins manage store settings"
  on public.store_settings for all
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

create policy "Admins read orders"
  on public.orders for select
  using ((select public.is_store_admin()));
create policy "Admins read order items"
  on public.order_items for select
  using ((select public.is_store_admin()));

insert into storage.buckets (id, name, public)
values ('store-media', 'store-media', true)
on conflict (id) do nothing;

create policy "Public can read store media"
  on storage.objects for select
  using (bucket_id = 'store-media');
create policy "Admins can upload store media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-media'
    and (select public.is_store_admin())
  );
create policy "Admins can update store media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'store-media'
    and (select public.is_store_admin())
  )
  with check (
    bucket_id = 'store-media'
    and (select public.is_store_admin())
  );
create policy "Admins can delete store media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-media'
    and (select public.is_store_admin())
  );

create or replace function public.place_store_order(
  p_customer jsonb,
  p_items jsonb,
  p_discount_code text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  product_row public.products%rowtype;
  discount_row public.discount_codes%rowtype;
  new_order public.orders%rowtype;
  subtotal_amount numeric(12, 2) := 0;
  discount_amount numeric(12, 2) := 0;
  final_total numeric(12, 2);
  normalized_code text := nullif(upper(trim(p_discount_code)), '');
begin
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid order items';
  end if;

  if p_payment_method not in ('cod', 'bank_transfer') then
    raise exception 'Unsupported payment method';
  end if;

  for item in
    select (entry.value ->> 'product_id')::uuid as product_id,
           sum((entry.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as entry(value)
    group by (entry.value ->> 'product_id')::uuid
  loop
    if item.quantity < 1 or item.quantity > 99 then
      raise exception 'Invalid item quantity';
    end if;

    select * into product_row
    from public.products
    where id = item.product_id and published
    for update;

    if not found or product_row.stock < item.quantity then
      raise exception 'An item is unavailable or out of stock';
    end if;

    subtotal_amount := subtotal_amount + product_row.price * item.quantity;
  end loop;

  if normalized_code is not null then
    select * into discount_row
    from public.discount_codes
    where code = normalized_code and active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and (usage_limit is null or used_count < usage_limit)
    for update;

    if not found or subtotal_amount < discount_row.minimum_order then
      raise exception 'Discount code is invalid or does not apply';
    end if;

    if discount_row.kind = 'percentage' then
      discount_amount := round(subtotal_amount * discount_row.amount / 100, 2);
    else
      discount_amount := least(subtotal_amount, discount_row.amount);
    end if;
  end if;

  final_total := subtotal_amount - discount_amount;

  insert into public.orders (
    customer_name, email, phone, address, city, payment_method,
    subtotal, discount, total, discount_code, customer_note
  )
  values (
    trim(p_customer ->> 'name'),
    coalesce(trim(p_customer ->> 'email'), ''),
    trim(p_customer ->> 'phone'),
    trim(p_customer ->> 'address'),
    trim(p_customer ->> 'city'),
    p_payment_method,
    subtotal_amount,
    discount_amount,
    final_total,
    normalized_code,
    coalesce(trim(p_customer ->> 'note'), '')
  )
  returning * into new_order;

  for item in
    select (entry.value ->> 'product_id')::uuid as product_id,
           sum((entry.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as entry(value)
    group by (entry.value ->> 'product_id')::uuid
  loop
    update public.products
    set stock = stock - item.quantity, updated_at = now()
    where id = item.product_id and published and stock >= item.quantity
    returning * into product_row;

    if not found then
      raise exception 'An item is unavailable or out of stock';
    end if;

    insert into public.order_items (order_id, product_id, title, sku, unit_price, quantity)
    values (
      new_order.id, product_row.id, product_row.title, product_row.sku,
      product_row.price, item.quantity
    );
  end loop;

  if normalized_code is not null then
    update public.discount_codes
    set used_count = used_count + 1
    where id = discount_row.id;
  end if;

  return jsonb_build_object(
    'id', new_order.id,
    'order_number', new_order.order_number,
    'total', new_order.total
  );
end;
$$;

revoke all on function public.place_store_order(jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.place_store_order(jsonb, jsonb, text, text)
  to service_role;

create or replace function public.update_store_order(
  p_order_id uuid,
  p_status text,
  p_payment_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  item record;
  product_row public.products%rowtype;
begin
  if not public.is_store_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_status not in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
     or p_payment_status not in ('pending', 'paid', 'refunded') then
    raise exception 'Invalid order status';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if p_status = 'cancelled' and order_row.status <> 'cancelled' then
    for item in
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id and product_id is not null
    loop
      update public.products
      set stock = stock + item.quantity, updated_at = now()
      where id = item.product_id;
    end loop;
  elsif p_status <> 'cancelled' and order_row.status = 'cancelled' then
    for item in
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id
    loop
      if item.product_id is null then
        raise exception 'A product from this order was deleted';
      end if;
      update public.products
      set stock = stock - item.quantity, updated_at = now()
      where id = item.product_id and stock >= item.quantity
      returning * into product_row;
      if not found then
        raise exception 'There is not enough stock to reopen this order';
      end if;
    end loop;
  end if;

  update public.orders
  set status = p_status, payment_status = p_payment_status
  where id = p_order_id;
end;
$$;

revoke all on function public.update_store_order(uuid, text, text)
  from public, anon;
grant execute on function public.update_store_order(uuid, text, text)
  to authenticated;
