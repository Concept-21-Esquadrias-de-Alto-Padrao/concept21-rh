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

### Escopos

As permissoes podem ser concedidas com estes escopos:

- `all`: acesso a todos os registros cobertos pela permission key;
- `own_department`: acesso a colaboradores do mesmo departamento do employee vinculado ao profile atual;
- `subordinates`: acesso a toda a cadeia abaixo do employee atual em `employees.manager_employee_id`;
- `own_data`: acesso somente ao colaborador cujo `employees.profile_id` aponta para o profile atual;
- `none`: sem acesso.

Um usuario pode ter varios roles ativos. Nesses casos, os escopos sao somados por uniao. Exemplo: `own_department` em um role e `subordinates` em outro libera o registro se qualquer uma das duas regras permitir.

Perfis sem employee vinculado falham fechado para `own_data`, `own_department` e `subordinates`. O sistema nao tenta vincular por nome ou e-mail.

## Usuários

O Supabase Auth autentica usuários em `auth.users`. O sistema de RH não consulta `auth.users` diretamente no client; ele lista usuários por `public.profiles`, com perfis em `public.user_roles`.

Fluxo correto:

1. criar usuário em Supabase Auth;
2. criar ou vincular `public.profiles.auth_user_id` ao `auth.users.id`;
3. vincular um papel em `public.user_roles`;
4. acessar `/rh/configuracoes`, aba `Segurança e acessos`, para ver o usuário e seus perfis.

Se o usuário existe em Auth mas não aparece na tela, falta o registro em `public.profiles` ou o usuário logado não possui `hr.security.users.view`.

## RLS

Todas as tabelas sensiveis do RH tem RLS habilitado desde a migration `004_enable_hr_rls_and_storage.sql`.

Implementado:

- usuarios autenticados acessam conforme RBAC e escopo real do colaborador;
- Master acessa tudo com escopo `all`;
- policies separadas para visualizar, criar e editar;
- deletes diretos não são expostos para dados históricos;
- Storage privado protegido por policies em `storage.objects`.
- `app.has_permission()` continua respondendo apenas se o usuario possui a permissao em algum escopo valido;
- `app.permission_scopes()` retorna todos os escopos ativos distintos;
- `app.can_access_employee(employee_id, permission_key)` decide se aquele usuario pode acessar aquele colaborador;
- tabelas filhas com `employee_id` usam `app.can_access_employee`;
- vinculos transitivos, como itens de custo de movimentacao, resolvem o employee pelo registro pai;
- relatorios diarios persistidos sao historicos agregados e exigem escopo `all`.

Leia tambem `docs/security-rbac-rls.md` antes de criar novas tabelas ligadas a colaboradores.

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
- path obrigado no formato `employees/{employee_id}/documents/{document_id}-{filename}` para que a policy de Storage extraia o colaborador e aplique o escopo correto.

## Ocorrências

Ocorrências nao possuem anexos na experiencia ativa. A coluna legada `occurrence_types.requires_attachment` permanece no banco por compatibilidade, mas deve ficar sempre `false`. A tabela `employee_occurrence_attachments` permanece apenas para leitura historica autorizada e novos inserts da aplicacao sao bloqueados por RLS.

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
