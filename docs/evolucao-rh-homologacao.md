# Evolução do RH: homologação, folha e ausências

Data da avaliação: 21/10/2026. Referência de código: branch `codex/homologacao-rh`.

## Identificação dos ambientes

| Item | Produção | Homologação |
| --- | --- | --- |
| Uso | Operação diária | Validação com dados fictícios |
| Projeto Supabase | RH Concept21 | RH Concept21 - HOMOLOGACAO - SOMENTE TESTES |
| Referência Supabase | sdyjujqwgsxdrzfuyydm | rcoqywqyjcxdzchojxzs |
| Organização Supabase | Concept A | Concept A |
| Projeto Vercel | concept21-rh | concept21-rh-homologacao |
| URL | https://concept21-rh.vercel.app | https://concept21-rh-homologacao.vercel.app |
| Contas e arquivos | Reais | Exclusivos do projeto de testes |

A URL de homologação só deve ser considerada entregue depois de constar como acessível no registro de validação. O custo adicional informado pelo Supabase foi de US$ 10/mês, autorizado pelo responsável nesta conversa. Consumo adicional depende do plano contratado.

### Registro de validação: primeira entrega disponível

Publicação concluída e acessível em 21/10/2026: https://concept21-rh-homologacao.vercel.app. Deployment verificado: `https://concept21-rh-homologacao-r7v3pa1et-concept-aluminium.vercel.app`. O build foi feito a partir da base `1f2da7b` com as alterações locais de homologação na branch indicada acima; não representa um novo commit publicado no GitHub.

- As 51 tabelas públicas têm as mesmas assinaturas de colunas da produção e RLS habilitado. Essa comparação não substitui uma comparação integral de funções, políticas e dados.
- Os três logins foram exercitados. Master e RH consultaram os seis colaboradores fictícios; a conta restrita consultou apenas HOM-003 e não recebeu remunerações.
- A chamada direta à API bloqueou escrita da conta restrita em outro colaborador. A exclusão da ocorrência temporária foi permitida ao Master e negada ao RH.
- Upload e download autorizado funcionaram no Storage privado de testes. A conta restrita não recebeu link do documento de outro colaborador. Os objetos temporários foram removidos após o teste.
- O cadastro público foi recusado pelo servidor. A recuperação de senha foi recusada pelo hook privado com `HOMOLOGACAO_EMAIL_BLOCKED`; a notificação da aplicação retornou envio suprimido.
- Navegador: Dashboard, colaboradores, ocorrências, consulta de custos e configurações carregaram. Conta restrita e login em celular foram conferidos; a faixa não cobriu o cabeçalho. Não houve exceções JavaScript nem chamadas a outro projeto Supabase nos fluxos exercitados.
- Passaram 13 testes unitários, 14 verificações de integração, sete verificações de navegador, TypeScript e ESLint. O build remoto do Vercel concluiu com sucesso.
- O bootstrap foi repetido sem reaplicar os arquivos registrados nem recriar contas. A contagem final permaneceu em seis colaboradores, quatro ocorrências e seis movimentações fictícias, com 32 arquivos SQL registrados. A comparação de contagens deve ser repetida quando forem acrescentados novos cenários.
- A produção não recebeu deploy ou SQL de alteração nesta entrega. A consulta final confirmou o deployment anterior `dpl_5MV5ZvoZGMGYbvQpHGA7oU9ZCdtn`.

Evidências locais, sem senhas: `.homologation/verification.json`, `.homologation/browser-verification.json` e `.homologation/screenshots/`. Comandos: `node --test tests/*.test.mjs`, `npx tsc --noEmit`, `npm run lint` e `node scripts/verify-homologation.mjs`. Publicação restrita ao novo projeto: `node scripts/deploy-homologation.mjs`.

