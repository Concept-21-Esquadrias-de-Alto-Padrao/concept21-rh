begin;

create table if not exists public.employee_movements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  movement_type text not null,
  movement_date date not null,
  reference_month date not null,
  termination_reason_id uuid references public.termination_reasons(id),
  status text not null default 'completed',
  notes text,
  total_amount numeric(14, 2) not null default 0,
  custom_values jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_movements_type_check check (movement_type in ('admission', 'termination')),
  constraint employee_movements_status_check check (status in ('planned', 'completed', 'cancelled')),
  constraint employee_movements_reference_month_check check (extract(day from reference_month) = 1),
  constraint employee_movements_termination_reason_check check (
    movement_type = 'termination' or termination_reason_id is null
  )
);

create table if not exists public.employee_movement_cost_items (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.employee_movements(id) on delete cascade,
  description text not null,
  cost_category text not null default 'other',
  amount numeric(14, 2) not null default 0,
  is_deduction boolean not null default false,
  notes text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_movement_cost_items_amount_check check (amount >= 0)
);

create index if not exists employee_movements_employee_idx
on public.employee_movements(employee_id);

create index if not exists employee_movements_type_date_idx
on public.employee_movements(movement_type, movement_date);

create index if not exists employee_movements_reference_month_idx
on public.employee_movements(reference_month);

create index if not exists employee_movements_reason_idx
on public.employee_movements(termination_reason_id);

create index if not exists employee_movement_cost_items_movement_idx
on public.employee_movement_cost_items(movement_id);

drop trigger if exists set_employee_movements_updated_at on public.employee_movements;
create trigger set_employee_movements_updated_at
before update on public.employee_movements
for each row execute function app.set_updated_at();

drop trigger if exists set_employee_movement_cost_items_updated_at on public.employee_movement_cost_items;
create trigger set_employee_movement_cost_items_updated_at
before update on public.employee_movement_cost_items
for each row execute function app.set_updated_at();

alter table public.employee_movements enable row level security;
alter table public.employee_movement_cost_items enable row level security;

drop policy if exists "employee_movements_select" on public.employee_movements;
create policy "employee_movements_select"
on public.employee_movements for select to authenticated
using (app.has_permission('hr.movements.view'));

drop policy if exists "employee_movements_insert" on public.employee_movements;
create policy "employee_movements_insert"
on public.employee_movements for insert to authenticated
with check (app.has_permission('hr.movements.manage'));

drop policy if exists "employee_movements_update" on public.employee_movements;
create policy "employee_movements_update"
on public.employee_movements for update to authenticated
using (app.has_permission('hr.movements.manage'))
with check (app.has_permission('hr.movements.manage'));

drop policy if exists "employee_movements_master_delete" on public.employee_movements;
create policy "employee_movements_master_delete"
on public.employee_movements for delete to authenticated
using (app.has_role('master'));

drop policy if exists "employee_movement_cost_items_select" on public.employee_movement_cost_items;
create policy "employee_movement_cost_items_select"
on public.employee_movement_cost_items for select to authenticated
using (app.has_permission('hr.movements.view'));

drop policy if exists "employee_movement_cost_items_insert" on public.employee_movement_cost_items;
create policy "employee_movement_cost_items_insert"
on public.employee_movement_cost_items for insert to authenticated
with check (app.has_permission('hr.movements.manage'));

drop policy if exists "employee_movement_cost_items_update" on public.employee_movement_cost_items;
create policy "employee_movement_cost_items_update"
on public.employee_movement_cost_items for update to authenticated
using (app.has_permission('hr.movements.manage'))
with check (app.has_permission('hr.movements.manage'));

drop policy if exists "employee_movement_cost_items_master_delete" on public.employee_movement_cost_items;
create policy "employee_movement_cost_items_master_delete"
on public.employee_movement_cost_items for delete to authenticated
using (app.has_role('master'));

insert into public.permissions (module, action, key, description, is_sensitive)
values
  ('movements', 'view', 'hr.movements.view', 'Visualizar admissoes, desligamentos e custos associados.', true),
  ('movements', 'manage', 'hr.movements.manage', 'Cadastrar e gerenciar admissoes, desligamentos e custos associados.', true),
  ('movements', 'view_sensitive_values', 'hr.movements.view_sensitive_values', 'Visualizar valores financeiros de admissao e desligamento.', true)
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
  and p.key like 'hr.movements.%'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.movements.view',
  'hr.movements.manage',
  'hr.movements.view_sensitive_values'
)
where r.key in ('rh', 'financeiro')
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.movements.view',
  'hr.movements.view_sensitive_values'
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
    or app.has_permission('hr.movements.view')
$$;

insert into public.employee_movements (
  employee_id,
  movement_type,
  movement_date,
  reference_month,
  status,
  notes,
  total_amount,
  created_by,
  updated_by
)
select
  e.id,
  'admission',
  e.hire_date,
  date_trunc('month', e.hire_date::timestamp)::date,
  'completed',
  'Registro criado automaticamente a partir da data de admissao do colaborador.',
  0,
  e.created_by,
  e.updated_by
from public.employees e
where e.deleted_at is null
  and e.hire_date is not null
  and not exists (
    select 1
    from public.employee_movements m
    where m.employee_id = e.id
      and m.movement_type = 'admission'
      and m.movement_date = e.hire_date
      and m.deleted_at is null
  );

insert into public.employee_movements (
  employee_id,
  movement_type,
  movement_date,
  reference_month,
  termination_reason_id,
  status,
  notes,
  total_amount,
  created_by,
  updated_by
)
select
  e.id,
  'termination',
  e.termination_date,
  date_trunc('month', e.termination_date::timestamp)::date,
  e.termination_reason_id,
  'completed',
  'Registro criado automaticamente a partir da data de desligamento do colaborador.',
  0,
  e.created_by,
  e.updated_by
from public.employees e
where e.deleted_at is null
  and e.termination_date is not null
  and not exists (
    select 1
    from public.employee_movements m
    where m.employee_id = e.id
      and m.movement_type = 'termination'
      and m.movement_date = e.termination_date
      and m.deleted_at is null
  );

commit;
