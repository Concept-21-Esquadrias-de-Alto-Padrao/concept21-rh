begin;

insert into public.permissions (module, action, key, description, is_sensitive)
values
  ('occurrences', 'monthly_report_view', 'hr.occurrences.monthly_report.view', 'Visualizar relatório mensal de ocorrências.', true),
  ('occurrences', 'monthly_report_generate', 'hr.occurrences.monthly_report.generate', 'Gerar PDF do relatório mensal de ocorrências.', true)
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
    'hr.occurrences.monthly_report.view',
    'hr.occurrences.monthly_report.generate'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.occurrences.monthly_report.view',
  'hr.occurrences.monthly_report.generate'
)
where r.key = 'rh'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.occurrences.monthly_report.view'
)
where r.key = 'diretoria'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

commit;
