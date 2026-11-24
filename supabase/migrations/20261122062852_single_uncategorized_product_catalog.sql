-- Replace the six-category product catalog with one editable, uncategorized catalog card.
-- This explicitly clears all current product rows, as requested.
delete from public.products;

alter table public.products
  drop constraint if exists products_category_slug_fkey;
drop index if exists public.products_category_position_idx;
alter table public.products
  drop column if exists category_slug;
drop table if exists public.product_categories;

alter table public.site_settings
  add column products_card_image_path text not null default '/img/camisa.avif',
  add column products_card_image_alt text not null default 'Productos personalizables de Estudio Fotográfico Fénix';
