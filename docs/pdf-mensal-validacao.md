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

## Publicação conjunta na homologação em 27/10/2026

O bundle `entrega-rh.bundle` foi recebido, conferido com o SHA-256 `811e3a084af51ca4b10765cb667f742bfebabc5c722a8c44cb48590e72c21042` e validado por `git bundle verify`. A branch do responsável avançou por fast-forward até `c88f153c8a5b27f4d5c68c0013234718b7df5f77`, preservando os commits originais `529f9c8`, `3667c0a`, `e8e7ce3` e a revisão `7086730`. A branch `codex/rh-homologacao-pdf` foi enviada ao GitHub sem rebase ou push forçado. `main` não foi alterada.

Publicação confirmada:

| Item | Valor |
| --- | --- |
| Domínio | https://concept21-rh-homologacao.vercel.app |
| Commit da aplicação publicada | `c88f153c8a5b27f4d5c68c0013234718b7df5f77` |
| Projeto Vercel | `concept21-rh-homologacao` |
| Project ID | `prj_7WWMGTE7cuoJjCoF4Z2rp9YvKynv` |
| Deployment aprovado | `dpl_GQxrVXukWsg8zLykm15gH82zTugQ` |
| Supabase exclusivo dos testes | `rcoqywqyjcxdzchojxzs` |
| Deployment anterior para reversão | `dpl_9sYRQvxSCVgNVWxABFPnuqMPTV2f` |

O build foi preparado em checkout limpo e isolado, sem trocar o domínio. Após os testes autenticados na URL temporária, foi promovido com o script protegido. A API confirmou que o domínio fixo aponta para o deployment aprovado; os testes foram repetidos nesse domínio. A proteção Vercel da URL temporária permaneceu habilitada e foi acessada pela identidade já autorizada da CLI, sem compartilhar credenciais ou bypass.

### Resultado da validação

- Passaram os 32 testes automatizados, TypeScript, ESLint e a compilação local; o build Vercel ficou READY.
- O perfil RH gerou a prévia e baixou o PDF mensal de outubro com seis colaboradores fictícios selecionados e todas as categorias. O resultado continha cinco ocorrências de dois colaboradores, conciliadas com a prévia.
- Tanto na URL temporária como no domínio fixo, um resumo fictício extenso produziu seis páginas. A extração encontrou os 120 marcadores exatamente uma vez, com colaborador e matrícula nas continuações. Filtros completos, margens, cabeçalhos, rodapés e todas as páginas renderizadas foram conferidos, sem páginas vazias ou texto oculto sob o cabeçalho.
- A auditoria confirmou `monthly_occurrence_report.pdf_generated`, competência `2026-10`, contagens e o filtro dos seis colaboradores. Eventos desta validação: `ce0f5607-ae5b-4c3d-a323-8246a26921c9` e `5cebdd3d-55ac-4548-9da0-cde061fd9ab5`.
- A recusa de documentos passou nos cenários descritos em `docs/recusa-documentos-validacao.md`, incluindo auditoria e negação pela RLS ao perfil restrito.
- Nos fluxos exercitados, não houve exceção JavaScript nem chamada ao Supabase de produção. A notificação de solicitação de acesso retornou envio suprimido.
- Somente documentos e ocorrências fictícios identificados por UUID e marcador próprios foram criados e removidos. A consulta final encontrou zero registros com o marcador desta validação; os eventos de auditoria foram preservados. Nenhum usuário, perfil de acesso ou arquivo do Storage foi alterado.

Os 32 checksums do histórico `app.homologation_bootstrap_files` foram comparados com o manifesto e os arquivos locais, sem divergências. Não houve migration, seed ou alteração de política. O projeto de produção permaneceu no deployment `dpl_5MV5ZvoZGMGYbvQpHGA7oU9ZCdtn`; a conferência final foi somente de leitura. O vínculo Vercel de produção na raiz não foi modificado.

### Pendências e acesso direto

A troca para a aba mensal por clique não concluiu nos testes com Chrome. O mesmo comportamento foi reproduzido no deployment anterior, antes da promoção; não foi introduzido pelo bundle. Nesta entrega, o PDF foi validado pelo endereço direto com os filtros na URL: https://concept21-rh-homologacao.vercel.app/rh/ocorrencias?tab=monthly-report&monthlyCompetence=2026-10. A correção da navegação permanece pendente; os resultados acima não certificam a troca de abas ou a edição dos filtros pela interface.

Também permanecem fora desta liberação os apontamentos anteriores de administração de perfis pelo RH, férias pendentes no Dashboard e tradução de `restricted`, além da triagem de dependências registrada na entrega inicial. Esta publicação não representa liberação de segurança nem autorização para produção.

Para reverter a aplicação, usar `node scripts/publish-homologation.mjs rollback dpl_9sYRQvxSCVgNVWxABFPnuqMPTV2f` em checkout isolado com destino de homologação validado, conforme `docs/entrega-homologacao-rh.md`, e conferir novamente o domínio. Não executar rollback de banco por causa desta entrega. Commits posteriores apenas de documentação não mudam o SHA da aplicação publicado acima.
