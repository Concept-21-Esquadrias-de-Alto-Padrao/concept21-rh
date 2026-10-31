begin;

-- OAuth access tokens carry the user's normal authenticated role. Keep them
-- from reaching RH data, while ordinary RH sessions retain existing policies.
do $$
declare
  relation record;
begin
  for relation in
    select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
      and c.relkind in ('r', 'p')
  loop
    if not relation.relrowsecurity then
      raise exception 'RLS is required on %.%', relation.schema_name, relation.table_name;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = relation.schema_name
        and tablename = relation.table_name
        and policyname = 'oauth_clients_no_hr_data'
    ) then
      execute format(
        'create policy oauth_clients_no_hr_data on %I.%I as restrictive for all to authenticated '
        || 'using (((select auth.jwt()) ->> ''client_id'') is null) '
        || 'with check (((select auth.jwt()) ->> ''client_id'') is null)',
        relation.schema_name, relation.table_name
      );
    end if;
  end loop;
end;
$$;

-- These exposed SECURITY DEFINER RPCs bypass the caller's table RLS.
create or replace function public.has_permission(permission_key text)
returns boolean
language sql stable security definer
set search_path = public, app
as $$
  select ((select auth.jwt()) ->> 'client_id') is null
    and app.has_permission(permission_key)
$$;

create or replace function public.has_role(role_key text)
returns boolean
language sql stable security definer
set search_path = public, app
as $$
  select ((select auth.jwt()) ->> 'client_id') is null
    and app.has_role(role_key)
$$;

create or replace function public.request_access_review()
returns uuid
language plpgsql security definer
set search_path = public, app
as $$
begin
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception 'OAuth client cannot request RH access' using errcode = '42501';
  end if;
  return app.request_access_review();
end;
$$;

commit;
