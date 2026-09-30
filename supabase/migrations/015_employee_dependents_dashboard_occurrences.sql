begin;

create extension if not exists unaccent;

create table if not exists public.marital_statuses (
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

create table if not exists public.dependent_relationship_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  is_child boolean not null default false,
  is_spouse boolean not null default false,
  is_parent boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

alter table public.employees
  add column if not exists marital_status_id uuid references public.marital_statuses(id);

create table if not exists public.employee_dependents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  relationship_type_id uuid references public.dependent_relationship_types(id),
  full_name text not null,
  relationship text,
  birth_date date,
  document_number text,
  is_active boolean not null default true,
  consider_for_commemorative_dates boolean not null default true,
  consider_as_internal_dependent boolean not null default true,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

alter table public.occurrence_types
  add column if not exists is_punishment boolean not null default false,
  add column if not exists punishment_level text;

create index if not exists employees_marital_status_idx
  on public.employees(marital_status_id);

create index if not exists employee_dependents_employee_idx
  on public.employee_dependents(employee_id)
  where deleted_at is null;

create index if not exists employee_dependents_relationship_type_idx
  on public.employee_dependents(relationship_type_id);

create index if not exists employee_dependents_commemorative_idx
  on public.employee_dependents(consider_for_commemorative_dates, is_active)
  where deleted_at is null;

create index if not exists occurrence_types_punishment_idx
  on public.occurrence_types(is_punishment, punishment_level);

drop trigger if exists set_marital_statuses_updated_at on public.marital_statuses;
create trigger set_marital_statuses_updated_at
before update on public.marital_statuses
for each row execute function app.set_updated_at();

drop trigger if exists set_dependent_relationship_types_updated_at on public.dependent_relationship_types;
create trigger set_dependent_relationship_types_updated_at
before update on public.dependent_relationship_types
for each row execute function app.set_updated_at();

drop trigger if exists set_employee_dependents_updated_at on public.employee_dependents;
create trigger set_employee_dependents_updated_at
before update on public.employee_dependents
for each row execute function app.set_updated_at();

insert into public.marital_statuses (name, key, description, sort_order)
values
  ('Solteiro(a)', 'solteiro', 'Pessoa solteira.', 10),
  ('Casado(a)', 'casado', 'Pessoa casada.', 20),
  ('Uniao estavel', 'uniao_estavel', 'Pessoa em uniao estavel.', 30),
  ('Divorciado(a)', 'divorciado', 'Pessoa divorciada.', 40),
  ('Separado(a)', 'separado', 'Pessoa separada.', 50),
  ('Viuvo(a)', 'viuvo', 'Pessoa viuva.', 60),
  ('Prefere nao informar', 'prefere_nao_informar', 'Opcao para nao informar estado civil.', 70)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.dependent_relationship_types (
  name,
  key,
  description,
  is_child,
  is_spouse,
  is_parent,
  sort_order
)
values
  ('Filho(a)', 'filho', 'Filho ou filha do colaborador.', true, false, false, 10),
  ('Enteado(a)', 'enteado', 'Enteado ou enteada do colaborador.', true, false, false, 20),
  ('Conjuge', 'conjuge', 'Conjuge do colaborador.', false, true, false, 30),
  ('Companheiro(a)', 'companheiro', 'Companheiro ou companheira do colaborador.', false, true, false, 40),
  ('Pai', 'pai', 'Pai do colaborador.', false, false, true, 50),
  ('Mae', 'mae', 'Mae do colaborador.', false, false, true, 60),
  ('Outro', 'outro', 'Outro grau de parentesco.', false, false, false, 90)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  is_child = excluded.is_child,
  is_spouse = excluded.is_spouse,
  is_parent = excluded.is_parent,
  sort_order = excluded.sort_order,
  is_active = true;

update public.employees e
set marital_status_id = ms.id
from public.marital_statuses ms
where e.marital_status_id is null
  and e.marital_status is not null
  and lower(unaccent(e.marital_status)) = lower(unaccent(ms.name));

insert into public.occurrence_categories (name, key, description, sort_order)
values
  ('Medidas disciplinares', 'medidas_disciplinares', 'Advertencias, suspensoes e medidas disciplinares.', 20)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

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
  is_punishment,
  punishment_level,
  priority_order,
  sort_order
)
values
  ('Advertencia verbal', 'advertencia_verbal', (select id from public.occurrence_categories where key = 'medidas_disciplinares'), 'Medida disciplinar verbal.', false, false, false, true, true, true, true, false, false, true, 'advertencia_verbal', 20, 90),
  ('Advertencia escrita', 'advertencia_escrita', (select id from public.occurrence_categories where key = 'medidas_disciplinares'), 'Medida disciplinar escrita.', false, false, false, true, true, true, true, false, false, true, 'advertencia_escrita', 21, 91),
  ('Suspensao', 'suspensao', (select id from public.occurrence_categories where key = 'medidas_disciplinares'), 'Suspensao disciplinar com impacto operacional.', false, false, false, true, true, true, true, true, false, true, 'suspensao', 22, 92)
on conflict (key) do update
set
  name = excluded.name,
  occurrence_category_id = excluded.occurrence_category_id,
  description = excluded.description,
  include_in_daily_report = excluded.include_in_daily_report,
  counts_as_absence = excluded.counts_as_absence,
  counts_as_medical_certificate = excluded.counts_as_medical_certificate,
  is_punishment = excluded.is_punishment,
  punishment_level = excluded.punishment_level,
  priority_order = excluded.priority_order,
  sort_order = excluded.sort_order,
  is_active = true;

