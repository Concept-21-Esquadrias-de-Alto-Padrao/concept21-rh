-- Exclusivo da homologacao; nunca incluir nas migrations de producao.
create or replace function app.block_homologation_email(event jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'HOMOLOGACAO_EMAIL_BLOCKED: envio de e-mail desativado no ambiente de testes.'
  ));
$$;

revoke all on function app.block_homologation_email(jsonb) from public, anon, authenticated;
grant usage on schema app to supabase_auth_admin;
grant execute on function app.block_homologation_email(jsonb) to supabase_auth_admin;