A verificação de segurança do Supabase não apontou itens de nível ERROR. Permaneceram avisos da estrutura atual sobre search_path de função, extensões no schema público, RPCs SECURITY DEFINER e proteção de senhas vazadas. As RPCs autenticadas fazem parte da autorização existente; os avisos exigem revisão própria antes de uma liberação de novos módulos em produção. Não foi feita uma auditoria completa de segurança. Referências de tratamento: [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [extensões](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [execução anônima de funções](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

A identidade da homologação fica em `config/homologation.json`. O bootstrap fixa essa referência e nunca usa o vínculo local de produção como destino implícito. A aplicação exige `NEXT_PUBLIC_APP_ENV=homologation`, a referência de testes e a URL correspondente. Uma configuração que misture produção e teste é recusada.

O padrão do Técnico foi usado como referência para banco e autenticação independentes. Diferenças do RH: arquivos pessoais exigem também Storage privado separado; há valores salariais e perfis de acesso específicos; comunicação por e-mail deve ser bloqueada. A organização gratuita inicialmente considerada já estava no limite de projetos, por isso a criação foi autorizada em Concept A. A separação é entre projetos, mesmo dentro da mesma organização.

## Primeira entrega: sistema atual em homologação

Inclui a estrutura existente do RH reconstruída pelas migrations e seeds versionados, sem copiar usuários, salários, documentos ou registros operacionais reais. Contém seis colaboradores fictícios, remuneração de exemplo, ocorrências, férias, treinamento e documento pendente.

As contas de teste são Master, RH e Colaborador com escopo dos próprios dados. As senhas são aleatórias e ficam no arquivo local `.homologation/access.json`, ignorado no Git e no deploy. Cada pessoa que receber essas credenciais terá acesso conforme o perfil da conta. Login, Auth e Storage usam exclusivamente o projeto de testes.

### Entrega de acesso para validadores externos

O arquivo local de credenciais não é um meio de entrega para quem está em outro computador ou no ChatGPT Work. O validador deve receber um cadastro próprio na homologação, com o menor perfil necessário, e instruções por canal privado autorizado. Contas da produção não existem automaticamente no Auth de testes; nenhuma senha da produção deve ser copiada.

Para a validação remota, o administrador pode gerar links temporários de uso único e enviá-los individualmente ao endereço autorizado, sem divulgar senhas permanentes na conversa ou arquivos públicos. A emissão administrativa não requer liberar o envio automático do Supabase nem o cadastro público. Links de entrega devem ser diferentes dos consumidos na verificação técnica e seus tokens nunca entram no Git, documentação ou logs.

O acesso pessoal usa RH para Dashboard e módulos operacionais. Os perfis Master, RH e restrito podem ser exercitados com as contas fictícias separadas. O restrito continua vinculado apenas a HOM-003, sem salários. A conta pessoal não precisa de promoção permanente a Master para testar a conta Master fictícia.

Orientar o validador a usar perfis de navegador separados ou encerrar a sessão anterior antes de trocar de conta: abas comuns compartilham a sessão. Ao expirar ou consumir um link, solicitar nova emissão. Não prometer recuperação automática de senha neste ambiente, pois os envios automáticos permanecem bloqueados. Registrar destinatário, perfil, ambiente, data e confirmação de envio em registro privado, sem armazenar os tokens no registro de auditoria.

### Senha própria da homologação

A partir de 22/10/2026, o acesso inicial pode direcionar à tela `https://concept21-rh-homologacao.vercel.app/rh/minha-conta`. Após autenticar pelo link pessoal, o usuário confere a conta conectada e define uma senha própria com pelo menos 12 caracteres e confirmação idêntica. Os acessos seguintes são por e-mail e senha no login normal, sem novo link enquanto a senha for conhecida.

O ícone de chave no cabeçalho permite voltar à tela para alterar a senha. Após salvar, a opção "Entrar com a nova senha" encerra a sessão e abre o login. Senha da produção não é copiada, alterada ou compartilhada; a senha escolhida não integra documentos, logs ou e-mails de entrega.

O formulário exige uma sessão confirmada. O serviço valida a identidade atual novamente antes de chamar `auth.updateUser({ password })`, sem chave administrativa e sem aceitar outro usuário como destino. A operação não altera perfis ou permissões. A rota retorna 404 fora da homologação e o ícone não é exibido em produção.

Não há migration de banco para essa alteração. Cadastro público e envios automáticos continuam bloqueados. Se o usuário esquecer a senha e não conseguir entrar, o responsável reemite apenas um link pessoal de uso único, direcionado à tela de senha; a emissão administrativa não define uma senha em nome do usuário.

Validação em 22/10/2026: passaram 16 testes unitários, TypeScript, ESLint e 11 verificações no navegador contra a homologação publicada. Foram exercitados acesso sem sessão, link inicial, rejeição de senhas em branco e confirmações divergentes, exibição/ocultação, gravação por usuário RH, saída e novo login com senha, rejeição da senha antiga, preservação do perfil e layout no celular. As contas fictícias temporárias do teste foram removidas. A senha pessoal do destinatário não foi alterada pela equipe.

Deployment dessa entrega: `https://concept21-rh-homologacao-m2n9c8x2m-concept-aluminium.vercel.app`. O domínio de homologação está atualizado; o deployment da produção permaneceu `dpl_5MV5ZvoZGMGYbvQpHGA7oU9ZCdtn`, e a nova rota continua respondendo 404 no domínio de produção. Não houve commit/push nesta etapa. Evidências locais sem senhas: `.homologation/password-setup-verification.json` e capturas `password-form-desktop.png` e `password-form-mobile.png` na pasta privada de screenshots.

O cadastro público fica desabilitado no Supabase de testes e na aplicação. Contas são criadas já confirmadas pelo administrador, sem e-mail. O endpoint de envio de notificações devolve envio suprimido em homologação. Um hook Postgres privado recusa os envios do Supabase Auth, incluindo recuperação de senha e troca de e-mail, sem chamar provedor externo. Não se configura Resend nem remetente real nessa instalação.

Comando de provisionamento: `node scripts/bootstrap-homologation.mjs`. Usa a sessão existente da CLI, com referência explícita ao projeto de testes. Cada arquivo aplicado é registrado com checksum em tabela privada. Uma repetição pula arquivos já aplicados e recusa mudanças em arquivos antigos; não recria contas nem redefine senhas. Arquivos SQL e credenciais temporárias nunca entram no pacote da aplicação.

Esta primeira entrega permite validar os módulos atuais. O motor completo de folha, importação salarial e o controle separado de recesso e usufruto efetivo descritos abaixo são entregas posteriores e não devem ser confundidos com a consulta atual de custos.

## Etapas e estimativa inicial

Estimativa de esforço em dias úteis de desenvolvimento e validação técnica, após os insumos de cada etapa. Não é prazo automático nem compromisso de publicação sem testes. A disponibilidade do RH/contabilidade e o tempo de resposta às regras pendentes afetam o calendário.

| Etapa | Resultado verificável | Esforço estimado | Dependências |
| --- | --- | --- | --- |
| 1. Homologação | URL identificada, banco/Auth/Storage separados, três perfis e massa fictícia | 1 a 2 dias | Capacidade Supabase e Vercel |
| 2. Base do Dashboard e mapeamento | Competência correta, populações explicadas, origem e fechamento dos totais | 2 a 4 dias | Validação de população e competência piloto |
| 3. Folha por rubrica | Preparação, cálculo, conferência, aprovação, fechamento, memória e reabertura auditada | 8 a 12 dias | Regras assinadas pelo RH/contabilidade |
| 4. Importação e parcelas | Prévia, conciliação, prevenção de importação e desconto repetidos | 4 a 7 dias | Layout, identificação de colaboradores e regras de parcelas |
| 5. Férias e recessos | Programação, documento, usufruto e compensações separados, saldos e aprovações | 6 a 10 dias | Política de compensação validada |
| 6. Validação e liberação | Roteiros completos, ensaio de backup/restauração e publicação aprovada | 3 a 5 dias | Responsáveis pela aprovação e janela de publicação |

Faixa inicial: 24 a 40 dias úteis de esforço. Reestimar após conciliar a competência piloto e decidir as regras de recesso. A etapa 1 deve ser disponibilizada antes das demais.

## Mapeamento inicial da planilha de salários

Arquivo consultado em modo somente leitura: `01. Planilha de Salarios 2026.xlsx`. A versão fornecida contém abas mensais de janeiro a setembro de 2026 e uma aba de descontos em folha. A planilha original não será incorporada ao repositório nem à massa fictícia.

| Origem nas abas mensais | Significado proposto | Tratamento |
| --- | --- | --- |
| B, C, D | Colaborador, admissão, cargo | Identificar e conciliar com a matrícula/CPF do cadastro; não usar nome sozinho para gravar |
| E | Salário bruto | Salário-base ou proporcionalidade; confirmar significado quando houver fórmula com valores fixos |
| F | Assiduidade | Regra com vigência e exceção justificada |
| G, H, I | Diferença salarial, outros proventos, salário-família | Rubricas distintas com origem e aprovação |
| J | Alimentação/Flash | Benefício separado da remuneração e do líquido salarial |
| K | Salário + assiduidade | Na maior parte das linhas, soma E:I; conferir exceções |
| L, M | INSS e IR | Importar/validar com contabilidade inicialmente; não inferir tabela legal da planilha |
| N, O | Faltas com DSR + dia; horas | Conferência individual; classificação da ocorrência não autoriza desconto |
| P | Adiantamento salarial | Desconto com origem e competência |
| Q | VT | A planilha coloca VT entre descontos; confirmar separação do benefício concedido e da participação descontada |
| R | Outros descontos | Detalhar motivo, vínculo e parcela quando aplicável |
| S, T | Total descontos e líquido | A maioria usa soma L:R e K-S; conciliar cada exceção |
| U | Observações | Preservar justificativa, autor e origem; não executar instruções do texto automaticamente |

A aba de descontos tem colaborador, data, descrição, quantidade, valor unitário, total, número/valor de parcelas, vencimento, status e observações. O importador precisará distinguir contrato de desconto, parcela e cobrança por competência.

Diferenças encontradas para validar:

- O cabeçalho de assiduidade informa 10%, mas há fórmulas com 10,5% a partir de julho. É preciso confirmar vigência, população e exceções.
- Existem salários/benefícios calculados com constantes e divisores diferentes. Não assumir divisor 30, dias úteis ou proporcionalidade uniforme em todas as rubricas.
- A aba Abril ainda tem título interno de Março; Julho tem título interno de Junho. A prévia deve mostrar conflito de competência para confirmação, nunca decidir apenas pelo título interno.
- Alguns totais de rodapé somam múltiplas colunas. O importador deve reconhecer linhas de colaborador e excluir subtotais/rodapés da carga, conciliando as rubricas individualmente.
- Flash fica separado do total K. Não somá-lo ao líquido salarial por padrão.
- Dados ausentes, zero e valores digitados manualmente têm significados diferentes e devem permanecer distinguíveis.

Não há automatização tributária validada nesta análise. Não foram conferidas tabelas de INSS/IR ou obrigações oficiais, nem declarada correção legal das fórmulas existentes.

## Decisões necessárias do RH e da contabilidade

1. Definir uma competência piloto; sugestão inicial: setembro de 2026, última aba mensal da versão recebida.
2. Confirmar salário-base, proporcionalidade, dias/horas de referência e arredondamento por rubrica.
3. Confirmar assiduidade de 10%/10,5%, vigência, critérios e tratamento das exceções.
4. Definir o que integra bases tributárias, benefícios, custo da empresa e salário-família, com responsável pela validação.
5. Confirmar quando se aplicam faltas, DSR, horas e adiantamentos. Ocorrências gerarão sugestões para conferência.
6. Definir responsável por conferir, aprovar, fechar e reabrir; quais ações são exclusivas do Master e quais cabem ao RH.
7. Identificar parcelas já descontadas e como comprovar pagamento anterior à plataforma.
8. Validar política de recesso/compensação, unidade em dias ou horas, aprovação, documentos e eventual revisão jurídica.

## Desenho da folha operacional

Manter rubricas com código, grupo, base de cálculo, método permitido, vigência e versão. Remuneração, benefício, desconto, líquido e custo da empresa são totais diferentes, com composição exibida.

Fluxo por competência: preparação -> conferência -> aprovação -> fechamento. Cada colaborador tem itens com quantidade, base, taxa, valor, origem, regra aplicada e memória de cálculo. Ajuste manual exige justificativa e preserva o cálculo original. Não usar fórmulas arbitrárias com `eval`.

O banco deve impedir alteração de competência fechada em tabelas de itens, ajustes e aprovações, inclusive por acesso direto à API. Reabertura exige permissão, motivo e evento auditado, mantendo versões anteriores. Uma restrição apenas no botão da tela não é suficiente.

Importação: ler arquivo local -> selecionar competência -> mapear colunas -> prévia -> resolver erros/duplicados -> confirmar transação. Detectar duplicidade pelo arquivo e pelo conteúdo normalizado de colaborador/competência/rubrica/origem. Importar valores como números; não executar conteúdo de células ou notas como comandos.

Parcelas: contrato com identificador próprio, agenda de parcelas numeradas e vínculo único de cada parcela ao lançamento. Recalcular usa a mesma parcela; reabrir não gera nova parcela. Cancelamentos/estornos precisam preservar rastreabilidade. Operações concorrentes dependem de unicidade e transação no banco.

Demonstrativo individual deve mostrar proventos, benefícios, descontos, líquido, status e memória. Exportação de conferência inclui competência, matrícula, rubrica, origem, ajustes e divergências com a referência. A importação real deve ficar em área restrita a quem pode consultar salários; a massa de testes geral continua fictícia.

O sistema inicialmente calculará somas, proporcionalidades e rubricas cujas regras estiverem aprovadas, além de controlar parcelas e fechamento. INSS, IR, encargos, provisões e obrigações oficiais continuarão dependentes de importação/conferência contábil até existir regra específica validada com vigência. Pagamento bancário, eSocial, FGTS Digital e transmissão de obrigações não estão incluídos nessa primeira versão.

## Férias, recessos e saída efetiva

Separar período aquisitivo/concessivo, documento formal, programação, eventos efetivos de saída/retorno e compensações. Uma data documentada não comprova usufruto.

Cada período efetivo deve registrar início e fim, unidade, quantidade, autor e evidências. Alterar programação cria nova versão com justificativa; registrar retorno efetivo não substitui a programação anterior. Divergências entre documento e usufruto ficam pendentes de regularização.

Recesso possui saldo próprio. Vincular recesso a uma compensação exige regra aprovada, justificativa, aprovador, data e saldos antes/depois. Unicidade e bloqueio transacional impedem reutilizar o mesmo saldo ou deduzir o mesmo fato simultaneamente em dias e dinheiro. Sem regra validada, registrar a divergência e encaminhar para análise, sem abatimento automático de férias.

O prontuário mostrará as relações e o histórico; o Dashboard distinguirá solicitado, aprovado/programado e efetivamente em andamento; a folha receberá lançamentos pendentes de conferência, com vínculo à ausência original.

## Dashboard e rastreabilidade

Correção inicial: formatar competência como mês civil explícito em UTC e testar os limites de ano/fuso. O filtro e a legenda devem usar a mesma referência mensal. A visão geral deve exibir a competência efetivamente consultada.

Antes de ligar a folha operacional, conciliar quem compõe o quadro ativo e quem compõe o custo da competência. Exibir quantidade com remuneração, sem remuneração, admitidos/desligados no período e excluídos, além da justificativa. O custo deve apontar para a versão aprovada/fechada; estimativas devem ser identificadas como estimativas.

Mostrar fechamento parcial/total, quantidade conferida, horário da última atualização e link para o detalhamento que compõe o total. O total fechado precisa respeitar os mesmos filtros de colaborador/departamento da tela.

## Publicação e reversão

1. Validar primeiro em homologação usando scripts e versões de schema registrados.
2. Antes da janela de produção, registrar commit, deployment, migrations pendentes e responsáveis pela liberação.
3. Gerar backup do banco de produção e inventário/cópia privada dos arquivos de Storage. Não considerar backup do banco como cópia dos arquivos. Preservar configuração Auth e variáveis em armazenamento restrito.
4. Ensaiar restauração em projeto isolado e comparar contagens, permissões e acesso a arquivos. Registrar o resultado e a data. Não declarar backup ou restauração como executados antes do ensaio.
5. Publicar alterações de schema compatíveis com a versão anterior, verificar e preparar o build de produção sem trocar o domínio ainda.
6. Conferir o build preparado e promover somente depois da validação do responsável.
7. Para falha de aplicação, reverter o domínio ao deployment de produção anterior. Para falha de dados/schema, seguir o procedimento previamente ensaiado; não desfazer migrations destrutivas ou restaurar banco sobre dados novos sem avaliar perdas.

A homologação nunca deve ser promovida diretamente com suas variáveis de teste. Produção precisa de build próprio e das credenciais de produção. A massa fictícia e contas de teste nunca são migradas para produção.

## Critérios de liberação das próximas etapas

- Executar uma competência completa com colaboradores fictícios e comparar total por rubrica e colaborador.
- Conciliar a competência piloto da planilha na área restrita e explicar diferenças.
- Recalcular/reabrir duas vezes e confirmar que parcelas, sugestões e compensações não duplicam.
- Testar férias fracionadas, recesso, reprogramação e retorno com documento divergente.
- Verificar autorização no banco para Master, RH e acesso restrito, incluindo chamada direta à API.
- Confirmar bloqueio de escrita em folha fechada, aprovação e trilha de auditoria.
- Conferir competência, população e totais no Dashboard com diferentes filtros.
- Executar e registrar ensaio de restauração antes da liberação em produção.
