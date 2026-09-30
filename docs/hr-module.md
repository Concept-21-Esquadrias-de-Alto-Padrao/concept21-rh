# Notas técnicas do módulo de RH

## Arquitetura

O módulo fica em `src/modules/hr` e separa:

- `components`: UI reutilizavel;
- `hooks`: carregamento de dados;
- `pages`: telas usadas pelo App Router;
- `services`: acesso ao Supabase Client;
- `types`: tipos de dominio;
- `utils`: formatação, status e validações.

As rotas ficam em `src/app`.

## Permissões

Perfis iniciais:

- Master
- RH
- Diretoria
- Financeiro
- Gestor
- Colaborador
- Operacional

Permissões iniciais usam chaves como:

- `hr.employees.view`
- `hr.employees.create`
- `hr.documents.view`
- `hr.documents.manage`
- `hr.settings.manage`
- `hr.security.users.manage`

O perfil Master e protegido por trigger no banco e a funcao `app.has_permission` sempre considera `app.has_role('master')`.

## Usuários

O Supabase Auth autentica usuários em `auth.users`. O sistema de RH não consulta `auth.users` diretamente no client; ele lista usuários por `public.profiles`, com perfis em `public.user_roles`.

Fluxo correto:

1. criar usuário em Supabase Auth;
2. criar ou vincular `public.profiles.auth_user_id` ao `auth.users.id`;
3. vincular um papel em `public.user_roles`;
4. acessar `/rh/configuracoes`, aba `Segurança e acessos`, para ver o usuário e seus perfis.

Se o usuário existe em Auth mas não aparece na tela, falta o registro em `public.profiles` ou o usuário logado não possui `hr.security.users.view`.

## RLS

Todas as tabelas sensiveis do RH tem RLS habilitado na migration `004_enable_hr_rls_and_storage.sql`.

Implementado:

- usuários autenticados acessam conforme RBAC;
- Master acessa tudo via `app.has_role('master')`;
- policies separadas para visualizar, criar e editar;
- deletes diretos não são expostos para dados históricos;
- Storage privado protegido por policies em `storage.objects`.

Preparado para evolucao:

- filtro real por `own_department`;
- filtro real por `subordinates`;
- portal de colaborador com escopo `own_data`.

Antes de produção, valide as policies com usuários reais de cada perfil.

## Documentos

Fluxo:

1. cria registro em `employee_documents`;
2. envia arquivo para `hr-documents`;
3. grava `storage_path`;
4. auditoria registra `document.uploaded`;
5. acesso usa URL assinada.

Validacoes:

- MIME type permitido;
- tamanho maximo por tipo de documento;
- documentos não públicos.

## Configurações

A tela `/rh/configuracoes` permite ativar/inativar cadastros em vez de excluir:

- departamentos;
- cargos;
- tipos de vínculo;
- status;
- motivos de desligamento;
- documentos;
- afastamentos;
- ocorrências;
- treinamentos;
- perfis;
- campos personalizados;
- alertas.

Essa estratégia preserva histórico e evita perda de integridade.
