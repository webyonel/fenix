-- Fixed product categories; the prior pullover remains nullable until reassigned in admin.
create table public.product_categories (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null unique,
  cover_path text not null,
  position smallint not null unique check (position > 0),
  updated_at timestamptz not null default now()
);

create trigger product_categories_set_updated_at before update on public.product_categories
  for each row execute function private.set_updated_at();

alter table public.products
  add column category_slug text references public.product_categories(slug) on update cascade on delete set null;
create index products_category_position_idx on public.products (category_slug, position, created_at);

alter table public.product_categories enable row level security;
grant select on public.product_categories to anon, authenticated;
grant update (cover_path) on public.product_categories to authenticated;

create policy "Public can read product categories" on public.product_categories
  for select to anon, authenticated using (true);
create policy "Admins can update product category covers" on public.product_categories
  for update to authenticated using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));

insert into public.product_categories (slug, name, cover_path, position) values
  ('laminas-aluminio-sublimable', 'Láminas de aluminio sublimable', '/img/carrusel1.avif', 1),
  ('llaveros-mdf-sublimables', 'Llaveros MDF sublimables', '/img/carrusel2.avif', 2),
  ('llaveros-acrilico-sublimacion', 'Llaveros de acrílico con sublimación', '/img/carrusel3.avif', 3),
  ('jarras-personalizadas', 'Jarras Personalizadas', '/img/tasa.webp', 4),
  ('bolsas-lienzos-personalizadas', 'Bolsas de lienzos personalizadas', '/img/carrusel4.avif', 5),
  ('relojes-personalizados', 'Relojes Personalizados', '/img/carrusel5.avif', 6);

update public.products
set category_slug = 'jarras-personalizadas'
where name = 'Jarras personalizadas';
