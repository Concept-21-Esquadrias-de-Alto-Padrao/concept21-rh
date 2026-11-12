-- Keep newly introduced maintenance tables and RPC inside identity-only OAuth boundaries.
do $boundaries$
declare target text;
begin
  foreach target in array array['hr_module_maintenance', 'hr_module_maintenance_events'] loop
    if not exists (select 1 from pg_class where oid=to_regclass(format('public.%I', target)) and relrowsecurity) then
      raise exception 'Maintenance relation missing or without RLS: %', target;
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=target and policyname='oauth_clients_no_hr_data') then
      execute format('create policy oauth_clients_no_hr_data on public.%I as restrictive for all to authenticated using (((select auth.jwt()) ->> ''client_id'') is null) with check (((select auth.jwt()) ->> ''client_id'') is null)', target);
    end if;
  end loop;
end
$boundaries$;

create or replace function public.hr_maintenance_can_write()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, app as $maintenance$
  select ((select auth.jwt()) ->> 'client_id') is null
    and app.hr_operational_write_allowed()
$maintenance$;
revoke all on function public.hr_maintenance_can_write() from public, anon;
grant execute on function public.hr_maintenance_can_write() to authenticated;
