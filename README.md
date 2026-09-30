# Concept21 Aluminium - Módulo de RH

Base SaaS interna em Next.js, React, TypeScript e Supabase para centralizar o RH da Concept21 Aluminium.

## Stack

- Next.js App Router
- React + TypeScript
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- SQL nativo para migrations e seeds
- RBAC próprio no banco
- Row Level Security nas tabelas sensiveis

Não há Docker, Prisma, ORM ou banco local em container.

## Variaveis de ambiente

Crie `.env.local` a partir de `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ACCESS_REQUEST_FROM_EMAIL=
```

`SUPABASE_SERVICE_ROLE_KEY` não deve ser usado no client-side.
`NEXT_PUBLIC_APP_URL` deve apontar para a URL publica da aplicacao em producao, por exemplo `https://seu-dominio.com`.
`RESEND_API_KEY` e `ACCESS_REQUEST_FROM_EMAIL` habilitam o envio real de e-mail para Master/Admin quando um cadastro confirmado aguarda perfil de acesso. Sem essas variaveis, a notificacao interna continua funcionando e o e-mail fica na fila do banco.

## Supabase Auth

No Supabase Dashboard, mantenha a confirmacao de e-mail habilitada e cadastre estas URLs em Auth > URL Configuration:

- Site URL: `https://concept21-rh.vercel.app`.
- Redirect URL: `https://concept21-rh.vercel.app/auth/callback`.
- Opcional para desenvolvimento local: `http://localhost:3000/auth/callback`.

Se o e-mail de confirmacao abrir `localhost:3000`, o Supabase ainda esta com `Site URL`
local ou o template de confirmacao nao esta usando o link de confirmacao padrao.
Em Auth > Email Templates > Confirm signup, mantenha o botao/link apontando para
`{{ .ConfirmationURL }}` para respeitar o redirect enviado pela aplicacao.

## Banco Supabase

Migrations:

1. `supabase/migrations/001_create_hr_core_tables.sql`
2. `supabase/migrations/002_create_hr_operations_tables.sql`
3. `supabase/migrations/003_create_hr_security_audit_custom_fields.sql`
4. `supabase/migrations/004_enable_hr_rls_and_storage.sql`

Seed:

- `supabase/seeds/001_seed_hr_initial_data.sql`

Voce pode aplicar pelo Supabase SQL Editor, na ordem acima, ou adaptar para seu fluxo de Supabase CLI.

Depois do seed, crie o primeiro usuário em Supabase Auth e vincule-o ao perfil Master:

```sql
insert into public.profiles (auth_user_id, full_name, email)
values ('AUTH_USER_ID_AQUI', 'Usuário Master', 'master@concept21.com.br');

insert into public.user_roles (profile_id, role_id)
select p.id, r.id
from public.profiles p
join public.roles r on r.key = 'master'
where p.email = 'master@concept21.com.br';
```

Importante: usuários do Supabase Auth ficam em `auth.users`, mas a aplicação lista usuários a partir de `public.profiles`. Portanto, um usuário criado apenas em **Authentication > Users** ainda não aparece no módulo até existir o registro correspondente em `public.profiles` e, para acesso Master, o vínculo em `public.user_roles`.

Para diagnosticar:

```sql
select id, email, created_at
from auth.users
order by created_at desc;

select p.id, p.auth_user_id, p.full_name, p.email, r.key as role_key, ur.is_active as role_active
from public.profiles p
left join public.user_roles ur on ur.profile_id = p.id
left join public.roles r on r.id = ur.role_id
order by p.created_at desc;
```

## Storage

A migration `004_enable_hr_rls_and_storage.sql` cria o bucket privado:

```txt
hr-documents
```

Os arquivos sao gravados em:

```txt
employees/{employee_id}/documents/{document_id}-{filename}
```

O acesso é feito por URL assinada via `generateDocumentSignedUrl`.

## Telas

- `/login`
- `/rh`
- `/rh/colaboradores`
- `/rh/colaboradores/[id]`
- `/rh/documentos`
- `/rh/ferias-afastamentos`
- `/rh/treinamentos`
- `/rh/ocorrencias`
- `/rh/configuracoes`

## Scripts

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

## Status tecnico

Implementado:

- modelagem SQL nativa para RH;
- seeds iniciais da Concept21;
- RLS inicial por permissão;
- RBAC com roles, permissions, role_permissions e user_roles;
- Supabase Auth com tela de login;
- Supabase Storage privado para documentos;
- services por dominio usando Supabase Client;
- tipos TypeScript do dominio;
- dashboard, colaboradores, prontuário com abas, documentos, férias/afastamentos, treinamentos, ocorrências e configurações;
- matriz de permissões;
- auditoria e histórico de colaborador;
- base para importação futura de CSV.

Preparado para evolucao:

- escopos avancados de RLS por setor/subordinados;
- importação XLSX com mapeamento de colunas;
- portal do colaborador;
- aprovacoes com workflow mais detalhado;
- triggers automaticas de auditoria por tabela, caso desejado.
