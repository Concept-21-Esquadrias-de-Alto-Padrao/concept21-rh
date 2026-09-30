begin;

create table if not exists public.cost_component_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.cost_components (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.cost_component_categories(id),
  name text not null,
  key text not null unique,
  description text,
  calculation_type text not null default 'fixed_monthly',
  default_value numeric(14,2),
  default_percentage numeric(9,4),
  applies_to text not null default 'manual',
  employment_type_id uuid references public.employment_types(id),
  department_id uuid references public.departments(id),
  position_id uuid references public.positions(id),
  adds_to_company_cost boolean not null default true,
  deducts_from_cost boolean not null default false,
  is_benefit boolean not null default false,
  is_employer_charge boolean not null default false,
  is_provision boolean not null default false,
  is_variable_event boolean not null default false,
  include_in_dashboard boolean not null default true,
  include_in_hour_cost boolean not null default true,
  show_on_employee_profile boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint cost_components_calculation_type_check check (
    calculation_type in (
      'fixed_monthly',
      'daily_value',
      'hourly_value',
      'percentage_base_salary',
      'percentage_total_compensation',
      'percentage_component',
      'manual_monthly',
      'formula'
    )
  ),
  constraint cost_components_applies_to_check check (
    applies_to in (
      'all_employees',
      'employment_type',
      'department',
      'position',
      'specific_employee',
      'manual'
    )
  ),
  constraint cost_components_default_value_non_negative check (
    default_value is null or default_value >= 0
  ),
  constraint cost_components_default_percentage_non_negative check (
    default_percentage is null or default_percentage >= 0
  )
);

create table if not exists public.employee_compensations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  base_salary numeric(14,2) not null,
  monthly_hours numeric(8,2) not null,
  hourly_base_rate numeric(14,4) not null,
  employment_type_id uuid references public.employment_types(id),
  effective_from date not null,
  effective_until date,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_compensations_base_salary_non_negative check (base_salary >= 0),
  constraint employee_compensations_monthly_hours_positive check (monthly_hours > 0),
  constraint employee_compensations_effective_period_check check (
    effective_until is null or effective_until >= effective_from
  ),
  constraint employee_compensations_unique_start unique (employee_id, effective_from)
);

create unique index if not exists employee_compensations_one_open_active_idx
on public.employee_compensations(employee_id)
where is_active = true and deleted_at is null and effective_until is null;

create table if not exists public.employee_cost_components (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  cost_component_id uuid not null references public.cost_components(id) on delete restrict,
  calculation_type text,
  value numeric(14,2),
  percentage numeric(9,4),
  quantity numeric(12,4),
  effective_from date not null,
  effective_until date,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_cost_components_calculation_type_check check (
    calculation_type is null or calculation_type in (
      'fixed_monthly',
      'daily_value',
      'hourly_value',
      'percentage_base_salary',
      'percentage_total_compensation',
      'percentage_component',
      'manual_monthly',
      'formula'
    )
  ),
  constraint employee_cost_components_value_non_negative check (value is null or value >= 0),
  constraint employee_cost_components_percentage_non_negative check (percentage is null or percentage >= 0),
  constraint employee_cost_components_quantity_non_negative check (quantity is null or quantity >= 0),
  constraint employee_cost_components_effective_period_check check (
    effective_until is null or effective_until >= effective_from
  ),
  constraint employee_cost_components_unique_start unique (
    employee_id,
    cost_component_id,
    effective_from
  )
);

create table if not exists public.employee_monthly_cost_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  reference_month date not null,
  cost_component_id uuid not null references public.cost_components(id) on delete restrict,
  description text not null,
  quantity numeric(12,4) not null default 1,
  unit_value numeric(14,2) not null default 0,
  total_value numeric(14,2) not null default 0,
  source text not null default 'manual',
  status text not null default 'pending',
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_monthly_cost_events_month_start_check check (
    reference_month = date_trunc('month', reference_month)::date
  ),
  constraint employee_monthly_cost_events_source_check check (
    source in ('manual', 'occurrence', 'import', 'automatic_calculation', 'financial_adjustment')
  ),
  constraint employee_monthly_cost_events_status_check check (
    status in ('pending', 'included', 'ignored', 'cancelled')
  ),
  constraint employee_monthly_cost_events_quantity_non_negative check (quantity >= 0)
);

