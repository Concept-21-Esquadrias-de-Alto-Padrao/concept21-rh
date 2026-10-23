# Correção do PDF mensal de ocorrências

Base: 7ef08478b3529c8f8cfa98dfed3a6a7cd48e3a47, alinhada ao snapshot de homologação.

## Alterações

- Filtros quebram linha dentro da margem e deslocam cartões e tabelas conforme a altura real. Filtros muito extensos podem continuar em outra página.
- Resumos extensos são apresentados em trechos limitados, repetindo colaborador e matrícula. Os trechos seguintes indicam continuação; dias impactados aparecem apenas no primeiro trecho.
- Reserva de espaço para o título e a primeira linha da seção de detalhes.
- A renderização fica separada das consultas e da auditoria, permitindo testes sem conexão ao banco. O fluxo de download e seu evento de auditoria permanecem no serviço original.

## Verificações locais

- Comparação inicial: 143 fontes e 32 SQLs iguais à entrega. Nenhuma migration executada.
- 22 testes automatizados, TypeScript, ESLint e build webpack aprovados.
- PDFs com dados fictícios: básico (1 página), 70 nomes no filtro e resumo de 100 linhas (5 páginas), 100 registros distintos (5 páginas), e relatório vazio.
- Identidade preservada nas páginas com continuação, sem alterar os dados ou totais de origem.
- Revisão visual e conferência de limites do texto nos arquivos de teste.

## Publicação

Usar exclusivamente o procedimento de docs/entrega-homologacao-rh.md. Estes testes locais não substituem a validação autenticada no navegador após a publicação. Não executar SQL, bootstrap, atualização de dependências ou publicação no projeto de produção nesta frente.
