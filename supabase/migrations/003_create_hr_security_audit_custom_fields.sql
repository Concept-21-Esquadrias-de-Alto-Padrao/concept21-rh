create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  action text not null,
  key text not null unique,
  description text,
  is_sensitive boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  scope text not null default 'all',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint role_permissions_unique unique (role_id, permission_id),
  constraint role_permissions_scope_check check (
    scope in ('all', 'own_department', 'subordinates', 'own_data', 'none')
  )
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_unique_active unique (profile_id, role_id)
);

create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  label text not null,
  key text not null,
  field_type text not null,
  placeholder text,
  help_text text,
  is_required boolean not null default false,
  is_active boolean not null default true,
  visibility_rules jsonb not null default '{}'::jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint custom_fields_entity_check check (
    entity in ('employee', 'document', 'occurrence', 'training')
  ),
  constraint custom_fields_type_check check (
    field_type in ('text', 'number', 'date', 'boolean', 'select', 'multi_select', 'file')
  ),
  constraint custom_fields_unique_key unique (entity, key)
);

create table if not exists public.custom_field_options (
  id uuid primary key default gen_random_uuid(),
  custom_field_id uuid not null references public.custom_fields(id) on delete cascade,
  label text not null,
  value text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_field_options_unique unique (custom_field_id, value)
);

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  custom_field_id uuid not null references public.custom_fields(id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint custom_field_values_unique unique (custom_field_id, entity_id)
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  entity text not null,
  event text not null,
  days_before integer,
  severity text not null default 'warning',
  channels text[] not null default array['in_app'],
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint alert_rules_severity_check check (severity in ('info', 'warning', 'critical')),
  constraint alert_rules_days_before_check check (days_before is null or days_before >= 0)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  actor_auth_user_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_history_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  event_date timestamptz not null default now(),
  source_entity text,
  source_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create or replace function app.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, app
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1
$$;

create or replace function app.has_role(role_key text)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.profile_id = p.id
    join public.roles r on r.id = ur.role_id
    where p.auth_user_id = auth.uid()
      and p.is_active = true
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and r.is_active = true
      and r.key = role_key
  )
$$;

create or replace function app.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select app.has_role('master') or exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.profile_id = p.id
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions perm on perm.id = rp.permission_id
    where p.auth_user_id = auth.uid()
      and p.is_active = true
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and r.is_active = true
      and perm.is_active = true
      and rp.scope <> 'none'
      and perm.key = permission_key
  )
$$;

create or replace function app.permission_scope(permission_key text)
returns text
language sql
stable
security definer
set search_path = public, app
as $$
  select case
    when app.has_role('master') then 'all'
    else coalesce(
      (
        select rp.scope
        from public.profiles p
        join public.user_roles ur on ur.profile_id = p.id
        join public.roles r on r.id = ur.role_id
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions perm on perm.id = rp.permission_id
        where p.auth_user_id = auth.uid()
          and p.is_active = true
          and ur.is_active = true
          and (ur.expires_at is null or ur.expires_at > now())
          and r.is_active = true
          and perm.is_active = true
          and perm.key = permission_key
        order by case rp.scope
          when 'all' then 1
          when 'own_department' then 2
          when 'subordinates' then 3
          when 'own_data' then 4
          else 5
        end
        limit 1
      ),
      'none'
    )
  end
$$;

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
$$;

create or replace function app.prevent_master_role_tamper()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if tg_op = 'UPDATE' and old.key = 'master' and (new.key <> 'master' or new.is_active = false) then
    raise exception 'O perfil Master não pode ser desativado ou renomeado.';
  end if;

  if tg_op = 'DELETE' and old.key = 'master' then
    raise exception 'O perfil Master não pode ser removido.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger prevent_master_role_tamper
before update or delete on public.roles
for each row execute function app.prevent_master_role_tamper();

create index if not exists roles_key_idx on public.roles(key);
create index if not exists permissions_key_idx on public.permissions(key);
create index if not exists permissions_module_idx on public.permissions(module);
create index if not exists role_permissions_role_idx on public.role_permissions(role_id);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission_id);
create index if not exists user_roles_profile_idx on public.user_roles(profile_id);
create index if not exists user_roles_role_idx on public.user_roles(role_id);
create index if not exists custom_fields_entity_idx on public.custom_fields(entity);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_profile_id);
create index if not exists employee_history_events_employee_idx on public.employee_history_events(employee_id);
create index if not exists employee_history_events_event_date_idx on public.employee_history_events(event_date desc);

create trigger set_roles_updated_at
before update on public.roles
for each row execute function app.set_updated_at();

create trigger set_permissions_updated_at
before update on public.permissions
for each row execute function app.set_updated_at();

create trigger set_role_permissions_updated_at
before update on public.role_permissions
for each row execute function app.set_updated_at();

create trigger set_user_roles_updated_at
before update on public.user_roles
for each row execute function app.set_updated_at();

create trigger set_custom_fields_updated_at
before update on public.custom_fields
for each row execute function app.set_updated_at();

create trigger set_custom_field_options_updated_at
before update on public.custom_field_options
for each row execute function app.set_updated_at();

create trigger set_custom_field_values_updated_at
before update on public.custom_field_values
for each row execute function app.set_updated_at();

create trigger set_alert_rules_updated_at
before update on public.alert_rules
for each row execute function app.set_updated_at();
