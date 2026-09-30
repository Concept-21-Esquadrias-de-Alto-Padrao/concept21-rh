begin;

insert into public.permissions (module, action, key, description, is_sensitive)
values
  ('dashboard', 'turnover_view', 'hr.dashboard.turnover.view', 'Visualizar indicadores de turnover do dashboard de RH.', true),
  ('dashboard', 'costs_view', 'hr.dashboard.costs.view', 'Visualizar indicadores financeiros do dashboard de RH.', true),
  ('dashboard', 'charts_view', 'hr.dashboard.charts.view', 'Visualizar graficos gerenciais do dashboard de RH.', false)
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
where r.key in ('master', 'rh', 'diretoria')
  and p.key in (
    'hr.dashboard.turnover.view',
    'hr.dashboard.costs.view',
    'hr.dashboard.charts.view'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
cross join public.permissions p
where r.key = 'financeiro'
  and p.key in (
    'hr.dashboard.costs.view',
    'hr.dashboard.charts.view'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'own_department'
from public.roles r
cross join public.permissions p
where r.key = 'gestor'
  and p.key in (
    'hr.dashboard.turnover.view',
    'hr.dashboard.charts.view'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

commit;
