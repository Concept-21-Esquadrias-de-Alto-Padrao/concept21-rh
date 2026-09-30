insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hr-documents',
  'hr-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles enable row level security;
alter table public.company_units enable row level security;
alter table public.departments enable row level security;
alter table public.cost_centers enable row level security;
alter table public.positions enable row level security;
alter table public.employment_types enable row level security;
alter table public.employee_statuses enable row level security;
alter table public.termination_reasons enable row level security;
alter table public.employees enable row level security;
alter table public.employee_addresses enable row level security;
alter table public.document_types enable row level security;
alter table public.required_documents enable row level security;
alter table public.employee_documents enable row level security;
alter table public.vacations enable row level security;
alter table public.leave_types enable row level security;
alter table public.employee_leaves enable row level security;
alter table public.trainings enable row level security;
alter table public.employee_trainings enable row level security;
alter table public.occurrence_categories enable row level security;
alter table public.occurrence_types enable row level security;
alter table public.employee_occurrences enable row level security;
alter table public.employee_occurrence_attachments enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.custom_fields enable row level security;
alter table public.custom_field_options enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.alert_rules enable row level security;
alter table public.audit_logs enable row level security;
alter table public.employee_history_events enable row level security;

create policy "profiles_select_own_or_security"
on public.profiles for select to authenticated
using (
  auth_user_id = auth.uid()
  or app.has_permission('hr.security.users.view')
);

create policy "profiles_update_own"
on public.profiles for update to authenticated
using (auth_user_id = auth.uid() or app.has_permission('hr.security.users.manage'))
with check (auth_user_id = auth.uid() or app.has_permission('hr.security.users.manage'));

create policy "profiles_insert_security"
on public.profiles for insert to authenticated
with check (app.has_permission('hr.security.users.manage'));

create policy "settings_select"
on public.company_units for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "settings_insert"
on public.company_units for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "settings_update"
on public.company_units for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "departments_select"
on public.departments for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "departments_insert"
on public.departments for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "departments_update"
on public.departments for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "cost_centers_select"
on public.cost_centers for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "cost_centers_insert"
on public.cost_centers for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "cost_centers_update"
on public.cost_centers for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "positions_select"
on public.positions for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "positions_insert"
on public.positions for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "positions_update"
on public.positions for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "employment_types_select"
on public.employment_types for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "employment_types_insert"
on public.employment_types for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "employment_types_update"
on public.employment_types for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "employee_statuses_select"
on public.employee_statuses for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "employee_statuses_insert"
on public.employee_statuses for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "employee_statuses_update"
on public.employee_statuses for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "termination_reasons_select"
on public.termination_reasons for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "termination_reasons_insert"
on public.termination_reasons for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "termination_reasons_update"
on public.termination_reasons for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "employees_select"
on public.employees for select to authenticated
using (
  app.has_permission('hr.employees.view')
  or (
    app.permission_scope('hr.employees.view') = 'own_data'
    and profile_id = app.current_profile_id()
  )
);

create policy "employees_insert"
on public.employees for insert to authenticated
with check (app.has_permission('hr.employees.create'));

create policy "employees_update"
on public.employees for update to authenticated
using (app.has_permission('hr.employees.edit') or app.has_permission('hr.employees.inactivate'))
with check (app.has_permission('hr.employees.edit') or app.has_permission('hr.employees.inactivate'));

create policy "employee_addresses_select"
on public.employee_addresses for select to authenticated
using (
  app.has_permission('hr.employees.view')
  or exists (
    select 1 from public.employees e
    where e.id = employee_addresses.employee_id
      and e.profile_id = app.current_profile_id()
      and app.permission_scope('hr.employees.view') = 'own_data'
  )
);

create policy "employee_addresses_insert"
on public.employee_addresses for insert to authenticated
with check (app.has_permission('hr.employees.create') or app.has_permission('hr.employees.edit'));

create policy "employee_addresses_update"
on public.employee_addresses for update to authenticated
using (app.has_permission('hr.employees.edit'))
with check (app.has_permission('hr.employees.edit'));

