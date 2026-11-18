-- Fénix content backend: normalized content, public reads, allowlisted admin writes.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.site_admin_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table private.site_admin_allowlist enable row level security;
revoke all on table private.site_admin_allowlist from public, anon, authenticated;
insert into private.site_admin_allowlist (email)
values ('fenixestudio@gmail.com')
on conflict (email) do nothing;

create or replace function private.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and exists (
      select 1
      from private.site_admin_allowlist as allowlist
      where allowlist.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    );
$$;
revoke all on function private.is_site_admin() from public, anon, authenticated;
grant execute on function private.is_site_admin() to authenticated;

create table public.site_settings (
  id boolean primary key default true check (id),
  hero_title_line text not null default 'Momentos que' check (char_length(hero_title_line) <= 60),
  hero_title_emphasis text not null default 'se quedan contigo.' check (char_length(hero_title_emphasis) <= 70),
  hero_text_color text not null default '#ffffff' check (hero_text_color ~ '^#[0-9A-Fa-f]{6}$'),
  hero_image_path text not null default '/img/hero-fenix.webp',
  hero_image_alt text not null default 'Pareja de recién casados en una sesión al aire libre',
  about_paragraphs text[] not null default '{}',
  about_image_path text not null default '/img/hero-fenix.webp',
  about_image_alt text not null default 'Pareja de recién casados en una sesión al aire libre',
  updated_at timestamptz not null default now()
);

create table public.plan_categories (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null unique,
  cover_path text not null,
  position smallint not null unique check (position > 0),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references public.plan_categories(slug) on update cascade on delete restrict,
  name text not null check (char_length(name) between 1 and 70),
  description text not null check (char_length(description) between 1 and 240),
  features text[] not null default '{}',
  price_usd numeric(10,2) not null check (price_usd >= 0),
  image_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plans_category_position_idx on public.plans (category_slug, position, created_at);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 70),
  description text not null check (char_length(description) between 1 and 240),
  price_usd numeric(10,2) not null check (price_usd >= 0),
  image_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_position_idx on public.products (position, created_at);

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  alt_text text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index gallery_items_position_idx on public.gallery_items (position, created_at);

create table public.busy_dates (
  date date primary key check (extract(isodow from date) <> 7),
  created_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;
create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function private.set_updated_at();
create trigger plan_categories_set_updated_at before update on public.plan_categories
  for each row execute function private.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
  for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function private.set_updated_at();

alter table public.site_settings enable row level security;
alter table public.plan_categories enable row level security;
alter table public.plans enable row level security;
alter table public.products enable row level security;
alter table public.gallery_items enable row level security;
alter table public.busy_dates enable row level security;

grant select on public.site_settings, public.plan_categories, public.plans,
  public.products, public.gallery_items, public.busy_dates to anon, authenticated;
grant update on public.site_settings to authenticated;
grant update (cover_path) on public.plan_categories to authenticated;
grant insert, update, delete on public.plans, public.products, public.gallery_items to authenticated;
grant insert, delete on public.busy_dates to authenticated;

create policy "Public can read site settings" on public.site_settings
  for select to anon, authenticated using (true);
create policy "Admins can update site settings" on public.site_settings
  for update to authenticated using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));

create policy "Public can read plan categories" on public.plan_categories
  for select to anon, authenticated using (true);
create policy "Admins can update category covers" on public.plan_categories
  for update to authenticated using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));

create policy "Public can read plans" on public.plans
  for select to anon, authenticated using (true);
create policy "Admins can create plans" on public.plans
  for insert to authenticated with check ((select private.is_site_admin()));
create policy "Admins can update plans" on public.plans
  for update to authenticated using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));
create policy "Admins can delete plans" on public.plans
  for delete to authenticated using ((select private.is_site_admin()));

create policy "Public can read products" on public.products
  for select to anon, authenticated using (true);
create policy "Admins can create products" on public.products
  for insert to authenticated with check ((select private.is_site_admin()));
create policy "Admins can update products" on public.products
  for update to authenticated using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));
create policy "Admins can delete products" on public.products
  for delete to authenticated using ((select private.is_site_admin()));

