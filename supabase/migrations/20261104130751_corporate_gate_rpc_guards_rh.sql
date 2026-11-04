begin;
create or replace function public.request_access_review()
returns uuid language plpgsql security definer
set search_path = public, app
as $$
begin
  if not corporate_gate_private.is_allowed() then
    raise exception 'Vínculo corporativo revogado.' using errcode = '42501';
  end if;
  if ((select auth.jwt()) ->> 'client_id') is not null then
    raise exception 'OAuth client cannot request RH access' using errcode = '42501';
  end if;
  return app.request_access_review();
end;
$$;
commit;