create table if not exists public.monthly_employee_costs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  reference_month date not null,
  base_salary numeric(14,2) not null default 0,
  fixed_compensation_total numeric(14,2) not null default 0,
  benefits_total numeric(14,2) not null default 0,
  allowances_total numeric(14,2) not null default 0,
  employer_charges_total numeric(14,2) not null default 0,
  provisions_total numeric(14,2) not null default 0,
  variable_events_total numeric(14,2) not null default 0,
  reimbursements_total numeric(14,2) not null default 0,
  deductions_total numeric(14,2) not null default 0,
  total_company_cost numeric(14,2) not null default 0,
  contracted_hours numeric(8,2),
  worked_hours numeric(8,2),
  productive_hours numeric(8,2),
  contractual_hour_cost numeric(14,4),
  worked_hour_cost numeric(14,4),
  productive_hour_cost numeric(14,4),
  status text not null default 'estimated',
  calculated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint monthly_employee_costs_month_start_check check (
    reference_month = date_trunc('month', reference_month)::date
  ),
  constraint monthly_employee_costs_status_check check (
    status in ('estimated', 'reviewing', 'closed', 'reopened', 'cancelled')
  ),
  constraint monthly_employee_costs_unique_employee_month unique (employee_id, reference_month)
);

create table if not exists public.occurrence_cost_rules (
  id uuid primary key default gen_random_uuid(),
  occurrence_type_id uuid not null unique references public.occurrence_types(id) on delete cascade,
  reduces_worked_hours boolean not null default false,
  generates_discount boolean not null default false,
  impacts_attendance_bonus boolean not null default false,
  default_hours_impact numeric(8,2),
  default_cost_component_id uuid references public.cost_components(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint occurrence_cost_rules_hours_non_negative check (
    default_hours_impact is null or default_hours_impact >= 0
  )
);

create index if not exists cost_component_categories_active_idx on public.cost_component_categories(is_active);
create index if not exists cost_components_category_idx on public.cost_components(category_id);
create index if not exists cost_components_active_idx on public.cost_components(is_active);
create index if not exists cost_components_applies_to_idx on public.cost_components(applies_to);
create index if not exists employee_compensations_employee_idx on public.employee_compensations(employee_id);
create index if not exists employee_compensations_effective_idx on public.employee_compensations(employee_id, effective_from, effective_until);
create index if not exists employee_cost_components_employee_idx on public.employee_cost_components(employee_id);
create index if not exists employee_cost_components_component_idx on public.employee_cost_components(cost_component_id);
create index if not exists employee_monthly_cost_events_employee_month_idx on public.employee_monthly_cost_events(employee_id, reference_month);
create index if not exists employee_monthly_cost_events_component_idx on public.employee_monthly_cost_events(cost_component_id);
create index if not exists monthly_employee_costs_reference_month_idx on public.monthly_employee_costs(reference_month);
create index if not exists monthly_employee_costs_employee_idx on public.monthly_employee_costs(employee_id);
create index if not exists occurrence_cost_rules_type_idx on public.occurrence_cost_rules(occurrence_type_id);

create trigger set_cost_component_categories_updated_at
before update on public.cost_component_categories
for each row execute function app.set_updated_at();

create trigger set_cost_components_updated_at
before update on public.cost_components
for each row execute function app.set_updated_at();

create trigger set_employee_compensations_updated_at
before update on public.employee_compensations
for each row execute function app.set_updated_at();

create trigger set_employee_cost_components_updated_at
before update on public.employee_cost_components
for each row execute function app.set_updated_at();

create trigger set_employee_monthly_cost_events_updated_at
before update on public.employee_monthly_cost_events
for each row execute function app.set_updated_at();

create trigger set_monthly_employee_costs_updated_at
before update on public.monthly_employee_costs
for each row execute function app.set_updated_at();

create trigger set_occurrence_cost_rules_updated_at
before update on public.occurrence_cost_rules
for each row execute function app.set_updated_at();

alter table public.cost_component_categories enable row level security;
alter table public.cost_components enable row level security;
alter table public.employee_compensations enable row level security;
alter table public.employee_cost_components enable row level security;
alter table public.employee_monthly_cost_events enable row level security;
alter table public.monthly_employee_costs enable row level security;
alter table public.occurrence_cost_rules enable row level security;

create policy "labor_cost_settings_select"
on public.cost_component_categories for select to authenticated
using (
  app.has_permission('hr.labor_costs.settings')
  or app.has_permission('hr.labor_costs.view')
  or app.has_permission('hr.labor_costs.view_sensitive_values')
);

create policy "labor_cost_settings_insert"
on public.cost_component_categories for insert to authenticated
with check (app.has_permission('hr.labor_costs.settings'));

create policy "labor_cost_settings_update"
on public.cost_component_categories for update to authenticated
using (app.has_permission('hr.labor_costs.settings'))
with check (app.has_permission('hr.labor_costs.settings'));

create policy "labor_cost_components_select"
on public.cost_components for select to authenticated
using (
  app.has_permission('hr.labor_costs.settings')
  or app.has_permission('hr.labor_costs.view')
  or app.has_permission('hr.labor_costs.view_sensitive_values')
);

create policy "labor_cost_components_insert"
on public.cost_components for insert to authenticated
with check (app.has_permission('hr.labor_costs.settings'));

create policy "labor_cost_components_update"
on public.cost_components for update to authenticated
using (app.has_permission('hr.labor_costs.settings'))
with check (app.has_permission('hr.labor_costs.settings'));

create policy "employee_compensations_select_sensitive"
on public.employee_compensations for select to authenticated
using (app.has_permission('hr.labor_costs.view_sensitive_values'));

create policy "employee_compensations_insert"
on public.employee_compensations for insert to authenticated
with check (app.has_permission('hr.labor_costs.manage'));

create policy "employee_compensations_update"
on public.employee_compensations for update to authenticated
using (app.has_permission('hr.labor_costs.manage'))
with check (app.has_permission('hr.labor_costs.manage'));

create policy "employee_cost_components_select_sensitive"
on public.employee_cost_components for select to authenticated
using (app.has_permission('hr.labor_costs.view_sensitive_values'));

create policy "employee_cost_components_insert"
on public.employee_cost_components for insert to authenticated
with check (app.has_permission('hr.labor_costs.manage'));

create policy "employee_cost_components_update"
on public.employee_cost_components for update to authenticated
using (app.has_permission('hr.labor_costs.manage'))
with check (app.has_permission('hr.labor_costs.manage'));

create policy "employee_monthly_cost_events_select_sensitive"
on public.employee_monthly_cost_events for select to authenticated
using (app.has_permission('hr.labor_costs.view_sensitive_values'));

create policy "employee_monthly_cost_events_insert"
on public.employee_monthly_cost_events for insert to authenticated
with check (app.has_permission('hr.labor_costs.manage'));

create policy "employee_monthly_cost_events_update"
on public.employee_monthly_cost_events for update to authenticated
using (app.has_permission('hr.labor_costs.manage'))
with check (app.has_permission('hr.labor_costs.manage'));

create policy "monthly_employee_costs_select_sensitive"
on public.monthly_employee_costs for select to authenticated
using (app.has_permission('hr.labor_costs.view_sensitive_values'));

create policy "monthly_employee_costs_insert"
on public.monthly_employee_costs for insert to authenticated
with check (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.close_month')
);

create policy "monthly_employee_costs_update"
on public.monthly_employee_costs for update to authenticated
using (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.close_month')
)
with check (
  app.has_permission('hr.labor_costs.manage')
  or app.has_permission('hr.labor_costs.close_month')
);

create policy "occurrence_cost_rules_select"
on public.occurrence_cost_rules for select to authenticated
using (
  app.has_permission('hr.labor_costs.settings')
  or app.has_permission('hr.labor_costs.view_sensitive_values')
);

create policy "occurrence_cost_rules_insert"
on public.occurrence_cost_rules for insert to authenticated
with check (app.has_permission('hr.labor_costs.settings'));

create policy "occurrence_cost_rules_update"
on public.occurrence_cost_rules for update to authenticated
using (app.has_permission('hr.labor_costs.settings'))
with check (app.has_permission('hr.labor_costs.settings'));

insert into public.permissions (module, action, key, description, is_sensitive)
values
  ('labor_costs', 'view', 'hr.labor_costs.view', 'Visualizar estrutura gerencial de custos de mão de obra.', true),
  ('labor_costs', 'manage', 'hr.labor_costs.manage', 'Gerenciar remuneração, benefícios, eventos e custos de colaboradores.', true),
  ('labor_costs', 'close_month', 'hr.labor_costs.close_month', 'Conferir, fechar e reabrir custos mensais de mão de obra.', true),
  ('labor_costs', 'view_sensitive_values', 'hr.labor_costs.view_sensitive_values', 'Visualizar valores salariais e custos sensíveis.', true),
  ('labor_costs', 'dashboard', 'hr.labor_costs.dashboard', 'Visualizar indicadores gerenciais de custos de mão de obra.', true),
  ('labor_costs', 'settings', 'hr.labor_costs.settings', 'Configurar categorias, componentes e regras de custos de mão de obra.', true)
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
  and p.key like 'hr.labor_costs.%'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.labor_costs.view',
  'hr.labor_costs.manage',
  'hr.labor_costs.close_month',
  'hr.labor_costs.view_sensitive_values',
  'hr.labor_costs.dashboard',
  'hr.labor_costs.settings'
)
where r.key = 'rh'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.labor_costs.view',
  'hr.labor_costs.close_month',
  'hr.labor_costs.view_sensitive_values',
  'hr.labor_costs.dashboard'
)
where r.key = 'financeiro'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.labor_costs.view',
  'hr.labor_costs.view_sensitive_values',
  'hr.labor_costs.dashboard'
)
where r.key = 'diretoria'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

create or replace function app.can_access_hr()
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select app.has_role('master')
    or app.has_permission('hr.dashboard.view')
    or app.has_permission('hr.employees.view')
    or app.has_permission('hr.documents.view')
    or app.has_permission('hr.labor_costs.dashboard')
$$;

commit;