create policy "document_types_select"
on public.document_types for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "document_types_insert"
on public.document_types for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "document_types_update"
on public.document_types for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "required_documents_manage_select"
on public.required_documents for select to authenticated
using (app.has_permission('hr.documents.view') or app.has_permission('hr.settings.view'));

create policy "required_documents_insert"
on public.required_documents for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "required_documents_update"
on public.required_documents for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "employee_documents_select"
on public.employee_documents for select to authenticated
using (app.has_permission('hr.documents.view'));

create policy "employee_documents_insert"
on public.employee_documents for insert to authenticated
with check (app.has_permission('hr.documents.create'));

create policy "employee_documents_update"
on public.employee_documents for update to authenticated
using (
  app.has_permission('hr.documents.create')
  or app.has_permission('hr.documents.approve')
  or app.has_permission('hr.documents.manage')
)
with check (
  app.has_permission('hr.documents.create')
  or app.has_permission('hr.documents.approve')
  or app.has_permission('hr.documents.manage')
);

create policy "vacations_select"
on public.vacations for select to authenticated
using (app.has_permission('hr.vacations.view'));

create policy "vacations_insert"
on public.vacations for insert to authenticated
with check (app.has_permission('hr.vacations.create'));

create policy "vacations_update"
on public.vacations for update to authenticated
using (app.has_permission('hr.vacations.approve') or app.has_permission('hr.vacations.create'))
with check (app.has_permission('hr.vacations.approve') or app.has_permission('hr.vacations.create'));

create policy "leave_types_select"
on public.leave_types for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "leave_types_insert"
on public.leave_types for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "leave_types_update"
on public.leave_types for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "employee_leaves_select"
on public.employee_leaves for select to authenticated
using (app.has_permission('hr.leaves.view'));

create policy "employee_leaves_insert"
on public.employee_leaves for insert to authenticated
with check (app.has_permission('hr.leaves.create'));

create policy "employee_leaves_update"
on public.employee_leaves for update to authenticated
using (app.has_permission('hr.leaves.approve') or app.has_permission('hr.leaves.create'))
with check (app.has_permission('hr.leaves.approve') or app.has_permission('hr.leaves.create'));

create policy "trainings_select"
on public.trainings for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.trainings.view'));

create policy "trainings_insert"
on public.trainings for insert to authenticated
with check (app.has_permission('hr.trainings.edit'));

create policy "trainings_update"
on public.trainings for update to authenticated
using (app.has_permission('hr.trainings.edit'))
with check (app.has_permission('hr.trainings.edit'));

create policy "employee_trainings_select"
on public.employee_trainings for select to authenticated
using (app.has_permission('hr.trainings.view'));

create policy "employee_trainings_insert"
on public.employee_trainings for insert to authenticated
with check (app.has_permission('hr.trainings.edit'));

create policy "employee_trainings_update"
on public.employee_trainings for update to authenticated
using (app.has_permission('hr.trainings.edit'))
with check (app.has_permission('hr.trainings.edit'));

create policy "occurrence_categories_select"
on public.occurrence_categories for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "occurrence_categories_insert"
on public.occurrence_categories for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "occurrence_categories_update"
on public.occurrence_categories for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "occurrence_types_select"
on public.occurrence_types for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "occurrence_types_insert"
on public.occurrence_types for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "occurrence_types_update"
on public.occurrence_types for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "employee_occurrences_select"
on public.employee_occurrences for select to authenticated
using (app.has_permission('hr.occurrences.view'));

create policy "employee_occurrences_insert"
on public.employee_occurrences for insert to authenticated
with check (app.has_permission('hr.occurrences.create'));

create policy "employee_occurrences_update"
on public.employee_occurrences for update to authenticated
using (app.has_permission('hr.occurrences.edit'))
with check (app.has_permission('hr.occurrences.edit'));

create policy "employee_occurrence_attachments_select"
on public.employee_occurrence_attachments for select to authenticated
using (app.has_permission('hr.occurrences.view'));

create policy "employee_occurrence_attachments_insert"
on public.employee_occurrence_attachments for insert to authenticated
with check (app.has_permission('hr.occurrences.create'));

create policy "roles_select"
on public.roles for select to authenticated
using (app.has_permission('hr.security.users.view') or app.has_permission('hr.settings.view'));

