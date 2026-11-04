# Vínculo corporativo: piloto de homologação

No deploy de homologação, configure `CORPORATE_GATE_ENABLED=true`,
`NEXT_PUBLIC_CORPORATE_GATE_ENABLED=true` e
`PORTAL_CORPORATE_ACCESS_URL=https://concept21-portal-homologacao.vercel.app/api/internal/module-access`.
Configure `PORTAL_GATE_SYNC_SECRET` com valor aleatório exclusivo de pelo menos
32 caracteres, igual a `RH_MODULE_GATE_SYNC_SECRET` no servidor do Portal.
Configure `CORPORATE_GATE_PILOT_USER_ID=1648c90c-0b7a-46fc-acf4-32c73cd21c04`
e `CORPORATE_GATE_PILOT_LINK_ID=c674e98b-64fe-4b8c-bf02-2d5d56330605`.
Somente esse par pode ser alterado pela rota interna.
Não configure o sinalizador na produção.

O Portal verifica o token emitido pelo projeto Supabase do RH e consulta o
vínculo da identidade corporativa. A interface consulta o vínculo a cada cinco
segundos e encerra sua sessão quando o Portal responde que foi revogado. Falha
de comunicação bloqueia a tela. As rotas de solicitação de acesso e a decisão
de consentimento OAuth também consultam o vínculo antes de operações privilegiadas.

A migração `corporate_gate_homologation` acrescenta uma política restritiva às
tabelas `public` com RLS e a `storage.objects`. A rota interna do módulo mantém
a chave de serviço do Supabase no próprio módulo. O Portal atualiza primeiro a
condição local para revogar e só depois marca o vínculo como revogado. Uma
restauração inverte essa ordem. Usuários sem linha no cadastro local conservam
as permissões atuais durante o piloto. Um rollback de DDL está em
`docs/corporate-gate-rollback.sql`.

Em 04/11/2026, a migração foi ensaiada em transação revertida no Supabase de
homologação. A identidade piloto revogada leu zero linhas de `profiles`, e
com a condição ativa recuperou a leitura. O ensaio foi revertido. Depois, a
migração foi aplicada na homologação como versão `20261104125217`: 52 políticas
foram criadas e o cadastro de bloqueio permaneceu vazio.
O guarda da função privilegiada `request_access_review` foi aplicado como
versão `20261104130751`. Em transação revertida, uma identidade revogada
recebeu erro 42501 ao chamar a função. Nenhuma linha piloto permaneceu gravada.

**Pendente:** configurar os aplicativos e testar com sessão
existente, URL direta, consentimento OAuth, Storage e consulta direta ao Supabase.
Até concluir esses testes, não afirmar revogação completa.