update public.occurrence_types
set is_punishment = true
where key in ('advertencia', 'advertencia_verbal', 'advertencia_escrita', 'suspensao');

alter table public.marital_statuses enable row level security;
alter table public.dependent_relationship_types enable row level security;
alter table public.employee_dependents enable row level security;

drop policy if exists "marital_statuses_select" on public.marital_statuses;
create policy "marital_statuses_select"
on public.marital_statuses for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view') or app.has_permission('hr.employees.marital_status.manage'));

drop policy if exists "marital_statuses_insert" on public.marital_statuses;
create policy "marital_statuses_insert"
on public.marital_statuses for insert to authenticated
with check (app.has_permission('hr.employees.marital_status.manage') or app.has_permission('hr.settings.manage'));

drop policy if exists "marital_statuses_update" on public.marital_statuses;
create policy "marital_statuses_update"
on public.marital_statuses for update to authenticated
using (app.has_permission('hr.employees.marital_status.manage') or app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.employees.marital_status.manage') or app.has_permission('hr.settings.manage'));

drop policy if exists "dependent_relationship_types_select" on public.dependent_relationship_types;
create policy "dependent_relationship_types_select"
on public.dependent_relationship_types for select to authenticated
using (app.can_access_hr() or app.has_permission('hr.settings.view') or app.has_permission('hr.employees.dependents.view'));

drop policy if exists "dependent_relationship_types_insert" on public.dependent_relationship_types;
create policy "dependent_relationship_types_insert"
on public.dependent_relationship_types for insert to authenticated
with check (app.has_permission('hr.employees.dependents.manage') or app.has_permission('hr.settings.manage'));

drop policy if exists "dependent_relationship_types_update" on public.dependent_relationship_types;
create policy "dependent_relationship_types_update"
on public.dependent_relationship_types for update to authenticated
using (app.has_permission('hr.employees.dependents.manage') or app.has_permission('hr.settings.manage'))
with check (app.has_permission('hr.employees.dependents.manage') or app.has_permission('hr.settings.manage'));

drop policy if exists "employee_dependents_select" on public.employee_dependents;
create policy "employee_dependents_select"
on public.employee_dependents for select to authenticated
using (
  app.has_permission('hr.employees.dependents.view')
  or app.has_permission('hr.employees.dependents.manage')
  or app.has_permission('hr.employees.view')
);

drop policy if exists "employee_dependents_insert" on public.employee_dependents;
create policy "employee_dependents_insert"
on public.employee_dependents for insert to authenticated
with check (app.has_permission('hr.employees.dependents.manage'));

drop policy if exists "employee_dependents_update" on public.employee_dependents;
create policy "employee_dependents_update"
on public.employee_dependents for update to authenticated
using (app.has_permission('hr.employees.dependents.manage'))
with check (app.has_permission('hr.employees.dependents.manage'));

insert into public.permissions (module, action, key, description, is_sensitive)
values
  ('dashboard', 'view', 'hr.dashboard.view', 'Visualizar dashboard gerencial de RH.', true),
  ('dashboard', 'general_view', 'hr.dashboard.general_view', 'Visualizar visao historica geral do dashboard de RH.', true),
  ('dashboard', 'competence_view', 'hr.dashboard.competence_view', 'Visualizar dashboard de RH por competencia.', true),
  ('dashboard', 'occurrences_view', 'hr.dashboard.occurrences.view', 'Visualizar indicadores consolidados de ocorrencias no dashboard.', true),
  ('dashboard', 'occurrences_rankings', 'hr.dashboard.occurrences.rankings', 'Visualizar rankings de ocorrencias no dashboard.', true),
  ('dashboard', 'occurrences_sensitive', 'hr.dashboard.occurrences.sensitive', 'Visualizar dados sensiveis de ocorrencias no dashboard.', true),
  ('employees', 'dependents_view', 'hr.employees.dependents.view', 'Visualizar dependentes de colaboradores.', true),
  ('employees', 'dependents_manage', 'hr.employees.dependents.manage', 'Cadastrar e gerenciar dependentes de colaboradores.', true),
  ('employees', 'marital_status_manage', 'hr.employees.marital_status.manage', 'Gerenciar estados civis de colaboradores.', false)
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
where r.key in ('master', 'rh')
  and p.key in (
    'hr.dashboard.view',
    'hr.dashboard.general_view',
    'hr.dashboard.competence_view',
    'hr.dashboard.occurrences.view',
    'hr.dashboard.occurrences.rankings',
    'hr.dashboard.occurrences.sensitive',
    'hr.employees.dependents.view',
    'hr.employees.dependents.manage',
    'hr.employees.marital_status.manage'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
cross join public.permissions p
where r.key = 'diretoria'
  and p.key in (
    'hr.dashboard.view',
    'hr.dashboard.general_view',
    'hr.dashboard.competence_view',
    'hr.dashboard.occurrences.view',
    'hr.dashboard.occurrences.rankings'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'own_department'
from public.roles r
cross join public.permissions p
where r.key = 'gestor'
  and p.key in (
    'hr.dashboard.view',
    'hr.dashboard.competence_view',
    'hr.dashboard.occurrences.view'
  )
on conflict (role_id, permission_id) do update set scope = excluded.scope;

commit;
