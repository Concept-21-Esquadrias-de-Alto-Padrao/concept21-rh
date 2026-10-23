# Entrega da homologação do RH para desenvolvimento

Referência: 23/10/2026. Destinatário: Eduardo e equipe de testes. Esta entrega alinha a cópia `rh-dev` ao código publicado, sem mudar o banco, publicar uma nova aplicação ou liberar produção.

## 1. Código publicado e cópia reproduzível

Repositório: https://github.com/Concept-21-Esquadrias-de-Alto-Padrao/concept21-rh.

Branch de entrega: `codex/homologacao-rh`. Snapshot exato das fontes da aplicação publicada: **`2bd190d4fb4714a7fae775e9ef43599f0d74d007`**. Os commits posteriores desta entrega acrescentam documentação e ferramentas, sem mudar as fontes do build.

O deployment atual foi enviado por CLI antes de existir esse snapshot. Seus metadados apontam para a base antiga `1f2da7b13bbb10451d12630859dd99a41857ac51`, acrescida de alterações locais. Portanto, fazer checkout apenas de `1f2da7b` NÃO reproduz a homologação. Não houve novo deploy apenas para mudar esses metadados.

Deployment: `dpl_9sYRQvxSCVgNVWxABFPnuqMPTV2f`, estado READY.

URL imutável: https://concept21-rh-homologacao-m2n9c8x2m-concept-aluminium.vercel.app.

Domínio de testes: https://concept21-rh-homologacao.vercel.app.

O arquivo `docs/homologation-state.json` registra a comparação dos arquivos de fonte disponibilizados pelo Vercel com os arquivos locais e com os blobs do snapshot, além do histórico SQL aplicado. Diferenças de CRLF/LF são consideradas na verificação do checkout; não se deve editar migrations antigas para ajustar quebras de linha.

Na cópia `rh-dev`, com a branch de PDFs ainda sem mudanças:

```powershell
git status --short
git fetch origin
git switch codex/rh-homologacao-pdf
git merge --ff-only origin/codex/homologacao-rh
git rev-parse HEAD
npm ci
node scripts/verify-homologation-baseline.mjs
```

Se o merge não for fast-forward, pare e confira o histórico; não use reset forçado nem sobrescreva trabalho local. Não é necessário renomear a branch de PDFs. O último comando verifica as fontes e os SQLs, sem acessar o banco. Depois de corrigir PDFs, diferenças nas fontes serão esperadas; registre o novo commit e execute os testes da alteração, sem atualizar o manifesto para fingir igualdade com o deployment anterior.

## 2. O que deixou de estar somente nesta máquina

O snapshot inclui todas as alterações de aplicação usadas no deployment: identificação visual do ambiente de testes, recusa de configuração misturando ambientes, bloqueio de cadastro público e notificações, senha própria na homologação, identificação da competência e da base dos custos, conciliação de snapshots fechados com filtros e os testes unitários correspondentes.

Também inclui `config/homologation.json`, scripts de provisionamento/publicação/verificação, fixtures fictícias, hook de bloqueio de e-mails e `docs/evolucao-rh-homologacao.md`.

Não fazem parte da entrega: `.env*`, `.vercel`, `.homologation`, senhas, tokens, sessões de navegador, planilha real de salários ou credenciais administrativas. Um manual local anterior, alheio a esta entrega, também não é necessário para reproduzir o build.

As observações da rodada RH sobre vinculação de perfis, férias solicitadas e o rótulo `restricted` ainda estão pendentes nesta base. Em especial, não testar alterações de perfis usando contas reais nem considerar a abertura do formulário uma comprovação da autorização do servidor. Coordenar essa correção separadamente da frente de PDFs. Motor operacional da folha e controle ampliado de recessos continuam fora da implementação entregue.

## 3. Executar somente contra a homologação

Pré-requisitos: Node.js 24.x, npm e uma cópia exclusiva para testes. Não transportar `.env.local` ou a pasta `.vercel` desta máquina, pois o vínculo antigo da raiz aponta para produção. O novo runner recusa qualquer arquivo `.env*` na raiz, em vez de carregá-lo implicitamente.

### Configuração e canal seguro

O canal preferencial é o próprio Vercel autenticado: o responsável concede ao desenvolvedor o menor acesso disponível ao projeto **concept21-rh-homologacao**, usando a conta nominal do desenvolvedor. Não compartilhar login, token de equipe ou acesso a produção. Se o plano não permitir o isolamento desejado, a publicação permanece com o responsável; não ampliar o acesso só para executar os testes locais.

Com esse acesso, autentique a CLI no próprio computador e prepare o arquivo local:

```powershell
npx --yes vercel@50.28.0 login
node scripts/prepare-homologation-local.mjs
node scripts/run-homologation-local.mjs check
node scripts/run-homologation-local.mjs dev
```

