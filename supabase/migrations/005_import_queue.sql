-- AI Import: staging queue for products scanned from another website.
-- Safe to re-run. Only the backend (service role) reads and writes these tables.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_url text not null check (char_length(source_url) <= 2000),
  platform text not null default '',
  status text not null default 'scanning' check (status in ('scanning', 'ready')),
  cursor jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  data jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  product_id text references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.import_items add column if not exists claimed_at timestamptz;

create index if not exists import_items_batch_idx on public.import_items (batch_id, created_at);

alter table public.import_batches enable row level security;
alter table public.import_items enable row level security;
