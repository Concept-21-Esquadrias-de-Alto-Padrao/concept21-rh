begin;

create index if not exists employees_profile_active_idx
on public.employees(profile_id)
where deleted_at is null;

create index if not exists employee_occurrence_attachments_occurrence_idx
on public.employee_occurrence_attachments(occurrence_id);

create or replace function app.permission_scopes(permission_key text)
returns text[]
language sql
stable
security definer
set search_path = public, app
as $$
  select case
    when not app.current_auth_email_confirmed() then array[]::text[]
    when app.has_role('master') then array['all']::text[]
    else coalesce(
      (
        select array_agg(scope order by sort_order)
        from (
          select distinct
            rp.scope,
            case rp.scope
              when 'all' then 1
              when 'own_department' then 2
              when 'subordinates' then 3
              when 'own_data' then 4
              else 5
            end as sort_order
          from public.profiles p
          join public.user_roles ur on ur.profile_id = p.id
          join public.roles r on r.id = ur.role_id
          join public.role_permissions rp on rp.role_id = r.id
          join public.permissions perm on perm.id = rp.permission_id
          where p.auth_user_id = auth.uid()
            and p.is_active = true
            and ur.is_active = true
            and (ur.expires_at is null or ur.expires_at > now())
            and r.is_active = true
            and perm.is_active = true
            and rp.scope <> 'none'
            and perm.key = permission_key
        ) granted_scopes
      ),
      array[]::text[]
    )
  end
$$;

