-- Applied after the initial maintenance migration in existing test databases.
-- Also safe after a fresh install where the base migration includes this wrapper.
create or replace function public.hr_maintenance_can_write()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, app as $$
  select app.hr_operational_write_allowed()
$$;
revoke all on function public.hr_maintenance_can_write() from public, anon;
grant execute on function public.hr_maintenance_can_write() to authenticated;

drop policy if exists hr_maintenance_storage_insert on storage.objects;
create policy hr_maintenance_storage_insert on storage.objects as restrictive
for insert to authenticated with check (bucket_id <> 'hr-documents' or public.hr_maintenance_can_write());
drop policy if exists hr_maintenance_storage_update on storage.objects;
create policy hr_maintenance_storage_update on storage.objects as restrictive
for update to authenticated
using (bucket_id <> 'hr-documents' or public.hr_maintenance_can_write())
with check (bucket_id <> 'hr-documents' or public.hr_maintenance_can_write());
drop policy if exists hr_maintenance_storage_delete on storage.objects;
create policy hr_maintenance_storage_delete on storage.objects as restrictive
for delete to authenticated using (bucket_id <> 'hr-documents' or public.hr_maintenance_can_write());
