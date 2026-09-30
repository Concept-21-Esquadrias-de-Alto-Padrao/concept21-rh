begin;

create table if not exists public.monthly_employee_cost_items (
  id uuid primary key default gen_random_uuid(),
  monthly_employee_cost_id uuid not null references public.monthly_employee_costs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  cost_component_id uuid references public.cost_components(id) on delete set null,
  component_name_snapshot text not null,
  category_name_snapshot text,
  calculation_type_snapshot text,
  quantity numeric(12,4),
  unit_value numeric(14,2),
  percentage numeric(9,4),
  total_value numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint monthly_employee_cost_items_calculation_type_check check (
    calculation_type_snapshot is null or calculation_type_snapshot in (
      'fixed_monthly',
      'daily_value',
      'hourly_value',
      'percentage_base_salary',
      'percentage_total_compensation',
      'percentage_component',
      'manual_monthly',
      'formula'
    )
  )
);

create index if not exists monthly_employee_cost_items_cost_idx
on public.monthly_employee_cost_items(monthly_employee_cost_id);

create index if not exists monthly_employee_cost_items_employee_idx
on public.monthly_employee_cost_items(employee_id);

alter table public.monthly_employee_cost_items enable row level security;

drop policy if exists "monthly_employee_cost_items_select_sensitive" on public.monthly_employee_cost_items;
create policy "monthly_employee_cost_items_select_sensitive"
on public.monthly_employee_cost_items for select to authenticated
using (app.has_permission('hr.labor_costs.view_sensitive_values'));

drop policy if exists "monthly_employee_cost_items_insert" on public.monthly_employee_cost_items;
create policy "monthly_employee_cost_items_insert"
on public.monthly_employee_cost_items for insert to authenticated
with check (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.close_month')
);

drop policy if exists "monthly_employee_cost_items_delete" on public.monthly_employee_cost_items;
create policy "monthly_employee_cost_items_delete"
on public.monthly_employee_cost_items for delete to authenticated
using (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.close_month')
);

insert into public.permissions (module, action, key, description, is_sensitive)
values
  ('labor_costs', 'copy_settings', 'hr.labor_costs.copy_settings', 'Copiar configuracoes de custos entre colaboradores.', true),
  ('labor_costs', 'delete_employee_component', 'hr.labor_costs.delete_employee_component', 'Remover vinculos de componentes de custo do colaborador.', true),
  ('labor_costs', 'manage_provisions', 'hr.labor_costs.manage_provisions', 'Configurar provisoes gerenciais de custos de mao de obra.', true)
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
    'hr.labor_costs.copy_settings',
    'hr.labor_costs.delete_employee_component',
    'hr.labor_costs.manage_provisions'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
cross join public.permissions p
where r.key = 'rh'
  and p.key in (
    'hr.labor_costs.copy_settings',
    'hr.labor_costs.delete_employee_component',
    'hr.labor_costs.manage_provisions'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

drop policy if exists "labor_cost_components_insert" on public.cost_components;
create policy "labor_cost_components_insert"
on public.cost_components for insert to authenticated
with check (
  app.has_permission('hr.labor_costs.settings')
  or app.has_permission('hr.labor_costs.manage_provisions')
);

drop policy if exists "labor_cost_components_update" on public.cost_components;
create policy "labor_cost_components_update"
on public.cost_components for update to authenticated
using (
  app.has_permission('hr.labor_costs.settings')
  or app.has_permission('hr.labor_costs.manage_provisions')
)
with check (
  app.has_permission('hr.labor_costs.settings')
  or app.has_permission('hr.labor_costs.manage_provisions')
);

drop policy if exists "employee_compensations_insert" on public.employee_compensations;
create policy "employee_compensations_insert"
on public.employee_compensations for insert to authenticated
with check (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.copy_settings')
);

drop policy if exists "employee_compensations_update" on public.employee_compensations;
create policy "employee_compensations_update"
on public.employee_compensations for update to authenticated
using (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.copy_settings')
)
with check (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.copy_settings')
);

drop policy if exists "employee_cost_components_insert" on public.employee_cost_components;
create policy "employee_cost_components_insert"
on public.employee_cost_components for insert to authenticated
with check (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.copy_settings')
);

drop policy if exists "employee_cost_components_update" on public.employee_cost_components;
create policy "employee_cost_components_update"
on public.employee_cost_components for update to authenticated
using (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.copy_settings')
  or app.has_permission('hr.labor_costs.delete_employee_component')
)
with check (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.copy_settings')
  or app.has_permission('hr.labor_costs.delete_employee_component')
);

drop policy if exists "employee_cost_components_delete" on public.employee_cost_components;
create policy "employee_cost_components_delete"
on public.employee_cost_components for delete to authenticated
using (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.delete_employee_component')
  or app.has_permission('hr.labor_costs.copy_settings')
);

with provision_category as (
  select id
  from public.cost_component_categories
  where key = 'provisao'
  limit 1
)
insert into public.cost_components (
  name,
  key,
  category_id,
  description,
  calculation_type,
  default_value,
  default_percentage,
  applies_to,
  adds_to_company_cost,
  deducts_from_cost,
  is_benefit,
  is_employer_charge,
  is_provision,
  is_variable_event,
  include_in_dashboard,
  include_in_hour_cost,
  show_on_employee_profile,
  sort_order,
  is_active
)
select
  'Provisão multa rescisória FGTS',
  'provisao_multa_rescisoria_fgts',
  provision_category.id,
  'Valor mensal informado para provisao de multa rescisoria FGTS.',
  'fixed_monthly',
  0.00::numeric,
  null::numeric,
  'manual',
  true,
  false,
  false,
  false,
  true,
  false,
  true,
  true,
  true,
  24,
  true
from provision_category
on conflict (key) do update
set
  name = excluded.name,
  category_id = excluded.category_id,
  description = excluded.description,
  calculation_type = excluded.calculation_type,
  default_value = excluded.default_value,
  default_percentage = excluded.default_percentage,
  applies_to = excluded.applies_to,
  adds_to_company_cost = excluded.adds_to_company_cost,
  deducts_from_cost = excluded.deducts_from_cost,
  is_benefit = excluded.is_benefit,
  is_employer_charge = excluded.is_employer_charge,
  is_provision = excluded.is_provision,
  is_variable_event = excluded.is_variable_event,
  include_in_dashboard = excluded.include_in_dashboard,
  include_in_hour_cost = excluded.include_in_hour_cost,
  show_on_employee_profile = excluded.show_on_employee_profile,
  sort_order = excluded.sort_order,
  is_active = true;

commit;
