
-- User-authorized maintenance for this module. All new controls start OFF.
-- Existing identity/RBAC policies and local maintenance controls remain intact.
create schema portal_maintenance_private;
revoke all on schema portal_maintenance_private from public, anon, authenticated;
create table portal_maintenance_private.state (
 scope text primary key check(scope in ('global','module')),
 enabled boolean not null default false,
 message text not null default 'Sistema em manutenção. Aguarde a liberação.',
 version bigint not null default 0 check(version>=0),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
insert into portal_maintenance_private.state(scope) values('global'),('module');
create table portal_maintenance_private.events (
 id bigint generated always as identity primary key,
 scope text not null, enabled boolean not null, version bigint not null,
 actor uuid not null, changed_at timestamptz not null default now(),
 unique(scope,version)
);
alter table portal_maintenance_private.state enable row level security;
alter table portal_maintenance_private.events enable row level security;
revoke all on all tables in schema portal_maintenance_private from public,anon,authenticated;

create function portal_maintenance_private.is_admin() returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select auth.uid() is not null and (auth.jwt()->>'client_id') is null and coalesce((public.has_role('master') or public.has_role('admin') or public.has_role('administrator')),false)
$$;
create function portal_maintenance_private.enabled() returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select exists(select 1 from portal_maintenance_private.state where enabled) or coalesce((select coalesce(enabled,false) from public.hr_module_maintenance where id=true),false)
$$;
create function portal_maintenance_private.allowed() returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select not portal_maintenance_private.enabled() or portal_maintenance_private.is_admin()
   or coalesce(auth.jwt()->>'role'='service_role',false)
   or ((auth.jwt()->>'role') is null and session_user in ('postgres','supabase_admin'))
$$;
create function public.platform_maintenance_can_access() returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$ select portal_maintenance_private.allowed() $$;
create function public.platform_maintenance_status() returns jsonb language sql stable security definer
set search_path=pg_catalog,public as $$
 select jsonb_build_object(
  'enabled',portal_maintenance_private.enabled(),
  'globalEnabled',(select enabled from portal_maintenance_private.state where scope='global'),
  'moduleEnabled',(select enabled from portal_maintenance_private.state where scope='module'),
  'legacyEnabled',coalesce((select coalesce(enabled,false) from public.hr_module_maintenance where id=true),false),
  'admin',portal_maintenance_private.is_admin(),
  'canAccess',portal_maintenance_private.allowed(),
  'message',coalesce((select message from portal_maintenance_private.state where enabled order by case scope when 'global' then 0 else 1 end limit 1),'Sistema em manutenção. Aguarde a liberação.')
 )
$$;
create function public.platform_maintenance_apply(p_scope text,p_enabled boolean,p_version bigint,p_actor uuid,p_message text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_version bigint;
begin
 if p_scope not in ('global','module') or p_enabled is null or p_version<=0 or p_actor is null
    or p_message is null or length(p_message)>500 then raise exception 'Comando de manutenção inválido.' using errcode='22023'; end if;
 select version into current_version from portal_maintenance_private.state where scope=p_scope for update;
 if current_version>p_version then return jsonb_build_object('stale',true,'version',current_version); end if;
 if current_version=p_version then return jsonb_build_object('ok',true,'version',current_version); end if;
 update portal_maintenance_private.state set enabled=p_enabled,version=p_version,message=p_message,
  updated_at=now(),updated_by=p_actor where scope=p_scope;
 insert into portal_maintenance_private.events(scope,enabled,version,actor) values(p_scope,p_enabled,p_version,p_actor);
 return jsonb_build_object('ok',true,'version',p_version);
end;
$$;
create function portal_maintenance_private.guard_write() returns trigger language plpgsql security definer
set search_path=pg_catalog,public as $$
begin
 if not portal_maintenance_private.allowed() then
  raise exception 'Sistema em manutenção. Não é possível gravar dados neste momento.' using errcode='55000';
 end if;
 return null;
end;
$$;
revoke all on all functions in schema portal_maintenance_private from public,anon,authenticated;
revoke all on function public.platform_maintenance_apply(text,boolean,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.platform_maintenance_apply(text,boolean,bigint,uuid,text) to service_role;
revoke all on function public.platform_maintenance_status(),public.platform_maintenance_can_access() from public,anon,authenticated;
grant execute on function public.platform_maintenance_status(),public.platform_maintenance_can_access() to anon,authenticated,service_role;

-- Explicit inventory of operational tables reviewed for this module.
-- Restrictive policies intersect existing grants; statement guards also cover
-- writes through existing SECURITY DEFINER business RPCs.
do $inventory$ declare item record; begin for item in select * from jsonb_to_recordset('[{"s":"public","t":"employee_leaves"},{"s":"public","t":"company_units"},{"s":"public","t":"departments"},{"s":"public","t":"cost_centers"},{"s":"public","t":"positions"},{"s":"public","t":"employment_types"},{"s":"public","t":"employee_statuses"},{"s":"public","t":"termination_reasons"},{"s":"public","t":"employees"},{"s":"public","t":"employee_addresses"},{"s":"public","t":"leave_types"},{"s":"public","t":"document_types"},{"s":"public","t":"required_documents"},{"s":"public","t":"employee_documents"},{"s":"public","t":"vacations"},{"s":"public","t":"trainings"},{"s":"public","t":"employee_trainings"},{"s":"public","t":"occurrence_categories"},{"s":"public","t":"occurrence_types"},{"s":"public","t":"employee_occurrence_attachments"},{"s":"public","t":"employee_occurrences"},{"s":"public","t":"custom_fields"},{"s":"public","t":"custom_field_options"},{"s":"public","t":"custom_field_values"},{"s":"public","t":"alert_rules"},{"s":"public","t":"employee_history_events"},{"s":"public","t":"daily_occurrence_reports"},{"s":"public","t":"daily_occurrence_report_items"},{"s":"public","t":"cost_component_categories"},{"s":"public","t":"cost_components"},{"s":"public","t":"employee_compensations"},{"s":"public","t":"employee_cost_components"},{"s":"public","t":"employee_monthly_cost_events"},{"s":"public","t":"monthly_employee_costs"},{"s":"public","t":"occurrence_cost_rules"},{"s":"public","t":"monthly_employee_cost_items"},{"s":"public","t":"marital_statuses"},{"s":"public","t":"dependent_relationship_types"},{"s":"public","t":"employee_dependents"},{"s":"public","t":"employee_movements"},{"s":"public","t":"employee_movement_cost_items"},{"s":"public","t":"employee_movement_cost_categories"}]'::jsonb) as x(s text,t text) loop execute format('create policy portal_maintenance_gate on %I.%I as restrictive for all to public using ((select public.platform_maintenance_can_access())) with check ((select public.platform_maintenance_can_access()))',item.s,item.t); execute format('create trigger portal_maintenance_write before insert or update or delete on %I.%I for each statement execute function portal_maintenance_private.guard_write()',item.s,item.t); end loop; end; $inventory$;
create policy portal_maintenance_storage on storage.objects as restrictive for all to public using (bucket_id not in ('hr-documents') or (select public.platform_maintenance_can_access())) with check (bucket_id not in ('hr-documents') or (select public.platform_maintenance_can_access()));
notify pgrst,'reload schema';
