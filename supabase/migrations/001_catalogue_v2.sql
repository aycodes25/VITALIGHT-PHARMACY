-- Catalogue v2: richer product fields, more illustration types, new category set.
-- Safe to re-run.

alter table public.products
  add column if not exists brand text not null default '' check (char_length(brand) <= 60);
alter table public.products
  add column if not exists rx_required boolean not null default false;
alter table public.products
  add column if not exists sort_order integer not null default 0 check (sort_order between 0 and 999);

alter table public.products drop constraint if exists products_art_check;
alter table public.products
  add constraint products_art_check check (art in (
    'vitamin', 'vitaminc', 'cleanser', 'firstaid', 'omega', 'device', 'medicine',
    'tube', 'sachet', 'strip', 'dropper', 'spray', 'jar', 'box'
  ));

-- Rename legacy categories. Products follow automatically (ON UPDATE CASCADE).
update public.categories set name = 'Medicines & pain relief'
where name = 'Medicines'
  and not exists (select 1 from public.categories where name = 'Medicines & pain relief');
update public.categories set name = 'Skin care & dermatology'
where name = 'Personal care'
  and not exists (select 1 from public.categories where name = 'Skin care & dermatology');
update public.categories set name = 'First aid & wound care'
where name = 'First aid'
  and not exists (select 1 from public.categories where name = 'First aid & wound care');
update public.categories set name = 'Health devices & diagnostics'
where name = 'Health devices'
  and not exists (select 1 from public.categories where name = 'Health devices & diagnostics');

-- Remove leftover empty legacy category rows (e.g. after a partial earlier run).
delete from public.categories c
where c.name in ('Medicines', 'Personal care', 'First aid', 'Health devices')
  and not exists (select 1 from public.products p where p.category = c.name);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_active_idx on public.products (is_active);
