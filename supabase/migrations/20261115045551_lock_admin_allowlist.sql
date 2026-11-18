-- The allowlist is only read by private.is_site_admin(); no app role accesses it directly.
create policy "No client access to admin allowlist"
on private.site_admin_allowlist
for all
to anon, authenticated
using (false)
with check (false);
