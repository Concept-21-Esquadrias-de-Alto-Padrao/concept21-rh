# Correção do PDF mensal de ocorrências

Base: 7ef08478b3529c8f8cfa98dfed3a6a7cd48e3a47, alinhada ao snapshot de homologação.

## Alterações

- Filtros quebram linha dentro da margem e deslocam cartões e tabelas conforme a altura real. Filtros muito extensos podem continuar em outra página.
- Resumos extensos são apresentados em trechos limitados, repetindo colaborador e matrícula. Os trechos seguintes indicam continuação; dias impactados aparecem apenas no primeiro trecho.
- Reserva de espaço para o título e a primeira linha da seção de detalhes.
- A renderização fica separada das consultas e da auditoria, permitindo testes sem conexão ao banco. O fluxo de download e seu evento de auditoria permanecem no serviço original.

## Verificações informadas na entrega original

- Comparação inicial: 143 fontes e 32 SQLs iguais à entrega. Nenhuma migration executada.
- 22 testes automatizados, TypeScript, ESLint e build webpack aprovados.
- PDFs com dados fictícios: básico (1 página), 70 nomes no filtro e resumo de 100 linhas (5 páginas), 100 registros distintos (5 páginas), e relatório vazio.
- Identidade preservada nas páginas com continuação, sem alterar os dados ou totais de origem.
- Revisão visual e conferência de limites do texto nos arquivos de teste.

## Revisão e aplicação pelo responsável em 27/10/2026

Patch de origem: `529f9c853116bea46b603f5b058a80810e11c945`. Arquivo recebido com SHA-256 `0a5646154ba587ee980a489e4e348413818c16bb07e6f3e4a8cbb61a5d0fcce4`.

Aplicado sem conflitos na branch `codex/rh-homologacao-pdf`, sobre a base `51dc7a0`, como `d180657a41c48eb232a0637928685d2396b2c8ac`. O SHA difere por causa da base e do novo registro de aplicação; a autoria foi preservada e o patch-id estável confirmou que o diff importado é idêntico: `a6bb8750241d91f7d1aa93e6eeafeae19c13bbe1`.

- Passaram os 26 testes disponíveis após a aplicação; dois testes adicionais de regressão elevaram o total para 28. Os adicionais cobrem cem colaboradores com identificações distintas e filtros com 650 seleções distribuídos em várias páginas.
- TypeScript, ESLint e build Next.js/Turbopack passaram. O build foi executado em uma cópia isolada com configuração exclusiva de homologação, sem chave administrativa.
- Foram gerados e renderizados quatro PDFs fictícios: básico (1 página), filtros e resumo extensos (6 páginas), cem colaboradores distintos (5 páginas) e sem registros (1 página). O texto da massa extensa é maior que o usado na entrega original, por isso a paginação não precisa ser a mesma.
- A extração conferiu todos os 70 nomes do filtro extenso, as cem linhas do resumo e os cem registros distintos, sem perda ou repetição. Foram conferidos limites de texto, cabeçalhos, rodapés e identidade nas páginas de continuação. Não houve página vazia ou texto sob o cabeçalho nos cenários exercitados.
- As consultas de origem, o nome do download e o evento de auditoria foram preservados na revisão do diff. A geração autenticada e a auditoria na aplicação publicada ainda precisam ser verificadas após um deploy autorizado de homologação.

A mudança posterior `3667c0a`, referente à recusa de documentos, não foi recebida nem aplicada. Esta revisão não executou SQL, migrations, alterações de permissões ou deploys. Artefatos fictícios e análise ficaram em `tmp/pdfs/review-529f9c8`, ignorado pelo Git; não contêm dados reais.

## Publicação

Usar exclusivamente o procedimento de docs/entrega-homologacao-rh.md. Estes testes locais não substituem a validação autenticada no navegador após a publicação. Não executar SQL, bootstrap, atualização de dependências ou publicação no projeto de produção nesta frente.

## Conciliação na cópia do Eduardo em 27/10/2026

Preservados os commits locais 529f9c8, 3667c0a e e8e7ce3 e incorporada a revisão remota até 7086730. Os testes adicionais de ambas as cópias foram mantidos. A indicação acima de que 3667c0a não havia sido recebido descreve a revisão do responsável naquele momento; a cópia local conciliada contém essa correção. Nenhum deploy ou SQL faz parte desta conciliação.
