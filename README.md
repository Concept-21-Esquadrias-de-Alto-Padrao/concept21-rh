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

As migrations ficam em `supabase/migrations` e sao aplicadas em ordem lexical pelo nome do arquivo.
A pasta e a fonte de verdade; a tabela `app.codex_migration_history` registra:

- `version`: nome do arquivo sem `.sql`;
- `file_name`: nome completo do arquivo;
- `checksum_sha256`: hash SHA-256 dos bytes reais do arquivo;
- `execution_mode`: `baseline` ou `applied`;
- `applied_at` e `applied_by`.

Comandos:

```bash
npm run db:migrations:dry-run
npm run db:migrations:baseline
npm run db:migrations:push
```

Os comandos usam `scripts/apply-supabase-migrations.mjs`, um runner Node multiplataforma que chama `npx supabase db query --linked`. O Supabase CLI precisa estar autenticado e o projeto precisa estar linkado na maquina.

Seeds rerunnable:

- `supabase/seeds/001_seed_hr_initial_data.sql`
- `supabase/seeds/002_update_portuguese_texts.sql`
- `supabase/seeds/003_daily_occurrence_report_config.sql`
- `supabase/seeds/004_seed_labor_costs.sql`

Promocao manual de Master:

- Use `supabase/manual/promote_master.example.sql` como template.
- Troque os placeholders pelo e-mail/nome corretos antes de executar.
- Esse script nao faz parte da sequencia generica de seeds.

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

O bucket privado de documentos e:

```txt
hr-documents
```

Os arquivos sao gravados em:

```txt
employees/{employee_id}/documents/{document_id}-{filename}
```

O acesso e feito por URL assinada via `generateDocumentSignedUrl`. A RLS do Storage extrai o `employee_id` do path e aplica os mesmos escopos de RBAC/RLS do colaborador.

## Telas

- `/login`
- `/rh`
- `/rh/colaboradores`
- `/rh/colaboradores/[id]`
- `/rh/admissoes-desligamentos`
- `/rh/folha`
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
- RLS por permissao e por escopo real de colaborador;
- RBAC com roles, permissions, role_permissions e user_roles;
- Supabase Auth com tela de login;
- Supabase Storage privado para documentos;
- services por dominio usando Supabase Client;
- tipos TypeScript do dominio;
- dashboard, colaboradores, prontuário com abas, folha de pagamento, admissoes/desligamentos, documentos, férias/afastamentos, treinamentos, ocorrências e configurações;
- matriz de permissões;
- auditoria e histórico de colaborador;
- base para importação futura de CSV.

Preparado para evolucao:

- importação XLSX com mapeamento de colunas;
- portal do colaborador;
- aprovacoes com workflow mais detalhado;
- triggers automaticas de auditoria por tabela, caso desejado.
