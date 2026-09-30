begin;

create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select app.has_permission(permission_key)
$$;

create or replace function public.has_role(role_key text)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select app.has_role(role_key)
$$;

create or replace function public.request_access_review()
returns uuid
language sql
security definer
set search_path = public, app
as $$
  select app.request_access_review()
$$;

revoke all on function public.has_permission(text) from public;
revoke all on function public.has_role(text) from public;
revoke all on function public.request_access_review() from public;

grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.request_access_review() to authenticated;

commit;