create policy "Public can read gallery" on public.gallery_items
  for select to anon, authenticated using (true);
create policy "Admins can create gallery items" on public.gallery_items
  for insert to authenticated with check ((select private.is_site_admin()));
create policy "Admins can update gallery items" on public.gallery_items
  for update to authenticated using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));
create policy "Admins can delete gallery items" on public.gallery_items
  for delete to authenticated using ((select private.is_site_admin()));

create policy "Public can read busy dates" on public.busy_dates
  for select to anon, authenticated using (true);
create policy "Admins can mark busy dates" on public.busy_dates
  for insert to authenticated with check ((select private.is_site_admin()));
create policy "Admins can clear busy dates" on public.busy_dates
  for delete to authenticated using ((select private.is_site_admin()));

insert into public.site_settings (
  id, hero_title_line, hero_title_emphasis, hero_text_color, hero_image_path, hero_image_alt,
  about_paragraphs, about_image_path, about_image_alt
) values (
  true, 'Momentos que', 'se quedan contigo.', '#ffffff', '/img/hero-fenix.webp',
  'Pareja de recién casados en una sesión al aire libre',
  array[
    'En Fénix creemos que cada persona tiene una historia que merece ser contada con sensibilidad y autenticidad.',
    'Creamos un espacio cercano y cuidado para convertir tus momentos especiales en recuerdos que te acompañen siempre.'
  ],
  '/img/hero-fenix.webp', 'Pareja de recién casados en una sesión al aire libre'
);

insert into public.plan_categories (slug, name, cover_path, position) values
  ('ninos', 'Niños', '/img/portafolio/ninos-2.webp', 1),
  ('quinceaneras', 'Quinceañeras', '/img/portafolio/quinceaneras-1.webp', 2),
  ('quinceaneros', 'Quinceañeros', '/img/portafolio/quinceaneros-1.webp', 3),
  ('bodas', 'Bodas', '/img/portafolio/bodas-1.webp', 4),
  ('embarazadas', 'Embarazadas', '/img/portafolio/embarazadas-1.webp', 5),
  ('planes-individuales', 'Planes Individuales', '/img/portafolio/ninos-3.webp', 6),
  ('en-promocion', 'En promoción', '/img/portafolio/ninos-1.webp', 7);

insert into public.plans (category_slug, name, description, features, price_usd, image_path, position) values
  ('planes-individuales', 'Esencia', 'Un retrato íntimo, natural y completamente tuyo.', array['Sesión de 30 minutos', '5 fotografías editadas', 'Entrega digital'], 75, '/img/carrusel1.avif', 1),
  ('planes-individuales', 'De nosotros', 'Tiempo juntos, sin poses forzadas. Solo ustedes.', array['Sesión de 60 minutos', '12 fotografías editadas', 'Impresiones incluidas'], 100, '/img/carrusel2.avif', 2),
  ('planes-individuales', 'Para siempre', 'Un día especial merece recuerdos extraordinarios.', array['Cobertura personalizada', 'Galería digital completa', 'Asesoría antes de la sesión'], 125, '/img/carrusel3.avif', 3),
  ('ninos', 'Pequeños momentos', 'Una sesión divertida para guardar cada sonrisa y ocurrencia.', array['Sesión de 45 minutos', '8 fotografías editadas', 'Entrega digital'], 75, '/img/portafolio/ninos-2.webp', 1),
  ('quinceaneras', 'Mis quince', 'Un retrato especial para celebrar una etapa única.', array['Sesión de 60 minutos', '10 fotografías editadas', 'Asesoría de vestuario'], 100, '/img/portafolio/quinceaneras-1.webp', 1),
  ('quinceaneros', 'Oferta 1', 'Fotos impresas', array['10 fotos 6×8', 'Lienzo 16×24', '1 llavero'], 55, '/img/portafolio/quinceaneros-1.webp', 1),
  ('quinceaneros', 'Oferta 2', 'Fotos impresas', array['10 fotos 6×8', 'Lona 20×30', '2 llaveros'], 65, '/img/portafolio/quinceaneros-1.webp', 2),
  ('quinceaneros', 'Oferta 3', 'Fotos impresas', array['14 fotos 6×8', 'Lona 24×32', '2 llaveros'], 85, '/img/portafolio/quinceaneros-1.webp', 3),
  ('quinceaneros', 'Oferta 4', 'Fotos impresas', array['10 fotos 8×10', 'Lienzo 16×24', '16 postales'], 70, '/img/portafolio/quinceaneros-1.webp', 4),
  ('quinceaneros', 'Oferta 5', 'Fotos impresas', array['10 fotos 8×10', 'Lienzo 24×39', '2 llaveros'], 85, '/img/portafolio/quinceaneros-1.webp', 5),
  ('bodas', 'Nuestra historia', 'Los momentos más importantes de un día inolvidable.', array['Cobertura de ceremonia', 'Galería digital editada', 'Consulta previa'], 125, '/img/portafolio/bodas-1.webp', 1),
  ('embarazadas', 'En espera', 'Un recuerdo delicado de la dulce espera.', array['Sesión de 60 minutos', '10 fotografías editadas', 'Asesoría de vestuario'], 100, '/img/portafolio/embarazadas-1.webp', 1),
  ('en-promocion', 'Experiencia Fénix', 'Una sesión especial para crear recuerdos que perduran.', array['Sesión de 45 minutos', '8 fotografías editadas', 'Entrega digital'], 75, '/img/portafolio/ninos-1.webp', 1);

