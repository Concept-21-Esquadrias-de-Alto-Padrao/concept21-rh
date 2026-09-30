# Padrão Global de Filtros

Este projeto usa uma camada compartilhada em `src/components/filters` para evitar filtros avulsos por tela.

## Regra principal

Filtros categóricos que representam entidades ou listas fechadas devem aceitar múltiplas opções quando fizer sentido operacionalmente.

Exemplos: departamento, cargo, status, tipo de vínculo, colaborador, tipo de ocorrência, categoria, treinamento, perfil, obra, fornecedor e responsável.

Campos de cadastro continuam respeitando a cardinalidade do registro. Exemplo: o cadastro do colaborador mantém um único cargo atual; o filtro por cargo pode aceitar vários cargos.

## Matriz de componentes

| Natureza | Componente |
| --- | --- |
| Categoria ou entidade | `MultiSelectFilter` |
| Texto | `SearchFilter` |
| Data | `DateFilter` |
| Intervalo de datas | `DateRangeFilter` |
| Número | `NumberFilter` |
| Faixa numérica | `NumberRangeFilter` |
| Sim/Não | `BooleanFilter` |
| Competência | `CompetenceFilter` |

## Lógica de filtragem

Dentro do mesmo filtro categórico, a lógica é `OR`.

Entre filtros diferentes, a lógica é `AND`.

Exemplo:

```txt
(Produção OR Obras)
AND (Ativo OR Em experiência)
AND (CLT OR PJ)
```

No Supabase, filtros por IDs devem usar `.in()` quando houver valores selecionados. Arrays vazios não devem aplicar filtro.

## Telas RH revisadas nesta rodada

- Dashboard de RH: Departamento, Tipo de vínculo e Status.
- Colaboradores: Departamento, Cargo, Status e Tipo de vínculo.
- Admissões e desligamentos: Tipo, Departamento, Colaborador e Status.
- Folha de Pagamento: Colaborador, Departamento, Tipo de vínculo e Status.
- Ocorrências, lista: Colaborador e Tipo de ocorrência.
- Ocorrências, ranking: Departamento, Status do colaborador, Colaborador e Tipos de ocorrência.
- Ocorrências, relatório diário: Departamento e Tipo de ocorrência.
- Ocorrências, relatório mensal: Departamento, Colaborador e Tipo de ocorrência.

## Telas não migradas

- Documentos, Férias e Treinamentos: os selects encontrados nesta revisão são campos de formulário/cadastro, não filtros de lista.
- Outros módulos citados no escopo amplo, como Comercial, Suprimentos, Obras, Produção, Financeiro e Administrativo, não existem como módulos neste repositório.

## Como reutilizar

Importe os componentes pelo barrel global:

```tsx
import { MultiSelectFilter, SearchFilter } from "@/components/filters";
```

Para filtros de entidades, monte as opções a partir dos cadastros reais do banco e nunca de listas fixas no frontend, exceto enums internos do sistema.

## Persistência de filtros na URL

Filtros de listagem e relatórios devem usar `useFilterSearchParams`, em `src/hooks/useFilterSearchParams.ts`, com helpers de parsing em `src/lib/filters/search-param-utils.ts`.

Convenção adotada:

| Tipo | Formato |
| --- | --- |
| Texto | `q=joao` |
| Multiselect | CSV de IDs: `departments=id1,id2` |
| Data | ISO: `date=2026-09-30` |
| Competência | `YYYY-MM`: `competence=2026-09` |
| Booleano | `true` ou `false` |
| Página | número positivo em `page`, quando a tela tiver paginação |

Valores padrão devem ser omitidos. Exemplo: sem filtros, sem busca e página 1 devem manter a URL limpa.

Use `router.replace` por meio do hook para filtros e busca, preservando o histórico do navegador para navegação real entre telas. Mudanças de filtro devem remover `page`, quando esse parâmetro existir.

Exemplo:

