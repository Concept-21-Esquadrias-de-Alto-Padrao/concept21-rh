-- RH operational maintenance is separate from the RH identity provider. Auth,
-- corporate identity, and consent must keep working for the other modules.
create table public.hr_module_maintenance (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  message text not null default 'RH em manutenção para atualização controlada.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.hr_module_maintenance (id, enabled) values (true, false);
alter table public.hr_module_maintenance enable row level security;
revoke all on public.hr_module_maintenance from anon, authenticated;
grant select, update on public.hr_module_maintenance to authenticated;

create policy hr_maintenance_read on public.hr_module_maintenance
for select to authenticated using (true);
create policy hr_maintenance_master_update on public.hr_module_maintenance
for update to authenticated
using (app.has_role('master'))
with check (id and app.has_role('master') and updated_by = auth.uid());

create table public.hr_module_maintenance_events (
  id bigint generated always as identity primary key,
  enabled boolean not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);
alter table public.hr_module_maintenance_events enable row level security;
revoke all on public.hr_module_maintenance_events from anon, authenticated;
grant select on public.hr_module_maintenance_events to authenticated;
create policy hr_maintenance_events_master_read on public.hr_module_maintenance_events
for select to authenticated using (app.has_role('master'));

create function app.record_hr_maintenance_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, app as $$
begin
  if new.enabled is distinct from old.enabled then
    insert into public.hr_module_maintenance_events (enabled, changed_by)
    values (new.enabled, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function app.record_hr_maintenance_change() from public, anon, authenticated;
create trigger record_hr_maintenance_change
after update on public.hr_module_maintenance
for each row execute function app.record_hr_maintenance_change();

-- This function is used by the Storage restrictive policies as well as by the
-- table guard. It reads the state with definer privileges but trusts only the
-- established Master role, never user-editable metadata.
create function app.hr_operational_write_allowed()
returns boolean language sql stable security definer set search_path = pg_catalog, public, app as $$
  select not coalesce((select enabled from public.hr_module_maintenance where id = true), true)
     or app.has_role('master')
$$;
revoke all on function app.hr_operational_write_allowed() from public, anon;
grant execute on function app.hr_operational_write_allowed() to authenticated;

create function app.guard_hr_operational_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, app as $$
begin
  if not app.hr_operational_write_allowed() then
    raise exception 'RH em manutenção. Não é possível gravar dados neste momento.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app.guard_hr_operational_write() from public, anon, authenticated;

-- Inventory of the current RH operational tables. Excluded: identity and
-- authentication support (profiles, roles, links, notifications and OAuth),
-- which must stay available while an individual module is under maintenance.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'alert_rules', 'company_units', 'cost_centers', 'cost_component_categories',
    'cost_components', 'custom_field_options', 'custom_field_values',
    'custom_fields', 'daily_occurrence_report_items', 'daily_occurrence_reports',
    'departments', 'dependent_relationship_types', 'document_types',
    'employee_addresses', 'employee_compensations', 'employee_cost_components',
    'employee_dependents', 'employee_documents', 'employee_history_events',
    'employee_leaves', 'employee_monthly_cost_events',
    'employee_movement_cost_categories', 'employee_movement_cost_items',
    'employee_movements', 'employee_occurrence_attachments',
    'employee_occurrences', 'employee_statuses', 'employee_trainings',
    'employees', 'employment_types', 'leave_types', 'marital_statuses',
    'monthly_employee_cost_items', 'monthly_employee_costs',
    'occurrence_categories', 'occurrence_cost_rules', 'occurrence_types',
    'positions', 'required_documents', 'termination_reasons', 'trainings',
    'vacations'
  ] loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Missing RH operational table: %', table_name;
    end if;
    execute format('create trigger guard_hr_maintenance before insert or update or delete on public.%I for each row execute function app.guard_hr_operational_write()', table_name);
  end loop;
end;
$$;

-- Storage policies run as authenticated, which has no USAGE on the internal
-- app schema. Expose only this restricted predicate in public.
create function public.hr_maintenance_can_write()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, app as $hrbody$
  select app.hr_operational_write_allowed()
$hrbody$;
revoke all on function public.hr_maintenance_can_write() from public, anon;
grant execute on function public.hr_maintenance_can_write() to authenticated;

-- Only hr-documents is operational Storage. Restrictive policies intersect its
-- existing permission policies without widening access to any bucket.
create policy hr_maintenance_storage_insert on storage.objects as restrictive
for insert to authenticated with check (bucket_id <> 'hr-documents' or public.hr_maintenance_can_write());
create policy hr_maintenance_storage_update on storage.objects as restrictive
for update to authenticated
using (bucket_id <> 'hr-documents' or public.hr_maintenance_can_write())
with check (bucket_id <> 'hr-documents' or public.hr_maintenance_can_write());
create policy hr_maintenance_storage_delete on storage.objects as restrictive
for delete to authenticated using (bucket_id <> 'hr-documents' or public.hr_maintenance_can_write());
