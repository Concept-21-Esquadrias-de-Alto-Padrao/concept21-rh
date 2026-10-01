-- Manual, one-off helper. Replace the placeholders before running.
-- Do not include this file in the generic seed sequence.

begin;

update public.profiles
set is_active = true
where lower(email::text) = lower('SEU_EMAIL_AQUI')
  and full_name = 'SEU_NOME_AQUI';

insert into public.user_roles (profile_id, role_id, is_active, expires_at)
select p.id, r.id, true, null
from public.profiles p
cross join public.roles r
where lower(p.email::text) = lower('SEU_EMAIL_AQUI')
  and p.full_name = 'SEU_NOME_AQUI'
  and r.key = 'master'
on conflict (profile_id, role_id) do update
set
  is_active = true,
  expires_at = null,
  updated_at = now();

commit;
