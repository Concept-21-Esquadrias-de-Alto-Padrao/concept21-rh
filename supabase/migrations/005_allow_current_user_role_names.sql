drop policy if exists "roles_select" on public.roles;

create policy "roles_select"
on public.roles for select to authenticated
using (
  app.has_permission('hr.security.users.view')
  or app.has_permission('hr.settings.view')
  or exists (
    select 1
    from public.user_roles ur
    where ur.role_id = roles.id
      and ur.profile_id = app.current_profile_id()
      and ur.is_active = true
      and (ur.expires_at is null or ur.expires_at > now())
  )
);
