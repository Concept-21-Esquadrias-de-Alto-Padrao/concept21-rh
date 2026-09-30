create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists app;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email citext not null unique,
  avatar_url text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  document_number text,
  address text,
  city text,
  state text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  manager_profile_id uuid references public.profiles(id),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  code text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  department_id uuid references public.departments(id),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.employment_types (
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

create table if not exists public.employee_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  color text not null default 'neutral',
  is_terminal boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.termination_reasons (
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

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  full_name text not null,
  cpf text not null,
  rg text,
  birth_date date,
  nationality text,
  marital_status text,
  phone text,
  email citext,
  emergency_contact_name text,
  emergency_contact_phone text,
  employee_number text not null,
  hire_date date not null,
  termination_date date,
  termination_reason_id uuid,
  employment_type_id uuid references public.employment_types(id),
  department_id uuid references public.departments(id),
  position_id uuid references public.positions(id),
  manager_employee_id uuid references public.employees(id),
  status_id uuid references public.employee_statuses(id),
  company_unit_id uuid references public.company_units(id),
  cost_center_id uuid references public.cost_centers(id),
  work_schedule text,
  internal_notes text,
  custom_values jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employees_cpf_unique unique (cpf),
  constraint employees_employee_number_unique unique (employee_number),
  constraint employees_email_unique unique (email),
  constraint employees_termination_after_hire check (
    termination_date is null or termination_date >= hire_date
  )
);

create table if not exists public.employee_addresses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

alter table public.employees
  add constraint employees_termination_reason_fk
  foreign key (termination_reason_id)
  references public.termination_reasons(id)
  deferrable initially deferred;

create index if not exists profiles_auth_user_id_idx on public.profiles(auth_user_id);
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists departments_active_idx on public.departments(is_active);
create index if not exists positions_department_idx on public.positions(department_id);
create index if not exists employees_full_name_idx on public.employees using gin (to_tsvector('portuguese', full_name));
create index if not exists employees_cpf_idx on public.employees(cpf);
create index if not exists employees_email_idx on public.employees(email);
create index if not exists employees_employee_number_idx on public.employees(employee_number);
create index if not exists employees_department_idx on public.employees(department_id);
create index if not exists employees_position_idx on public.employees(position_id);
create index if not exists employees_status_idx on public.employees(status_id);
create index if not exists employees_manager_idx on public.employees(manager_employee_id);
create index if not exists employees_active_idx on public.employees(is_active) where deleted_at is null;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function app.set_updated_at();

create trigger set_company_units_updated_at
before update on public.company_units
for each row execute function app.set_updated_at();

create trigger set_departments_updated_at
before update on public.departments
for each row execute function app.set_updated_at();

create trigger set_cost_centers_updated_at
before update on public.cost_centers
for each row execute function app.set_updated_at();

create trigger set_positions_updated_at
before update on public.positions
for each row execute function app.set_updated_at();

create trigger set_employment_types_updated_at
before update on public.employment_types
for each row execute function app.set_updated_at();

create trigger set_employee_statuses_updated_at
before update on public.employee_statuses
for each row execute function app.set_updated_at();

create trigger set_termination_reasons_updated_at
before update on public.termination_reasons
for each row execute function app.set_updated_at();

create trigger set_employees_updated_at
before update on public.employees
for each row execute function app.set_updated_at();

create trigger set_employee_addresses_updated_at
before update on public.employee_addresses
for each row execute function app.set_updated_at();
