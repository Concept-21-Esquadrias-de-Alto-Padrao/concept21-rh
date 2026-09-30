create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  profile_name text;
  profile_phone text;
  profile_email text;
begin
  profile_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  profile_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  profile_email := coalesce(new.email, new.id::text || '@auth.local');

  insert into public.profiles (
    auth_user_id,
    full_name,
    email,
    phone,
    is_active
  )
  values (
    new.id,
    coalesce(profile_name, split_part(profile_email, '@', 1), 'Usuário'),
    profile_email,
    profile_phone,
    true
  )
  on conflict (email) do update
  set
    auth_user_id = coalesce(public.profiles.auth_user_id, excluded.auth_user_id),
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    is_active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_auth_user();

drop policy if exists "profiles_insert_security" on public.profiles;

create policy "profiles_insert_security"
on public.profiles for insert to authenticated
with check (
  app.has_permission('hr.security.users.manage')
  or auth_user_id = auth.uid()
);