O preparo faz apenas consultas autenticadas ao projeto de homologação e grava `.homologation/local-env.json`, ignorado pelo Git e pelo deploy. Lê somente as cinco variáveis públicas necessárias, sem solicitar ou copiar `SUPABASE_SERVICE_ROLE_KEY`, senha do banco, token Supabase ou qualquer valor de produção. Não exibe valores de variáveis no terminal.

Se o desenvolvedor não tiver acesso Vercel, o responsável pode disponibilizar esse arquivo pelo cofre corporativo com compartilhamento nominal e restrito. O modelo, sem chave, está em `config/homologation-local.example.json`. Não enviar o arquivo nesta conversa, em comentário de issue, commit ou canal público. O arquivo desta máquina, por si só, não fica acessível no computador do Eduardo. Esta entrega não confirma um convite Vercel ou compartilhamento de cofre já aceito.

As cinco variáveis locais são `NEXT_PUBLIC_APP_ENV=homologation`, `NEXT_PUBLIC_HOMOLOGATION_SUPABASE_REF=rcoqywqyjcxdzchojxzs`, URL Supabase correspondente, a chave **publishable** desse projeto e `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Nunca colocar uma chave administrativa sob prefixo `NEXT_PUBLIC_`.

O runner valida o destino antes de iniciar o Next.js, injeta explicitamente a configuração e esvazia chaves administrativas, URLs de conexão direta e configuração de envio de e-mails. A chave publishable permite autenticação e consultas submetidas às políticas RLS; não concede poder administrativo. Rotas administrativas que dependem da chave server-side não ficam disponíveis localmente por esse caminho. Isso é intencional e não impede testar geração de PDFs por um usuário autenticado com as permissões adequadas.

Abra http://localhost:3000 e entre com o e-mail e a senha **da homologação** já definidos pelo usuário. Auth e Storage continuam remotos, mas exclusivamente no projeto de testes. Credenciais de produção não funcionam automaticamente neste ambiente. Para alternar Master, RH e restrito, use sessões de navegador separadas e credenciais entregues individualmente por canal seguro.

Para outra porta, ajuste somente `NEXT_PUBLIC_APP_URL` no arquivo privado, por exemplo `http://localhost:3001`; o runner usa a mesma porta. O servidor escuta apenas em 127.0.0.1. Não expor a porta em rede nem criar túnel com dados salariais sem controle de acesso. Login com senha não requer mudar URLs de redirecionamento no Supabase. Links iniciais continuam sendo emitidos pelo responsável para o domínio publicado; não liberar curingas de redirect para facilitar testes.

### Separações que precisam permanecer

| Recurso | Destino exclusivo de testes |
| --- | --- |
| Banco e Auth | `rcoqywqyjcxdzchojxzs` |
| Organização Supabase | Concept A, `vaxcezwtgfrtnrkwcecn` |
| Storage | Bucket privado `hr-documents` no mesmo projeto de testes |
| Dados | Colaboradores e valores fictícios; não importar a planilha real para testes gerais |
| Cadastro público | Desabilitado no Auth e na aplicação |
| Notificação da aplicação | Retorna `suppressed: true`, sem chamar provedor |
| E-mails do Auth | Hook privado `app.block_homologation_email`, erro `HOMOLOGACAO_EMAIL_BLOCKED` |

Não configurar Resend, SMTP real nem remover o hook. A recuperação automática por e-mail também fica bloqueada: o responsável reemite o acesso pessoal quando necessário. Testes locais compartilham o banco de homologação com os demais validadores; gravações não são privadas do computador. Combine a massa e preserve registros que outras pessoas estejam conferindo.

## 4. Publicar, validar e reverter no Vercel

| Identificação | Valor |
| --- | --- |
| Projeto | `concept21-rh-homologacao` |
| Project ID | `prj_7WWMGTE7cuoJjCoF4Z2rp9YvKynv` |
| Equipe | `concept-aluminium` |
| Team ID | `team_CQgXB4kvuQBOXiv4siUoGnUe` |
| Integração Git desta homologação | Nenhuma na conferência de 23/10/2026; publicação por CLI |

Fazer push na branch não atualiza automaticamente esse domínio. Não conectar a branch de testes ao projeto de produção. Não executar `vercel --prod`, `vercel link`, `vercel env pull` ou rollback genérico na raiz deste repositório. O projeto chamado **concept21-rh**, sem o sufixo, é produção e não deve ser alterado nesta frente.

Antes de publicar:

```powershell
node --test tests/*.test.mjs
npx tsc --noEmit
npm run lint
node scripts/run-homologation-local.mjs build
git diff --check
git status --short
```

Faça commit, push da branch de trabalho e confira o SHA. Em seguida, por alguém com acesso de publicação autorizado:

```powershell
node scripts/publish-homologation.mjs inspect
node scripts/publish-homologation.mjs stage
```

