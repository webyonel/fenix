create or replace function public.is_site_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select private.is_site_admin());
$$;
revoke all on function public.is_site_admin() from public, anon, authenticated;
grant execute on function public.is_site_admin() to authenticated;