create policy "roles_insert"
on public.roles for insert to authenticated
with check (app.has_permission('hr.security.users.manage'));

create policy "roles_update"
on public.roles for update to authenticated
using (app.has_permission('hr.security.users.manage'))
with check (app.has_permission('hr.security.users.manage'));

create policy "permissions_select"
on public.permissions for select to authenticated
using (app.has_permission('hr.security.users.view') or app.has_permission('hr.settings.view'));

create policy "role_permissions_select"
on public.role_permissions for select to authenticated
using (app.has_permission('hr.security.users.view') or app.has_permission('hr.settings.view'));

create policy "role_permissions_insert"
on public.role_permissions for insert to authenticated
with check (app.has_permission('hr.security.users.manage'));

create policy "role_permissions_update"
on public.role_permissions for update to authenticated
using (app.has_permission('hr.security.users.manage'))
with check (app.has_permission('hr.security.users.manage'));

create policy "role_permissions_delete"
on public.role_permissions for delete to authenticated
using (app.has_permission('hr.security.users.manage'));

create policy "user_roles_select"
on public.user_roles for select to authenticated
using (app.has_permission('hr.security.users.view') or profile_id = app.current_profile_id());

create policy "user_roles_insert"
on public.user_roles for insert to authenticated
with check (app.has_permission('hr.security.users.manage'));

create policy "user_roles_update"
on public.user_roles for update to authenticated
using (app.has_permission('hr.security.users.manage'))
with check (app.has_permission('hr.security.users.manage'));

create policy "custom_fields_select"
on public.custom_fields for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "custom_fields_insert"
on public.custom_fields for insert to authenticated
with check (app.has_permission('hr.custom_fields.manage'));

create policy "custom_fields_update"
on public.custom_fields for update to authenticated
using (app.has_permission('hr.custom_fields.manage'))
with check (app.has_permission('hr.custom_fields.manage'));

create policy "custom_field_options_select"
on public.custom_field_options for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view'));

create policy "custom_field_options_insert"
on public.custom_field_options for insert to authenticated
with check (app.has_permission('hr.custom_fields.manage'));

create policy "custom_field_options_update"
on public.custom_field_options for update to authenticated
using (app.has_permission('hr.custom_fields.manage'))
with check (app.has_permission('hr.custom_fields.manage'));

create policy "custom_field_values_select"
on public.custom_field_values for select to authenticated
using (app.can_access_hr());

create policy "custom_field_values_insert"
on public.custom_field_values for insert to authenticated
with check (app.can_access_hr());

create policy "custom_field_values_update"
on public.custom_field_values for update to authenticated
using (app.can_access_hr())
with check (app.can_access_hr());

create policy "alert_rules_select"
on public.alert_rules for select to authenticated
using (app.has_permission('hr.settings.view'));

create policy "alert_rules_insert"
on public.alert_rules for insert to authenticated
with check (app.has_permission('hr.settings.manage'));

create policy "alert_rules_update"
on public.alert_rules for update to authenticated
using (app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.settings.manage'));

create policy "audit_logs_select"
on public.audit_logs for select to authenticated
using (app.has_permission('hr.audit.view'));

create policy "audit_logs_insert"
on public.audit_logs for insert to authenticated
with check (app.can_access_hr() or app.has_permission('hr.audit.create'));

create policy "employee_history_events_select"
on public.employee_history_events for select to authenticated
using (app.has_permission('hr.employees.view'));

create policy "employee_history_events_insert"
on public.employee_history_events for insert to authenticated
with check (app.can_access_hr());

create policy "storage_hr_documents_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'hr-documents'
  and (
    app.has_permission('hr.documents.view')
    or app.has_permission('hr.documents.download')
  )
);

create policy "storage_hr_documents_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'hr-documents'
  and (
    app.has_permission('hr.documents.create')
    or app.has_permission('hr.documents.manage')
  )
);

create policy "storage_hr_documents_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'hr-documents'
  and app.has_permission('hr.documents.manage')
)
with check (
  bucket_id = 'hr-documents'
  and app.has_permission('hr.documents.manage')
);

create policy "storage_hr_documents_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'hr-documents'
  and app.has_permission('hr.documents.manage')
);