insert into public.products (name, description, price_usd, image_path, position) values
  ('Jarras personalizadas', 'Un detalle único para regalar o regalarte.', 3, '/img/tasa.webp', 1),
  ('Pullovers personalizados', 'Lleva tus recuerdos favoritos contigo.', 5, '/img/camisa.avif', 2);

insert into public.gallery_items (image_path, alt_text, position) values
  ('/img/portafolio/ninos-1.webp', 'Sesión infantil al aire libre', 1),
  ('/img/portafolio/ninos-2.webp', 'Retrato infantil con flores', 2),
  ('/img/portafolio/ninos-3.webp', 'Retrato de niño en exterior', 3),
  ('/img/portafolio/bodas-1.webp', 'Pareja de recién casados en el jardín', 4),
  ('/img/portafolio/bodas-2.webp', 'Retrato de novia con su vestido', 5),
  ('/img/portafolio/bodas-3.webp', 'Novios celebrando su boda', 6),
  ('/img/portafolio/embarazadas-1.webp', 'Sesión artística de maternidad', 7),
  ('/img/portafolio/embarazadas-2.webp', 'Retrato de maternidad con vestido naranja', 8),
  ('/img/portafolio/embarazadas-3.webp', 'Sesión familiar de maternidad', 9),
  ('/img/portafolio/quinceaneras-1.webp', 'Retrato de quinceañera con vestido lila', 10),
  ('/img/portafolio/quinceaneras-2.webp', 'Quinceañera con vestido azul', 11),
  ('/img/portafolio/quinceaneras-3.webp', 'Retrato de quinceañera en estudio', 12),
  ('/img/portafolio/quinceaneros-1.webp', 'Retrato formal de quinceañero', 13),
  ('/img/portafolio/quinceaneros-2.webp', 'Retrato de quinceañero con traje', 14),
  ('/img/portafolio/quinceaneros-3.webp', 'Quinceañero con traje beige', 15);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "Admins can list site media" on storage.objects
  for select to authenticated using (bucket_id = 'site-media' and (select private.is_site_admin()));
create policy "Admins can upload site media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] in ('hero', 'about', 'categories', 'plans', 'products', 'gallery')
    and (select private.is_site_admin())
  );
create policy "Admins can replace site media" on storage.objects
  for update to authenticated using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] in ('hero', 'about', 'categories', 'plans', 'products', 'gallery')
    and (select private.is_site_admin())
  ) with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] in ('hero', 'about', 'categories', 'plans', 'products', 'gallery')
    and (select private.is_site_admin())
  );
create policy "Admins can delete site media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] in ('hero', 'about', 'categories', 'plans', 'products', 'gallery')
    and (select private.is_site_admin())
  );
