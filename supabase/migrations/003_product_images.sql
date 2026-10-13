-- Product photo gallery: ordered list of public image URLs (max 8).
-- image_url stays the primary photo and equals images[1] when images exist.
-- Safe to re-run.

alter table public.products
  add column if not exists images text[] not null default '{}';

alter table public.products drop constraint if exists products_images_max_check;
alter table public.products
  add constraint products_images_max_check check (cardinality(images) <= 8);

update public.products
set images = array[image_url]
where image_url is not null and cardinality(images) = 0;