create or replace function app.has_all_scope(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select 'all' = any(app.permission_scopes(permission_key))
$$;

create or replace function app.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, app
as $$
  select e.id
  from public.employees e
  join public.profiles p on p.id = e.profile_id
  where p.auth_user_id = auth.uid()
    and p.is_active = true
    and e.is_active = true
    and e.deleted_at is null
    and app.current_auth_email_confirmed()
  order by e.created_at desc
  limit 1
$$;

create or replace function app.current_employee_department_id()
returns uuid
language sql
stable
security definer
set search_path = public, app
as $$
  select e.department_id
  from public.employees e
  where e.id = app.current_employee_id()
    and e.deleted_at is null
  limit 1
$$;

create or replace function app.is_subordinate_of_current_user(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  with recursive subordinate_tree(employee_id, path, depth) as (
    select e.id, array[e.id], 1
    from public.employees e
    where e.manager_employee_id = app.current_employee_id()
      and e.deleted_at is null

    union all

    select child.id, subordinate_tree.path || child.id, subordinate_tree.depth + 1
    from public.employees child
    join subordinate_tree on child.manager_employee_id = subordinate_tree.employee_id
    where child.deleted_at is null
      and subordinate_tree.depth < 50
      and not child.id = any(subordinate_tree.path)
  )
  select target_employee_id is not null
    and exists (
      select 1
      from subordinate_tree
      where subordinate_tree.employee_id = target_employee_id
    )
$$;

create or replace function app.can_access_employee(target_employee_id uuid, permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  granted_scopes text[];
  current_department_id uuid;
begin
  if target_employee_id is null or permission_key is null then
    return false;
  end if;

  if not app.current_auth_email_confirmed() then
    return false;
  end if;

  granted_scopes := app.permission_scopes(permission_key);

  if coalesce(array_length(granted_scopes, 1), 0) = 0 then
    return false;
  end if;

  if 'all' = any(granted_scopes) then
    return true;
  end if;

  if 'own_data' = any(granted_scopes) and exists (
    select 1
    from public.employees e
    where e.id = target_employee_id
      and e.profile_id = app.current_profile_id()
      and e.deleted_at is null
  ) then
    return true;
  end if;

  if 'own_department' = any(granted_scopes) then
    current_department_id := app.current_employee_department_id();

    if current_department_id is not null and exists (
      select 1
      from public.employees e
      where e.id = target_employee_id
        and e.department_id = current_department_id
        and e.department_id is not null
        and e.deleted_at is null
    ) then
      return true;
    end if;
  end if;

  if 'subordinates' = any(granted_scopes)
    and app.is_subordinate_of_current_user(target_employee_id) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function app.can_access_employee_from_storage_path(object_name text, permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  employee_id_text text;
begin
  if object_name is null then
    return false;
  end if;

  employee_id_text := substring(
    object_name
    from '^employees/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(/|$)'
  );

  if employee_id_text is null then
    return false;
  end if;

  return app.can_access_employee(employee_id_text::uuid, permission_key);
end;
$$;

create or replace function app.can_access_custom_field_value(target_entity text, target_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  normalized_entity text;
begin
  if target_entity is null or target_entity_id is null then
    return false;
  end if;

  normalized_entity := lower(target_entity);

  if normalized_entity = 'employee' then
    return app.can_access_employee(target_entity_id, 'hr.employees.view');
  end if;

  if normalized_entity in ('document', 'employee_document') then
    return exists (
      select 1
      from public.employee_documents d
      where d.id = target_entity_id
        and d.deleted_at is null
        and (
          app.can_access_employee(d.employee_id, 'hr.documents.view')
          or app.can_access_employee(d.employee_id, 'hr.documents.download')
        )
    );
  end if;

  if normalized_entity in ('occurrence', 'employee_occurrence') then
    return exists (
      select 1
      from public.employee_occurrences o
      where o.id = target_entity_id
        and o.deleted_at is null
        and app.can_access_employee(o.employee_id, 'hr.occurrences.view')
    );
  end if;

  if normalized_entity in ('training', 'employee_training') then
    if exists (
      select 1
      from public.employee_trainings t
      where t.id = target_entity_id
        and t.deleted_at is null
        and app.can_access_employee(t.employee_id, 'hr.trainings.view')
    ) then
      return true;
    end if;

    return app.has_permission('hr.trainings.view');
  end if;

  return app.has_permission('hr.custom_fields.manage');
end;
$$;

create or replace function app.can_write_employee_history(target_employee_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  permission_key text;
begin
  if target_employee_id is null then
    return false;
  end if;

  foreach permission_key in array array[
    'hr.employees.create',
    'hr.employees.edit',
    'hr.employees.inactivate',
    'hr.documents.create',
    'hr.documents.approve',
    'hr.documents.reject',
    'hr.documents.manage',
    'hr.vacations.create',
    'hr.vacations.approve',
    'hr.leaves.create',
    'hr.leaves.approve',
    'hr.trainings.edit',
    'hr.occurrences.create',
    'hr.occurrences.edit',
    'hr.employees.dependents.manage',
    'hr.movements.manage',
    'hr.labor_costs.manage',
    'hr.labor_costs.copy_settings',
    'hr.labor_costs.delete_employee_component',
    'hr.labor_costs.close_month'
  ] loop
    if app.can_access_employee(target_employee_id, permission_key) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function app.permission_scopes(text) from public;
revoke all on function app.has_all_scope(text) from public;
revoke all on function app.current_employee_id() from public;
revoke all on function app.current_employee_department_id() from public;
revoke all on function app.is_subordinate_of_current_user(uuid) from public;
revoke all on function app.can_access_employee(uuid, text) from public;
revoke all on function app.can_access_employee_from_storage_path(text, text) from public;
revoke all on function app.can_access_custom_field_value(text, uuid) from public;
revoke all on function app.can_write_employee_history(uuid) from public;

grant execute on function app.permission_scopes(text) to authenticated;
grant execute on function app.has_all_scope(text) to authenticated;
grant execute on function app.current_employee_id() to authenticated;
grant execute on function app.current_employee_department_id() to authenticated;
grant execute on function app.is_subordinate_of_current_user(uuid) to authenticated;
grant execute on function app.can_access_employee(uuid, text) to authenticated;
grant execute on function app.can_access_employee_from_storage_path(text, text) to authenticated;
grant execute on function app.can_access_custom_field_value(text, uuid) to authenticated;
grant execute on function app.can_write_employee_history(uuid) to authenticated;

drop policy if exists "employees_select" on public.employees;
create policy "employees_select"
on public.employees for select to authenticated
using (app.can_access_employee(id, 'hr.employees.view'));

drop policy if exists "employees_insert" on public.employees;
create policy "employees_insert"
on public.employees for insert to authenticated
with check (
  app.has_all_scope('hr.employees.create')
  or app.has_all_scope('hr.movements.manage')
);

drop policy if exists "employees_update" on public.employees;
create policy "employees_update"
on public.employees for update to authenticated
using (
  app.can_access_employee(id, 'hr.employees.edit')
  or app.can_access_employee(id, 'hr.employees.inactivate')
  or app.can_access_employee(id, 'hr.movements.manage')
)
with check (
  app.can_access_employee(id, 'hr.employees.edit')
  or app.can_access_employee(id, 'hr.employees.inactivate')
  or app.can_access_employee(id, 'hr.movements.manage')
);

drop policy if exists "employee_addresses_select" on public.employee_addresses;
create policy "employee_addresses_select"
on public.employee_addresses for select to authenticated
using (app.can_access_employee(employee_id, 'hr.employees.view'));

drop policy if exists "employee_addresses_insert" on public.employee_addresses;
create policy "employee_addresses_insert"
on public.employee_addresses for insert to authenticated
with check (
  app.can_access_employee(employee_id, 'hr.employees.create')
  or app.can_access_employee(employee_id, 'hr.employees.edit')
  or app.can_access_employee(employee_id, 'hr.movements.manage')
);

drop policy if exists "employee_addresses_update" on public.employee_addresses;
create policy "employee_addresses_update"
on public.employee_addresses for update to authenticated
using (app.can_access_employee(employee_id, 'hr.employees.edit'))
with check (app.can_access_employee(employee_id, 'hr.employees.edit'));

drop policy if exists "employee_documents_select" on public.employee_documents;
create policy "employee_documents_select"
on public.employee_documents for select to authenticated
using (
  app.can_access_employee(employee_id, 'hr.documents.view')
  or app.can_access_employee(employee_id, 'hr.documents.download')
);

drop policy if exists "employee_documents_insert" on public.employee_documents;
create policy "employee_documents_insert"
on public.employee_documents for insert to authenticated
with check (
  app.can_access_employee(employee_id, 'hr.documents.create')
  or app.can_access_employee(employee_id, 'hr.documents.manage')
);

drop policy if exists "employee_documents_update" on public.employee_documents;
create policy "employee_documents_update"
on public.employee_documents for update to authenticated
using (
  app.can_access_employee(employee_id, 'hr.documents.create')
  or app.can_access_employee(employee_id, 'hr.documents.approve')
  or app.can_access_employee(employee_id, 'hr.documents.reject')
  or app.can_access_employee(employee_id, 'hr.documents.manage')
)
with check (
  app.can_access_employee(employee_id, 'hr.documents.create')
  or app.can_access_employee(employee_id, 'hr.documents.approve')
  or app.can_access_employee(employee_id, 'hr.documents.reject')
  or app.can_access_employee(employee_id, 'hr.documents.manage')
);

drop policy if exists "vacations_select" on public.vacations;
create policy "vacations_select"
on public.vacations for select to authenticated
using (app.can_access_employee(employee_id, 'hr.vacations.view'));

drop policy if exists "vacations_insert" on public.vacations;
create policy "vacations_insert"
on public.vacations for insert to authenticated
with check (app.can_access_employee(employee_id, 'hr.vacations.create'));

drop policy if exists "vacations_update" on public.vacations;
create policy "vacations_update"
on public.vacations for update to authenticated
using (
  app.can_access_employee(employee_id, 'hr.vacations.create')
  or app.can_access_employee(employee_id, 'hr.vacations.approve')
)
with check (
  app.can_access_employee(employee_id, 'hr.vacations.create')
  or app.can_access_employee(employee_id, 'hr.vacations.approve')
);

drop policy if exists "employee_leaves_select" on public.employee_leaves;
create policy "employee_leaves_select"
on public.employee_leaves for select to authenticated
using (app.can_access_employee(employee_id, 'hr.leaves.view'));

drop policy if exists "employee_leaves_insert" on public.employee_leaves;
create policy "employee_leaves_insert"
on public.employee_leaves for insert to authenticated
with check (app.can_access_employee(employee_id, 'hr.leaves.create'));

drop policy if exists "employee_leaves_update" on public.employee_leaves;
create policy "employee_leaves_update"
on public.employee_leaves for update to authenticated
using (
  app.can_access_employee(employee_id, 'hr.leaves.create')
  or app.can_access_employee(employee_id, 'hr.leaves.approve')
)
with check (
  app.can_access_employee(employee_id, 'hr.leaves.create')
  or app.can_access_employee(employee_id, 'hr.leaves.approve')
);

drop policy if exists "employee_trainings_select" on public.employee_trainings;
create policy "employee_trainings_select"
on public.employee_trainings for select to authenticated
using (app.can_access_employee(employee_id, 'hr.trainings.view'));

drop policy if exists "employee_trainings_insert" on public.employee_trainings;
create policy "employee_trainings_insert"
on public.employee_trainings for insert to authenticated
with check (app.can_access_employee(employee_id, 'hr.trainings.edit'));

drop policy if exists "employee_trainings_update" on public.employee_trainings;
create policy "employee_trainings_update"
on public.employee_trainings for update to authenticated
using (app.can_access_employee(employee_id, 'hr.trainings.edit'))
with check (app.can_access_employee(employee_id, 'hr.trainings.edit'));

drop policy if exists "employee_occurrences_select" on public.employee_occurrences;
create policy "employee_occurrences_select"
on public.employee_occurrences for select to authenticated
using (app.can_access_employee(employee_id, 'hr.occurrences.view'));

drop policy if exists "employee_occurrences_insert" on public.employee_occurrences;
create policy "employee_occurrences_insert"
on public.employee_occurrences for insert to authenticated
with check (app.can_access_employee(employee_id, 'hr.occurrences.create'));

drop policy if exists "employee_occurrences_update" on public.employee_occurrences;
create policy "employee_occurrences_update"
on public.employee_occurrences for update to authenticated
using (app.can_access_employee(employee_id, 'hr.occurrences.edit'))
with check (app.can_access_employee(employee_id, 'hr.occurrences.edit'));

drop policy if exists "employee_occurrence_attachments_select" on public.employee_occurrence_attachments;
create policy "employee_occurrence_attachments_select"
on public.employee_occurrence_attachments for select to authenticated
using (
  exists (
    select 1
    from public.employee_occurrences o
    where o.id = employee_occurrence_attachments.occurrence_id
      and o.deleted_at is null
      and app.can_access_employee(o.employee_id, 'hr.occurrences.view')
  )
);

drop policy if exists "employee_occurrence_attachments_insert" on public.employee_occurrence_attachments;
create policy "employee_occurrence_attachments_insert"
on public.employee_occurrence_attachments for insert to authenticated
with check (
  exists (
    select 1
    from public.employee_occurrences o
    where o.id = employee_occurrence_attachments.occurrence_id
      and o.deleted_at is null
      and app.can_access_employee(o.employee_id, 'hr.occurrences.create')
  )
);

drop policy if exists "custom_field_values_select" on public.custom_field_values;
create policy "custom_field_values_select"
on public.custom_field_values for select to authenticated
using (app.can_access_custom_field_value(entity, entity_id));

drop policy if exists "custom_field_values_insert" on public.custom_field_values;
create policy "custom_field_values_insert"
on public.custom_field_values for insert to authenticated
with check (
  app.has_permission('hr.custom_fields.manage')
  and app.can_access_custom_field_value(entity, entity_id)
);

drop policy if exists "custom_field_values_update" on public.custom_field_values;
create policy "custom_field_values_update"
on public.custom_field_values for update to authenticated
using (
  app.has_permission('hr.custom_fields.manage')
  and app.can_access_custom_field_value(entity, entity_id)
)
with check (
  app.has_permission('hr.custom_fields.manage')
  and app.can_access_custom_field_value(entity, entity_id)
);

drop policy if exists "employee_history_events_select" on public.employee_history_events;
create policy "employee_history_events_select"
on public.employee_history_events for select to authenticated
using (app.can_access_employee(employee_id, 'hr.employees.view'));

drop policy if exists "employee_history_events_insert" on public.employee_history_events;
create policy "employee_history_events_insert"
on public.employee_history_events for insert to authenticated
with check (app.can_write_employee_history(employee_id));

drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select"
on public.audit_logs for select to authenticated
using (app.has_all_scope('hr.audit.view'));

drop policy if exists "daily_occurrence_reports_select" on public.daily_occurrence_reports;
create policy "daily_occurrence_reports_select"
on public.daily_occurrence_reports for select to authenticated
using (
  app.has_all_scope('hr.occurrences.daily_report.view')
  or app.has_all_scope('hr.occurrences.daily_report.history')
);

drop policy if exists "daily_occurrence_reports_insert" on public.daily_occurrence_reports;
create policy "daily_occurrence_reports_insert"
on public.daily_occurrence_reports for insert to authenticated
with check (app.has_all_scope('hr.occurrences.daily_report.generate'));

drop policy if exists "daily_occurrence_reports_update" on public.daily_occurrence_reports;
create policy "daily_occurrence_reports_update"
on public.daily_occurrence_reports for update to authenticated
using (
  app.has_all_scope('hr.occurrences.daily_report.generate')
  or app.has_all_scope('hr.occurrences.daily_report.copy')
)
with check (
  app.has_all_scope('hr.occurrences.daily_report.generate')
  or app.has_all_scope('hr.occurrences.daily_report.copy')
);

drop policy if exists "daily_occurrence_report_items_select" on public.daily_occurrence_report_items;
create policy "daily_occurrence_report_items_select"
on public.daily_occurrence_report_items for select to authenticated
using (
  app.has_all_scope('hr.occurrences.daily_report.view')
  or app.has_all_scope('hr.occurrences.daily_report.history')
);

drop policy if exists "daily_occurrence_report_items_insert" on public.daily_occurrence_report_items;
create policy "daily_occurrence_report_items_insert"
on public.daily_occurrence_report_items for insert to authenticated
with check (app.has_all_scope('hr.occurrences.daily_report.generate'));

drop policy if exists "employee_dependents_select" on public.employee_dependents;
create policy "employee_dependents_select"
on public.employee_dependents for select to authenticated
using (
  app.can_access_employee(employee_id, 'hr.employees.dependents.view')
  or app.can_access_employee(employee_id, 'hr.employees.dependents.manage')
);

drop policy if exists "employee_dependents_insert" on public.employee_dependents;
create policy "employee_dependents_insert"
on public.employee_dependents for insert to authenticated
with check (app.can_access_employee(employee_id, 'hr.employees.dependents.manage'));

drop policy if exists "employee_dependents_update" on public.employee_dependents;
create policy "employee_dependents_update"
on public.employee_dependents for update to authenticated
using (app.can_access_employee(employee_id, 'hr.employees.dependents.manage'))
with check (app.can_access_employee(employee_id, 'hr.employees.dependents.manage'));

drop policy if exists "employee_compensations_select_sensitive" on public.employee_compensations;
create policy "employee_compensations_select_sensitive"
on public.employee_compensations for select to authenticated
using (app.can_access_employee(employee_id, 'hr.labor_costs.view_sensitive_values'));

drop policy if exists "employee_compensations_insert" on public.employee_compensations;
create policy "employee_compensations_insert"
on public.employee_compensations for insert to authenticated
with check (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.copy_settings')
);

drop policy if exists "employee_compensations_update" on public.employee_compensations;
create policy "employee_compensations_update"
on public.employee_compensations for update to authenticated
using (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.copy_settings')
)
with check (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.copy_settings')
);

drop policy if exists "employee_cost_components_select_sensitive" on public.employee_cost_components;
create policy "employee_cost_components_select_sensitive"
on public.employee_cost_components for select to authenticated
using (app.can_access_employee(employee_id, 'hr.labor_costs.view_sensitive_values'));

drop policy if exists "employee_cost_components_insert" on public.employee_cost_components;
create policy "employee_cost_components_insert"
on public.employee_cost_components for insert to authenticated
with check (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.copy_settings')
);

drop policy if exists "employee_cost_components_update" on public.employee_cost_components;
create policy "employee_cost_components_update"
on public.employee_cost_components for update to authenticated
using (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.copy_settings')
  or app.can_access_employee(employee_id, 'hr.labor_costs.delete_employee_component')
)
with check (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.copy_settings')
  or app.can_access_employee(employee_id, 'hr.labor_costs.delete_employee_component')
);

drop policy if exists "employee_cost_components_delete" on public.employee_cost_components;

drop policy if exists "employee_monthly_cost_events_select_sensitive" on public.employee_monthly_cost_events;
create policy "employee_monthly_cost_events_select_sensitive"
on public.employee_monthly_cost_events for select to authenticated
using (app.can_access_employee(employee_id, 'hr.labor_costs.view_sensitive_values'));

drop policy if exists "employee_monthly_cost_events_insert" on public.employee_monthly_cost_events;
create policy "employee_monthly_cost_events_insert"
on public.employee_monthly_cost_events for insert to authenticated
with check (app.can_access_employee(employee_id, 'hr.labor_costs.manage'));

drop policy if exists "employee_monthly_cost_events_update" on public.employee_monthly_cost_events;
create policy "employee_monthly_cost_events_update"
on public.employee_monthly_cost_events for update to authenticated
using (app.can_access_employee(employee_id, 'hr.labor_costs.manage'))
with check (app.can_access_employee(employee_id, 'hr.labor_costs.manage'));

drop policy if exists "monthly_employee_costs_select_sensitive" on public.monthly_employee_costs;
create policy "monthly_employee_costs_select_sensitive"
on public.monthly_employee_costs for select to authenticated
using (app.can_access_employee(employee_id, 'hr.labor_costs.view_sensitive_values'));

drop policy if exists "monthly_employee_costs_insert" on public.monthly_employee_costs;
create policy "monthly_employee_costs_insert"
on public.monthly_employee_costs for insert to authenticated
with check (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.close_month')
);

drop policy if exists "monthly_employee_costs_update" on public.monthly_employee_costs;
create policy "monthly_employee_costs_update"
on public.monthly_employee_costs for update to authenticated
using (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.close_month')
)
with check (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.close_month')
);

drop policy if exists "monthly_employee_cost_items_select_sensitive" on public.monthly_employee_cost_items;
create policy "monthly_employee_cost_items_select_sensitive"
on public.monthly_employee_cost_items for select to authenticated
using (app.can_access_employee(employee_id, 'hr.labor_costs.view_sensitive_values'));

drop policy if exists "monthly_employee_cost_items_insert" on public.monthly_employee_cost_items;
create policy "monthly_employee_cost_items_insert"
on public.monthly_employee_cost_items for insert to authenticated
with check (
  app.can_access_employee(employee_id, 'hr.labor_costs.manage')
  or app.can_access_employee(employee_id, 'hr.labor_costs.close_month')
);

drop policy if exists "monthly_employee_cost_items_delete" on public.monthly_employee_cost_items;

drop policy if exists "employee_movements_select" on public.employee_movements;
create policy "employee_movements_select"
on public.employee_movements for select to authenticated
using (app.can_access_employee(employee_id, 'hr.movements.view'));

drop policy if exists "employee_movements_insert" on public.employee_movements;
create policy "employee_movements_insert"
on public.employee_movements for insert to authenticated
with check (app.can_access_employee(employee_id, 'hr.movements.manage'));

drop policy if exists "employee_movements_update" on public.employee_movements;
create policy "employee_movements_update"
on public.employee_movements for update to authenticated
using (app.can_access_employee(employee_id, 'hr.movements.manage'))
with check (app.can_access_employee(employee_id, 'hr.movements.manage'));

drop policy if exists "employee_movement_cost_items_select" on public.employee_movement_cost_items;
create policy "employee_movement_cost_items_select"
on public.employee_movement_cost_items for select to authenticated
using (
  exists (
    select 1
    from public.employee_movements m
    where m.id = employee_movement_cost_items.movement_id
      and m.deleted_at is null
      and app.can_access_employee(m.employee_id, 'hr.movements.view')
  )
);

drop policy if exists "employee_movement_cost_items_insert" on public.employee_movement_cost_items;
create policy "employee_movement_cost_items_insert"
on public.employee_movement_cost_items for insert to authenticated
with check (
  exists (
    select 1
    from public.employee_movements m
    where m.id = employee_movement_cost_items.movement_id
      and m.deleted_at is null
      and app.can_access_employee(m.employee_id, 'hr.movements.manage')
  )
);

drop policy if exists "employee_movement_cost_items_update" on public.employee_movement_cost_items;
create policy "employee_movement_cost_items_update"
on public.employee_movement_cost_items for update to authenticated
using (
  exists (
    select 1
    from public.employee_movements m
    where m.id = employee_movement_cost_items.movement_id
      and m.deleted_at is null
      and app.can_access_employee(m.employee_id, 'hr.movements.manage')
  )
)
with check (
  exists (
    select 1
    from public.employee_movements m
    where m.id = employee_movement_cost_items.movement_id
      and m.deleted_at is null
      and app.can_access_employee(m.employee_id, 'hr.movements.manage')
  )
);

drop policy if exists "storage_hr_documents_select" on storage.objects;
create policy "storage_hr_documents_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'hr-documents'
  and (
    app.can_access_employee_from_storage_path(name, 'hr.documents.view')
    or app.can_access_employee_from_storage_path(name, 'hr.documents.download')
  )
);

drop policy if exists "storage_hr_documents_insert" on storage.objects;
create policy "storage_hr_documents_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'hr-documents'
  and (
    app.can_access_employee_from_storage_path(name, 'hr.documents.create')
    or app.can_access_employee_from_storage_path(name, 'hr.documents.manage')
  )
);

drop policy if exists "storage_hr_documents_update" on storage.objects;
create policy "storage_hr_documents_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'hr-documents'
  and app.can_access_employee_from_storage_path(name, 'hr.documents.manage')
)
with check (
  bucket_id = 'hr-documents'
  and app.can_access_employee_from_storage_path(name, 'hr.documents.manage')
);

drop policy if exists "storage_hr_documents_delete" on storage.objects;

commit;
