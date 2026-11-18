-- Editable site-wide CUP conversion rate; existing content keeps the previous 800 CUP/USD default.
alter table public.site_settings
  add column cup_per_usd numeric(12, 2) not null default 800
  check (cup_per_usd > 0);
