-- Use only for reverting the homologation pilot after verifying gate status.
begin;
-- Restore the pre-pilot public wrapper before removing its private dependency.
create or replace function public.request_access_review()
returns uuid language plpgsql security definer
set search_path = public, app
as $$
begin
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception 'OAuth client cannot request RH access' using errcode = '42501';
  end if;
  return app.request_access_review();
end;
$$;
do $$
declare target record;
begin
  for target in
    select n.nspname, c.relname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.polname = 'corporate_link_required'
      and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
  loop
    execute format('drop policy corporate_link_required on %I.%I', target.nspname, target.relname);
  end loop;
end $$;
drop function if exists corporate_gate_private.is_allowed();
drop table if exists public.corporate_gate_subjects;
drop schema if exists corporate_gate_private;
commit;
