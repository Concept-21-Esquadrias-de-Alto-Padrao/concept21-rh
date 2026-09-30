create table if not exists public.access_review_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email citext not null,
  full_name text not null,
  phone text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  email_confirmed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewer_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_review_requests_status_check check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  recipient_auth_user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'info',
  entity text,
  entity_id uuid,
  action_url text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_notification_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_email citext not null,
  recipient_name text,
  subject text not null,
  body text not null,
  status text not null default 'queued',
  provider text,
  provider_response jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint email_notification_queue_status_check check (
    status in ('queued', 'sent', 'failed', 'provider_not_configured')
  )
);

create index if not exists access_review_requests_status_idx
  on public.access_review_requests(status, requested_at desc);

create index if not exists access_review_requests_auth_user_idx
  on public.access_review_requests(auth_user_id);

create index if not exists platform_notifications_recipient_idx
  on public.platform_notifications(recipient_profile_id, read_at, created_at desc);

create index if not exists email_notification_queue_status_idx
  on public.email_notification_queue(status, created_at);

drop trigger if exists set_access_review_requests_updated_at on public.access_review_requests;
create trigger set_access_review_requests_updated_at
before update on public.access_review_requests
for each row execute function app.set_updated_at();

alter table public.access_review_requests enable row level security;
alter table public.platform_notifications enable row level security;
alter table public.email_notification_queue enable row level security;

drop policy if exists "access_review_requests_select" on public.access_review_requests;
create policy "access_review_requests_select"
on public.access_review_requests for select to authenticated
using (
  auth_user_id = auth.uid()
  or app.has_permission('hr.security.users.view')
);

drop policy if exists "access_review_requests_update" on public.access_review_requests;
create policy "access_review_requests_update"
on public.access_review_requests for update to authenticated
using (app.has_permission('hr.security.users.manage'))
with check (app.has_permission('hr.security.users.manage'));

drop policy if exists "platform_notifications_select" on public.platform_notifications;
create policy "platform_notifications_select"
on public.platform_notifications for select to authenticated
using (
  recipient_auth_user_id = auth.uid()
  or recipient_profile_id = app.current_profile_id()
  or app.has_permission('hr.security.users.view')
);

drop policy if exists "platform_notifications_update_own" on public.platform_notifications;
create policy "platform_notifications_update_own"
on public.platform_notifications for update to authenticated
using (
  recipient_auth_user_id = auth.uid()
  or recipient_profile_id = app.current_profile_id()
)
with check (
  recipient_auth_user_id = auth.uid()
  or recipient_profile_id = app.current_profile_id()
);

drop policy if exists "email_notification_queue_select" on public.email_notification_queue;
create policy "email_notification_queue_select"
on public.email_notification_queue for select to authenticated
using (app.has_permission('hr.security.users.view'));

drop policy if exists "email_notification_queue_update" on public.email_notification_queue;
create policy "email_notification_queue_update"
on public.email_notification_queue for update to authenticated
using (app.has_permission('hr.security.users.manage'))
with check (app.has_permission('hr.security.users.manage'));

create or replace function app.current_auth_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and coalesce(u.email_confirmed_at, u.confirmed_at) is not null
  )
$$;

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
    and app.current_auth_email_confirmed()
  limit 1
$$;