O novo script confirma o ID exato de equipe/projeto e as variáveis públicas remotas, recusa configuração de e-mail externo e exige checkout limpo. Monta uma pasta isolada com os arquivos do commit, sem segredos, mantendo o vínculo Vercel da raiz intocado. Não altera variáveis remotas nem executa SQL. `stage` usa `--prod --skip-domain`: neste caso, **prod designa o ambiente principal do projeto Vercel de HOMOLOGAÇÃO**, não o sistema de produção da empresa. O domínio de testes ainda não muda nessa etapa.

Confira a URL retornada pelo build. Se aparecer proteção Vercel, use o login nominal autorizado; não desabilite a proteção nem compartilhe bypass no Git. Verifique faixa AMBIENTE DE TESTE, login RH/Master/restrito, host Supabase correto, permissões e bloqueio de notificação. Para os PDFs, conferir filtros completos, acentos, quebra de texto, cabeçalhos repetidos, nenhuma linha escondida ou página vazia, paginação e correspondência entre PDF e tela. Cobrir zero registros, uma página, várias páginas e textos longos. Registrar navegador, filtros, commit, deployment e evidências sem dados pessoais reais.

Depois de aprovado, obtenha o ID `dpl_` em `vercel inspect URL` ou no painel do projeto. Promova somente esse build:

```powershell
node scripts/publish-homologation.mjs promote ID_DPL_APROVADO
node scripts/publish-homologation.mjs inspect
```

Substitua `ID_DPL_APROVADO` pelo ID real. O script recusa deployments de outros projetos ou que não estejam READY/preparados como ambiente principal. Repita os testes rápidos no domínio fixo após a promoção. O script legado `deploy-homologation.mjs` continua versionado para rastrear a primeira entrega, mas sincroniza variáveis administrativas e publica diretamente; **não usá-lo nesta frente de PDFs**.

Reversão de aplicação, também somente neste projeto:

```powershell
node scripts/publish-homologation.mjs rollback dpl_9sYRQvxSCVgNVWxABFPnuqMPTV2f
node scripts/publish-homologation.mjs inspect
```

O ID acima é o ponto de retorno desta entrega; nos próximos ciclos registre o deployment anterior antes de promover. Rollback do Vercel não desfaz dados, SQL ou arquivos do Storage. Depois de rollback, novos builds podem ficar sem atribuição automática de domínio até uma promoção explícita; o procedimento já prevê essa promoção. Não executar rollback de banco, exclusões de massa ou restore por causa de um problema de layout de PDF.

## 5. Migrations e banco

Histórico conferido diretamente na homologação: **32 arquivos** em `app.homologation_bootstrap_files`, com SHA-256 por arquivo. São 26 migrations, de `001_create_hr_core_tables.sql` até `026_fix_termination_movements_status_and_duplicates.sql`, quatro seeds e os dois arquivos exclusivos de homologação (`fixtures.sql` e `block-email.sql`). A lista completa e checksums estão em `docs/homologation-state.json`.

A tabela padrão `supabase_migrations.schema_migrations` não existe nesse ambiente. O bootstrap original aplicou os arquivos e registrou seu próprio histórico transacional. Não interpretar uma lista vazia da CLI como migrations pendentes e não rodar `supabase db push` para tentar preencher esse histórico.

Para a frente de PDFs, **não há migration a executar**. Não rodar bootstrap, seeds, fixtures, `db reset`, `db push`, `config push`, `migration repair` nem os comandos `npm run db:migrations:*` do projeto: o runner antigo pode usar a configuração/vínculo de produção. Não editar nenhum dos 32 arquivos já aplicados. Não copiar a pasta `supabase/.temp` desta máquina.

Se uma correção futura realmente exigir banco: apresentar SQL novo e impacto ao responsável; confirmar explicitamente `rcoqywqyjcxdzchojxzs`; inspecionar estrutura/políticas atuais; preparar backup/retorno; criar migration nova com a CLI; revisar autorização/RLS; aplicar somente no projeto de testes por operador autorizado; registrar checksum e atualizar o manifesto após validar. Não usar acesso administrativo para contornar uma falha de permissão do perfil RH. Não registrar versões como aplicadas sem efetivamente conferir a estrutura.

## 6. Limites desta entrega

Nenhuma correção de PDFs, regra de autorização ou férias é declarada concluída por esta transferência. A base permanece a que foi testada pelo Eduardo. Nenhum novo deployment, alteração de dados, mudança de perfil, convite de conta, migration ou mudança de produção faz parte da entrega. O compartilhamento de acesso a ferramentas depende de autorização nominal e deve permanecer separado do código.

Referências operacionais: [fontes de um deployment na API Vercel](https://vercel.com/docs/rest-api/deployments/list-deployment-files), [promoção de deployment](https://vercel.com/docs/deployments/promoting-a-deployment), [reversão](https://vercel.com/docs/instant-rollback) e [variáveis no Next.js](https://nextjs.org/docs/app/guides/environment-variables).
