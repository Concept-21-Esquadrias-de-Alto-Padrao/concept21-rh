begin;

-- RLS policies are permissive (OR). Remove older non-master delete policies first
-- so hard deletes in HR are reserved exclusively for the Master role.
do $$
begin
  if to_regclass('public.role_permissions') is not null then
    execute 'drop policy if exists "role_permissions_delete" on public.role_permissions';
  end if;

  if to_regclass('public.employee_cost_components') is not null then
    execute 'drop policy if exists "employee_cost_components_delete" on public.employee_cost_components';
  end if;

  if to_regclass('public.monthly_employee_cost_items') is not null then
    execute 'drop policy if exists "monthly_employee_cost_items_delete" on public.monthly_employee_cost_items';
  end if;

  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "storage_hr_documents_delete" on storage.objects';
    execute 'drop policy if exists "storage_hr_documents_master_delete" on storage.objects';
  end if;
end $$;

do $$
declare
  target_table text;
  target_tables text[] := array[
    'profiles',
    'company_units',
    'departments',
    'cost_centers',
    'positions',
    'employment_types',
    'employee_statuses',
    'termination_reasons',
    'employees',
    'employee_addresses',
    'document_types',
    'required_documents',
    'employee_documents',
    'vacations',
    'leave_types',
    'employee_leaves',
    'trainings',
    'employee_trainings',
    'occurrence_categories',
    'occurrence_types',
    'employee_occurrences',
    'employee_occurrence_attachments',
    'roles',
    'permissions',
    'role_permissions',
    'user_roles',
    'custom_fields',
    'custom_field_options',
    'custom_field_values',
    'alert_rules',
    'audit_logs',
    'employee_history_events',
    'daily_occurrence_reports',
    'daily_occurrence_report_items',
    'cost_component_categories',
    'cost_components',
    'employee_compensations',
    'employee_cost_components',
    'employee_monthly_cost_events',
    'monthly_employee_costs',
    'occurrence_cost_rules',
    'monthly_employee_cost_items',
    'marital_statuses',
    'dependent_relationship_types',
    'employee_dependents',
    'access_review_requests',
    'platform_notifications',
    'email_notification_queue'
  ];
begin
  foreach target_table in array target_tables loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('drop policy if exists %I on public.%I', 'master_delete', target_table);
      execute format(
        'create policy %I on public.%I for delete to authenticated using (app.has_role(%L))',
        'master_delete',
        target_table,
        'master'
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $policy$
      create policy "storage_hr_documents_master_delete"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'hr-documents'
        and app.has_role('master')
      )
    $policy$;
  end if;
end $$;

commit;
