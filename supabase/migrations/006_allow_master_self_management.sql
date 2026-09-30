drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
on public.profiles for update to authenticated
using (
  auth_user_id = auth.uid()
  or app.has_role('master')
  or app.has_permission('hr.security.users.manage')
)
with check (
  auth_user_id = auth.uid()
  or app.has_role('master')
  or app.has_permission('hr.security.users.manage')
);

drop policy if exists "user_roles_update" on public.user_roles;

create policy "user_roles_update"
on public.user_roles for update to authenticated
using (
  app.has_permission('hr.security.users.manage')
  or (
    profile_id = app.current_profile_id()
    and app.has_role('master')
  )
)
with check (
  app.has_permission('hr.security.users.manage')
  or profile_id = app.current_profile_id()
);

create or replace function app.prevent_last_active_master_removal()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  master_role_id uuid;
  active_master_count integer;
begin
  select id into master_role_id
  from public.roles
  where key = 'master'
  limit 1;

  if master_role_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.role_id <> master_role_id or old.is_active = false then
      return old;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.role_id <> master_role_id or old.is_active = false then
      return new;
    end if;

    if new.role_id = master_role_id and new.is_active = true then
      return new;
    end if;
  end if;

  select count(*)
    into active_master_count
  from public.user_roles ur
  join public.profiles p on p.id = ur.profile_id
  where ur.role_id = master_role_id
    and ur.is_active = true
    and p.is_active = true
    and (ur.expires_at is null or ur.expires_at > now())
    and ur.id <> old.id;

  if active_master_count = 0 then
    raise exception 'Não é permitido remover ou inativar o último usuário Master ativo.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists prevent_last_active_master_removal on public.user_roles;

create trigger prevent_last_active_master_removal
before update or delete on public.user_roles
for each row execute function app.prevent_last_active_master_removal();
