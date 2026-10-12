create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  phone text not null check (char_length(phone) between 7 and 25),
  delivery_address text not null check (char_length(delivery_address) between 5 and 500),
  items jsonb not null check (
    jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) between 1 and 20
  ),
  status text not null default 'new' check (status in ('new', 'contacted', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create table if not exists public.categories (
  name text primary key check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 160),
  icon text not null default '✳' check (char_length(icon) <= 8),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 60),
  name text not null check (char_length(name) between 2 and 120),
  category text not null references public.categories(name) on update cascade on delete restrict,
  detail text not null default '' check (char_length(detail) <= 240),
  price integer not null check (price between 0 and 100000000),
  old_price integer check (old_price is null or old_price between 0 and 100000000),
  tag text not null default '' check (char_length(tag) <= 30),
  art text not null default 'vitamin' check (art in ('vitamin', 'vitaminc', 'cleanser', 'firstaid', 'omega', 'device', 'medicine')),
  color text not null default 'lavender' check (color in ('lavender', 'peach', 'mint', 'blue')),
  image_url text,
  stock integer not null default 0 check (stock between 0 and 1000000),
  is_active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;

insert into public.categories (name, description, icon, sort_order)
values
  ('Medicines', 'Everyday essentials', '✚', 0),
  ('Vitamins & supplements', 'Feel good, every day', '✳', 1),
  ('Personal care', 'Care from head to toe', '❋', 2),
  ('First aid', 'Be ready for anything', '♡', 3),
  ('Health devices', 'Wellness at home', '⌁', 4)
on conflict (name) do nothing;

insert into public.products (id, name, category, detail, price, old_price, tag, art, color, stock, featured)
values
  ('daily-vitamins', 'Daily Essentials Multivitamin', 'Vitamins & supplements', '30 tablets · everyday wellness', 8500, 10000, 'BESTSELLER', 'vitamin', 'lavender', 20, true),
  ('vitamin-c', 'Vitamin C + Zinc', 'Vitamins & supplements', 'Effervescent · 20 tablets', 6200, null, 'IMMUNITY', 'vitaminc', 'peach', 20, true),
  ('gentle-cleanser', 'Gentle Hydrating Cleanser', 'Personal care', 'Sensitive skin · 200 ml', 12400, 14500, 'GENTLE CARE', 'cleanser', 'mint', 20, false),
  ('first-aid-kit', 'Everyday First Aid Kit', 'First aid', '12 essentials · home & travel', 9800, null, 'JUST IN', 'firstaid', 'blue', 20, true),
  ('omega-3', 'Omega 3 Fish Oil', 'Vitamins & supplements', 'Heart & brain support · 60 softgels', 15800, null, 'POPULAR', 'omega', 'peach', 20, false),
  ('digital-thermometer', 'Digital Thermometer', 'Health devices', 'Fast reading · easy to use', 7500, null, 'AT-HOME CARE', 'device', 'lavender', 20, false),
  ('oral-rehydration-salts', 'Oral Rehydration Salts', 'Medicines', 'Single-use sachets · ask our pharmacist', 1200, null, 'PHARMACIST PICK', 'medicine', 'mint', 20, false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
