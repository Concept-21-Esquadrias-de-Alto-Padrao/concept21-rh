# Segurança RBAC + RLS

Este documento descreve a regra de autorizacao do modulo de RH.

## Auth x Authorization

Supabase Auth autentica usuarios em `auth.users`.

O RH autoriza acesso por tabelas publicas:

- `profiles`: perfil da pessoa no RH;
- `roles`: papeis como Master, RH, Gestor e Colaborador;
- `permissions`: chaves de permissao;
- `role_permissions`: permissao + escopo por papel;
- `user_roles`: papeis ativos do profile.

O frontend pode consultar permissoes para decidir o que mostrar, mas a barreira definitiva fica no PostgreSQL com RLS.

## Funcoes principais

`app.has_permission(permission_key text)` responde se o usuario possui a permissao em algum escopo diferente de `none`. Ela nao decide se um registro especifico pode ser acessado.

`app.permission_scopes(permission_key text)` retorna todos os escopos ativos distintos da permissao. Master retorna `['all']`.

`app.current_employee_id()` encontra o employee vinculado ao profile autenticado via:

```txt
auth.users -> profiles.auth_user_id -> employees.profile_id
```

`app.can_access_employee(employee_id, permission_key)` decide se o usuario pode acessar aquele colaborador com aquela permissao.

`app.can_access_employee_from_storage_path(object_name, permission_key)` extrai o UUID do path `employees/{employee_id}/...` e aplica a mesma regra de colaborador.

## Escopos

`all`: acesso a todos os registros cobertos pela permission key.

`own_data`: acesso ao colaborador cujo `employees.profile_id = app.current_profile_id()`.

`own_department`: acesso ao mesmo departamento do employee atual. Departamento nulo nao libera acesso.

`subordinates`: acesso a toda a cadeia abaixo do employee atual via `employees.manager_employee_id`, usando recursive CTE com protecao contra ciclos.

`none`: nenhum acesso.

Usuarios com multiplos roles recebem a uniao dos escopos. Se qualquer escopo permitir o registro, o acesso e concedido.

Profiles sem employee vinculado falham fechado para `own_data`, `own_department` e `subordinates`.

## Como aplicar em tabelas

Para tabelas com `employee_id` direto:

```sql
using (app.can_access_employee(employee_id, 'hr.modulo.acao'))
with check (app.can_access_employee(employee_id, 'hr.modulo.acao'))
```

Para tabelas transitivas, resolva o employee pelo pai:

```sql
exists (
  select 1
  from public.employee_movements m
  where m.id = employee_movement_cost_items.movement_id
    and app.can_access_employee(m.employee_id, 'hr.movements.view')
)
```

Para tabelas de custos, use sempre permissoes do modulo de custos, como `hr.labor_costs.view_sensitive_values` e `hr.labor_costs.manage`. Nao troque custos por `hr.employees.view`.

Para dependentes, use `hr.employees.dependents.view` e `hr.employees.dependents.manage`; dependentes nao devem ser liberados apenas por `hr.employees.view`.

## Storage

O bucket `hr-documents` permanece privado.

Paths de documentos devem seguir:

```txt
employees/{employee_id}/documents/{document_id}-{filename}
```

Paths invalidos falham fechado. O parser valida o formato UUID antes de fazer cast.

Deletes diretos no Storage continuam restritos ao Master, conforme a protecao de hard delete.

## Relatorios agregados

Relatorios persistidos podem conter texto consolidado de varios colaboradores ou departamentos. Quando a linha salva nao consegue ser limitada com seguranca ao escopo do usuario, a leitura historica deve exigir scope `all`.

O relatorio diario de ocorrencias segue essa regra.

Relatorios gerados em tempo real por queries do cliente herdam RLS das tabelas consultadas.

## Ocorrencias

Ocorrencias nao aceitam novos anexos. A estrutura `employee_occurrence_attachments` fica preservada apenas para leitura historica autorizada. A coluna `occurrence_types.requires_attachment` e legada e deve permanecer `false`.

## Checklist para nova tabela ligada a employee

- A tabela tem `employee_id` direto? Use `app.can_access_employee`.
- A tabela aponta para outro registro que aponta para employee? Resolva via `exists`.
- A acao tem permission key propria? Use a permission key do modulo correto.
- Custos, documentos e dependentes precisam de permissoes especificas.
- `INSERT` precisa de `with check`.
- `UPDATE` precisa de `using` e `with check`.
- Nao reintroduza delete nao-Master para dados historicos.
- Se envolver Storage, coloque o employee no path e valide por RLS.
- Se o registro salvo agrega varias pessoas, considere exigir `all`.

## Testes recomendados

- Master deve ver tudo.
- RH e Diretoria devem manter acessos concedidos com `all`.
- Gestor com `own_department` nao deve acessar outro departamento.
- Colaborador com `own_data` deve ver somente o proprio employee.
- `subordinates` deve percorrer toda a cadeia hierarquica.
- Usuario com `own_department + subordinates` deve receber a uniao.
- Profile sem employee nao deve receber dados por escopos relacionais.