create or replace function app.has_role(role_key text)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select app.current_auth_email_confirmed() and exists (
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
  select app.current_auth_email_confirmed()
    and (
      app.has_role('master')
      or exists (
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
    when not app.current_auth_email_confirmed() then 'none'
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
    or app.has_permission('hr.labor_costs.dashboard')
$$;

create or replace function app.request_access_review()
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  current_profile record;
  confirmed_at timestamptz;
  request_id uuid;
  recipient record;
begin
  select
    p.id,
    p.auth_user_id,
    p.full_name,
    p.email,
    p.phone,
    p.is_active,
    coalesce(u.email_confirmed_at, u.confirmed_at) as confirmed_at
  into current_profile
  from public.profiles p
  join auth.users u on u.id = p.auth_user_id
  where p.auth_user_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'Perfil de acesso nao encontrado.';
  end if;

  if current_profile.is_active is not true then
    raise exception 'Cadastro inativo.';
  end if;

  confirmed_at := current_profile.confirmed_at;

  if confirmed_at is null then
    raise exception 'Confirme seu e-mail antes de solicitar acesso.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = current_profile.id
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and r.is_active = true
  ) then
    insert into public.access_review_requests (
      profile_id,
      auth_user_id,
      email,
      full_name,
      phone,
      status,
      email_confirmed_at,
      reviewed_at,
      reviewed_by
    )
    values (
      current_profile.id,
      current_profile.auth_user_id,
      current_profile.email,
      current_profile.full_name,
      current_profile.phone,
      'approved',
      confirmed_at,
      now(),
      auth.uid()
    )
    on conflict (profile_id) do update
    set
      status = 'approved',
      email = excluded.email,
      full_name = excluded.full_name,
      phone = excluded.phone,
      email_confirmed_at = excluded.email_confirmed_at,
      reviewed_at = coalesce(public.access_review_requests.reviewed_at, now()),
      reviewed_by = coalesce(public.access_review_requests.reviewed_by, auth.uid()),
      updated_at = now()
    returning id into request_id;

    return request_id;
  end if;

  insert into public.access_review_requests (
    profile_id,
    auth_user_id,
    email,
    full_name,
    phone,
    status,
    requested_at,
    email_confirmed_at
  )
  values (
    current_profile.id,
    current_profile.auth_user_id,
    current_profile.email,
    current_profile.full_name,
    current_profile.phone,
    'pending',
    now(),
    confirmed_at
  )
  on conflict (profile_id) do update
  set
    status = 'pending',
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    requested_at = coalesce(public.access_review_requests.requested_at, now()),
    email_confirmed_at = excluded.email_confirmed_at,
    updated_at = now()
  returning id into request_id;

  for recipient in
    select distinct p.id, p.auth_user_id, p.full_name, p.email
    from public.profiles p
    join public.user_roles ur on ur.profile_id = p.id
    join public.roles r on r.id = ur.role_id
    left join public.role_permissions rp on rp.role_id = r.id
    left join public.permissions perm on perm.id = rp.permission_id
    where p.is_active = true
      and p.auth_user_id is not null
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
      and r.is_active = true
      and (
        r.key = 'master'
        or (
          perm.key = 'hr.security.users.manage'
          and perm.is_active = true
          and rp.scope <> 'none'
        )
      )
  loop
    insert into public.platform_notifications (
      recipient_profile_id,
      recipient_auth_user_id,
      title,
      body,
      category,
      entity,
      entity_id,
      action_url,
      metadata
    )
    select
      recipient.id,
      recipient.auth_user_id,
      'Cadastro aguardando perfil de acesso',
      current_profile.full_name || ' (' || current_profile.email || ') confirmou o e-mail e aguarda aprovacao.',
      'access_review',
      'access_review_request',
      request_id,
      '/rh/configuracoes',
      jsonb_build_object('profile_id', current_profile.id, 'auth_user_id', current_profile.auth_user_id)
    where not exists (
      select 1
      from public.platform_notifications n
      where n.recipient_profile_id = recipient.id
        and n.entity = 'access_review_request'
        and n.entity_id = request_id
        and n.read_at is null
    );

    insert into public.email_notification_queue (
      recipient_email,
      recipient_name,
      subject,
      body,
      status,
      metadata
    )
    select
      recipient.email,
      recipient.full_name,
      'Cadastro aguardando perfil de acesso',
      'O usuario ' || current_profile.full_name || ' (' || current_profile.email || ') confirmou o e-mail e precisa de aprovacao de perfil no RH Concept21.',
      'queued',
      jsonb_build_object(
        'source', 'access_review_request',
        'access_request_id', request_id,
        'profile_id', current_profile.id,
        'auth_user_id', current_profile.auth_user_id
      )
    where not exists (
      select 1
      from public.email_notification_queue q
      where q.recipient_email = recipient.email
        and q.metadata ->> 'access_request_id' = request_id::text
        and q.status in ('queued', 'sent')
    );
  end loop;

  return request_id;
end;
$$;

create or replace function app.mark_access_request_approved()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  request_id uuid;
begin
  if new.is_active is not true then
    return new;
  end if;

  update public.access_review_requests
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where profile_id = new.profile_id
    and status = 'pending'
  returning id into request_id;

  if request_id is not null then
    update public.platform_notifications
    set read_at = coalesce(read_at, now())
    where entity = 'access_review_request'
      and entity_id = request_id;
  end if;

  return new;
end;
$$;

drop trigger if exists mark_access_request_approved_on_user_roles on public.user_roles;
create trigger mark_access_request_approved_on_user_roles
after insert or update of is_active on public.user_roles
for each row execute function app.mark_access_request_approved();

grant execute on function app.current_auth_email_confirmed() to authenticated;
grant execute on function app.request_access_review() to authenticated;