```tsx
const filterParams = useFilterSearchParams();
const departmentIds = filterParams.getArray("departments");

<MultiSelectFilter
  label="Departamento"
  options={departmentOptions}
  values={departmentIds}
  onChange={(nextDepartmentIds) =>
    filterParams.replaceParams({ departments: nextDepartmentIds }, { resetPage: true })
  }
/>
```

Nunca persistir dados sensíveis em query params. Não colocar CPF, salário, justificativas, descrições médicas, documentos, tokens ou observações privadas na URL.

## Paginação e ordenação de listagens

Listagens grandes devem paginar no servidor, não no browser. A tela deve aplicar, nesta ordem:

```txt
Busca
Filtros
Ordenação
Paginação
```

O total exibido deve ser o total real dos registros que atendem busca + filtros, antes de aplicar `.range()`. No Supabase, use `.select(..., { count: "exact" })` quando a política de RLS da tela permitir.

Convenção adotada:

| Parâmetro | Uso |
| --- | --- |
| `page` | página atual, começando em 1 |
| `pageSize` | quantidade por página |
| `sort` | chave lógica da coluna ordenada |
| `order` | `asc` ou `desc` |

Defaults devem manter a URL limpa. Para o piloto de `RH > Colaboradores`, os defaults são:

```txt
page = 1
pageSize = 25
sort = name
order = asc
```

Opções de tamanho de página:

```txt
25
50
100
```

Ao mudar busca, filtros, ordenação ou tamanho de página, remova `page` para voltar à primeira página. O botão "Limpar filtros" deve limpar filtros de negócio, busca, `page`, `sort` e `order`, preservando `pageSize` como preferência de navegação daquela sessão.

Nunca usar diretamente o valor de `sort` como coluna SQL. Cada tela deve definir uma allowlist segura de chaves lógicas para colunas reais. Em `RH > Colaboradores`, a allowlist inicial é:

| `sort` | Ordenação |
| --- | --- |
| `name` | `full_name` |
| `department` | relacionamento `department(name)` |
| `position` | relacionamento `position(name)` |
| `status` | relacionamento `status(name)` |
| `hireDate` | `hire_date` |

Para relações trazidas no `select`, use a sintaxe de ordenação relacional do PostgREST, como `department(name)`, e mantenha desempates estáveis, por exemplo `full_name` e `id`. A paginação deve usar:

```ts
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

query.range(from, to);
```

Componentes reutilizáveis de paginação e ordenação ficam em `src/components/data-table`. Use `SortableTableHeader` em colunas clicáveis, `DataTablePagination` para navegar e `DataTablePageSize` para escolher 25/50/100.

## Parâmetros usados no RH

| Tela | Parâmetros |
| --- | --- |
| Dashboard | `scope`, `competence`, `departments`, `employmentTypes`, `statuses` |
| Colaboradores | `q`, `departments`, `positions`, `statuses`, `employmentTypes`, `page`, `pageSize`, `sort`, `order` |
| Admissões e desligamentos | `competence`, `types`, `departments`, `employees`, `statuses` |
| Folha de Pagamento | `competence`, `employees`, `departments`, `employmentTypes`, `statuses` |
| Ocorrências - abas | `tab` |
| Ocorrências - lista | `employees`, `occurrenceTypes`, `date` |
| Ocorrências - ranking | `rankingDepartments`, `rankingStatuses`, `rankingEmployees`, `rankingOccurrenceTypes`, `rankingDateFrom`, `rankingDateTo` |
| Ocorrências - relatório diário | `dailyDate`, `dailyDepartments`, `dailyOccurrenceTypes` |
| Ocorrências - relatório mensal | `monthlyCompetence`, `monthlyDepartments`, `monthlyEmployees`, `monthlyOccurrenceTypes`, `monthlyPayrollRelevant` |

## ActiveFilters

Quando a tela usar `ActiveFilters`, o `onRemove` do chip deve atualizar a URL pelo mesmo hook. O botão "Limpar filtros" deve remover apenas os parâmetros daquele contexto, mantendo outros parâmetros relevantes da página.

