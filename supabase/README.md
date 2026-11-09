# Supabase - Módulo de RH

Este projeto usa Supabase diretamente: PostgreSQL, Auth, Storage, SQL nativo, RBAC no banco e RLS.

## Instalação em uma base nova

Esta sequência é para uma base vazia. Não reaplique as migrações iniciais em uma base já utilizada.

Ordem recomendada:

1. Aplique as migrations em `supabase/migrations` no Supabase SQL Editor ou via Supabase CLI.
2. Aplique os seeds em `supabase/seeds`, incluindo `004_seed_labor_costs.sql` para categorias, componentes e regras iniciais de custos.
3. Crie o primeiro usuário pelo Supabase Auth.
4. Crie um registro em `public.profiles` vinculado ao `auth.users.id`.
5. Vincule esse profile ao papel `master` em `public.user_roles`.

O bucket privado `hr-documents` é criado na migration `004_enable_hr_rls_and_storage.sql`. Na implementação atual, a abertura usa download autenticado com o JWT vigente, sem reutilizar uma resposta em cache. Não use URL pública.

## Base existente e histórico de migrações

O histórico nativo `supabase_migrations.schema_migrations` e o histórico do executor `app.codex_migration_history` são controles diferentes. A ausência de um registro não prova que o SQL nunca foi aplicado. Bancos preparados manualmente também podem ter objetos sem qualquer registro nesses históricos.

O executor interrompe a execução quando encontra tabelas em `public` ou `app` sem um histórico próprio conciliado, inclusive no `--dry-run`. Ele não cria a tabela de histórico nessa situação. O antigo `--baseline-existing` é rejeitado antes de consultar o banco: preencher todos os arquivos automaticamente poderia marcar uma migração pendente como concluída.

Antes de adotar o executor numa base existente:

1. Confirme o projeto linkado, o ambiente e o commit que será implantado. Registre o inventário fora do repositório público, sem copiar credenciais.
2. Liste os arquivos em ordem lexical e calcule o SHA-256 dos bytes de cada um. Leia os dois históricos, caso existam.
3. Compare cada migração com os objetos, funções, permissões e políticas efetivamente presentes. Timestamps ou nomes diferentes não autorizam reaplicar nem renomear registros automaticamente. SQL antigo pode ter sido corrigido por migrações posteriores; nesse caso, confira também o resultado acumulado.
4. Classifique os arquivos como aplicados e equivalentes, pendentes ou divergentes. Resolva todas as divergências e obtenha uma relação revisada antes de registrar uma linha de base. Não use a presença de uma tabela como prova de equivalência de uma migração inteira.
5. Só registre como `baseline` as versões conferidas, com nome e SHA-256 exatos. A conciliação é uma operação administrativa deliberada; este executor não a automatiza nem altera o histórico nativo do Supabase.
6. Execute o `dry-run` e confira o conjunto pendente antes de aplicar. Se uma migração ou o registro do histórico falhar, interrompa e confira o estado resultante antes de tentar novamente: executar SQL e gravar o histórico ainda são chamadas separadas.

Após a conciliação, qualquer arquivo já registrado que esteja ausente ou tenha nome/checksum diferente interrompe o executor antes de alterações. Uma migração existente não deve ser editada para acompanhar mudanças posteriores; use uma migração nova.

## Backup e ensaio de recuperação

Uma reversão de transação de teste não comprova restauração de backup. Antes de publicar, registre a origem, o horário em UTC e Brasília, o commit, o método de backup e um destino isolado para o ensaio.

O conjunto recuperável deve cobrir:

- esquema, dados, funções, permissões, políticas e histórico de migrações;
- usuários e vínculos de autenticação necessários ao funcionamento, conforme o método de backup escolhido;
- arquivos físicos do Storage, inventário de caminhos, tamanhos e hashes: metadados no PostgreSQL não substituem os bytes dos arquivos;
- configurações externas necessárias à recuperação, preservadas em local protegido, com referências às credenciais em vez de segredos no repositório.

Restaure em um destino isolado, com envio de e-mails e integrações externas desabilitados nesse destino. Não restaure sobre o banco oficial para realizar um ensaio. Confirme contagens e integridade dos dados, autenticação, permissões de Master e de usuário comum, leitura de um anexo com hash conferido, manutenção do módulo e continuidade do Portal. Registre as falhas e o tempo de recuperação. Se houver cobrança para criar o destino, defina o custo antes de provisionar.

Para recuar uma publicação do controle de manutenção, mantenha as tabelas aditivas e sua auditoria enquanto retorna à versão anterior da aplicação. Remover o histórico ou as tabelas não é necessário para esse recuo. Confirme o estado da manutenção e a compatibilidade da versão anterior antes de reabrir o RH. Se o problema exigir restauração de dados, use o procedimento de recuperação já ensaiado.
