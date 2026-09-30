begin;

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
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

update public.occurrence_types
set
  include_in_daily_report = true,
  counts_as_absence = true,
  counts_as_medical_certificate = false,
  priority_order = 4,
  is_active = true,
  updated_at = now()
where key = 'falta_sem_justificativa';

update public.occurrence_types
set
  name = 'Falta sem justificativa (substituída)',
  include_in_daily_report = false,
  counts_as_absence = false,
  counts_as_medical_certificate = false,
  priority_order = 999,
  sort_order = 999,
  is_active = false,
  updated_at = now()
where key = 'falta';

commit;
