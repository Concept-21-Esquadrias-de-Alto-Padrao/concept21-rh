begin;

alter table public.occurrence_types
  add column if not exists include_in_daily_report boolean not null default false,
  add column if not exists counts_as_absence boolean not null default false,
  add column if not exists counts_as_medical_certificate boolean not null default false,
  add column if not exists priority_order integer not null default 99;

alter table public.employee_occurrences
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists total_days integer,
  add column if not exists justification_summary text,
  add column if not exists internal_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employee_occurrences_period_check'
  ) then
    alter table public.employee_occurrences
      add constraint employee_occurrences_period_check
      check (end_date is null or start_date is null or end_date >= start_date);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'employee_occurrences_total_days_positive'
  ) then
    alter table public.employee_occurrences
      add constraint employee_occurrences_total_days_positive
      check (total_days is null or total_days > 0);
  end if;
end $$;

update public.employee_occurrences eo
set department_id = e.department_id
from public.employees e
where eo.employee_id = e.id
  and eo.department_id is null;

update public.employee_occurrences
set start_date = occurred_at::date
where start_date is null;

update public.employee_occurrences
set total_days = greatest(1, (end_date - start_date + 1))
where total_days is null
  and start_date is not null
  and end_date is not null;

create table if not exists public.daily_occurrence_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  generated_text text not null,
  edited_text text,
  generated_by uuid references auth.users(id),
  copied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_occurrence_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_occurrence_reports(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  occurrence_id uuid references public.employee_occurrences(id) on delete set null,
  occurrence_type_id uuid references public.occurrence_types(id) on delete set null,
  display_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists employee_occurrences_report_date_idx
  on public.employee_occurrences(start_date, end_date);

create index if not exists employee_occurrences_department_idx
  on public.employee_occurrences(department_id);

create index if not exists occurrence_types_daily_report_idx
  on public.occurrence_types(include_in_daily_report, priority_order);

create index if not exists daily_occurrence_reports_date_idx
  on public.daily_occurrence_reports(report_date desc);

create index if not exists daily_occurrence_reports_generated_by_idx
  on public.daily_occurrence_reports(generated_by);

create index if not exists daily_occurrence_report_items_report_idx
  on public.daily_occurrence_report_items(report_id);

drop trigger if exists set_daily_occurrence_reports_updated_at on public.daily_occurrence_reports;
create trigger set_daily_occurrence_reports_updated_at
before update on public.daily_occurrence_reports
for each row execute function app.set_updated_at();

alter table public.daily_occurrence_reports enable row level security;
alter table public.daily_occurrence_report_items enable row level security;

drop policy if exists "daily_occurrence_reports_select" on public.daily_occurrence_reports;
create policy "daily_occurrence_reports_select"
on public.daily_occurrence_reports for select to authenticated
using (
  app.has_permission('hr.occurrences.daily_report.view')
  or app.has_permission('hr.occurrences.daily_report.history')
);

drop policy if exists "daily_occurrence_reports_insert" on public.daily_occurrence_reports;
create policy "daily_occurrence_reports_insert"
on public.daily_occurrence_reports for insert to authenticated
with check (app.has_permission('hr.occurrences.daily_report.generate'));

drop policy if exists "daily_occurrence_reports_update" on public.daily_occurrence_reports;
create policy "daily_occurrence_reports_update"
on public.daily_occurrence_reports for update to authenticated
using (
  app.has_permission('hr.occurrences.daily_report.generate')
  or app.has_permission('hr.occurrences.daily_report.copy')
)
with check (
  app.has_permission('hr.occurrences.daily_report.generate')
  or app.has_permission('hr.occurrences.daily_report.copy')
);

drop policy if exists "daily_occurrence_report_items_select" on public.daily_occurrence_report_items;
create policy "daily_occurrence_report_items_select"
on public.daily_occurrence_report_items for select to authenticated
using (
  app.has_permission('hr.occurrences.daily_report.view')
  or app.has_permission('hr.occurrences.daily_report.history')
);

drop policy if exists "daily_occurrence_report_items_insert" on public.daily_occurrence_report_items;
create policy "daily_occurrence_report_items_insert"
on public.daily_occurrence_report_items for insert to authenticated
with check (app.has_permission('hr.occurrences.daily_report.generate'));

insert into public.permissions (module, action, key, description, is_sensitive)
values
  ('occurrences', 'daily_report_view', 'hr.occurrences.daily_report.view', 'Visualizar o relatório diário de ocorrências.', true),
  ('occurrences', 'daily_report_generate', 'hr.occurrences.daily_report.generate', 'Gerar relatório diário de ocorrências.', true),
  ('occurrences', 'daily_report_copy', 'hr.occurrences.daily_report.copy', 'Copiar relatório diário de ocorrências.', true),
  ('occurrences', 'daily_report_history', 'hr.occurrences.daily_report.history', 'Visualizar histórico de relatórios diários de ocorrências.', true)
on conflict (key) do update
set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  is_active = true;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
cross join public.permissions p
where r.key = 'master'
  and p.key in (
    'hr.occurrences.daily_report.view',
    'hr.occurrences.daily_report.generate',
    'hr.occurrences.daily_report.copy',
    'hr.occurrences.daily_report.history'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.occurrences.daily_report.view',
  'hr.occurrences.daily_report.generate',
  'hr.occurrences.daily_report.copy',
  'hr.occurrences.daily_report.history'
)
where r.key = 'rh'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.occurrences.daily_report.view',
  'hr.occurrences.daily_report.history'
)
where r.key = 'diretoria'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.occurrence_categories (name, key, description, sort_order)
values
  ('Ausências', 'ausencias', 'Faltas, atestados, afastamentos e ausências operacionais.', 8)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.occurrence_types (
  name,
  key,
  occurrence_category_id,
  description,
  requires_attachment,
  requires_approval,
  visible_to_employee,
  visible_to_manager,
  generates_alert,
  impacts_history,
  include_in_daily_report,
  counts_as_absence,
  counts_as_medical_certificate,
  priority_order,
  sort_order
)
values
  ('Atestado médico', 'atestado_medico_ocorrencia', (select id from public.occurrence_categories where key = 'ausencias'), 'Atestado médico informado textualmente, sem anexo obrigatório.', false, false, false, true, true, true, true, true, true, 1, 80),
  ('Afastamento', 'afastamento_ocorrencia', (select id from public.occurrence_categories where key = 'ausencias'), 'Afastamento operacional informado no módulo de ocorrências.', false, false, false, true, true, true, true, true, false, 2, 81),
  ('Falta justificada', 'falta_justificada', (select id from public.occurrence_categories where key = 'ausencias'), 'Falta com justificativa resumida.', false, false, false, true, true, true, true, true, false, 3, 82),
  ('Falta sem justificativa', 'falta_sem_justificativa', (select id from public.occurrence_categories where key = 'ausencias'), 'Falta sem justificativa registrada.', false, false, false, true, true, true, true, true, false, 4, 83),
  ('Ausência parcial', 'ausencia_parcial', (select id from public.occurrence_categories where key = 'ausencias'), 'Ausência parcial no expediente.', false, false, false, true, true, true, true, true, false, 5, 84)
on conflict (key) do update
set
  name = excluded.name,
  occurrence_category_id = excluded.occurrence_category_id,
  description = excluded.description,
  requires_attachment = excluded.requires_attachment,
  requires_approval = excluded.requires_approval,
  visible_to_employee = excluded.visible_to_employee,
  visible_to_manager = excluded.visible_to_manager,
  generates_alert = excluded.generates_alert,
  impacts_history = excluded.impacts_history,
  include_in_daily_report = excluded.include_in_daily_report,
  counts_as_absence = excluded.counts_as_absence,
  counts_as_medical_certificate = excluded.counts_as_medical_certificate,
  priority_order = excluded.priority_order,
  sort_order = excluded.sort_order;

update public.occurrence_types
set
  include_in_daily_report = true,
  counts_as_absence = true,
  counts_as_medical_certificate = false,
  priority_order = 4
where key = 'falta';

commit;
