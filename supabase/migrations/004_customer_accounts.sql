-- Customer accounts: order history, saved details, and cart/saved-items sync.
-- Customers sign in with Supabase Auth; the server (service role) reads and writes these rows.
-- Safe to re-run.

alter table public.orders
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  phone text not null default '' check (char_length(phone) <= 25),
  address text not null default '' check (char_length(address) <= 500),
  cart jsonb not null default '{}'::jsonb,
  saved jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
