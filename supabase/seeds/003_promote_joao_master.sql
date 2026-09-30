begin;

update public.profiles
set is_active = true
where lower(email::text) = lower('joaopedro@conceptal.com.br')
  and full_name = 'João Pedro Menezes Silva';

insert into public.user_roles (profile_id, role_id, is_active, expires_at)
select p.id, r.id, true, null
from public.profiles p
cross join public.roles r
where lower(p.email::text) = lower('joaopedro@conceptal.com.br')
  and p.full_name = 'João Pedro Menezes Silva'
  and r.key = 'master'
on conflict (profile_id, role_id) do update
set
  is_active = true,
  expires_at = null,
  updated_at = now();

commit;
