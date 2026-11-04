# Vínculo corporativo: piloto de homologação

No deploy de homologação, configure `CORPORATE_GATE_ENABLED=true`,
`NEXT_PUBLIC_CORPORATE_GATE_ENABLED=true` e
`PORTAL_CORPORATE_ACCESS_URL=https://concept21-portal-homologacao.vercel.app/api/internal/module-access`.
Não configure o sinalizador na produção.

O Portal verifica o token emitido pelo projeto Supabase do RH e consulta o
vínculo da identidade corporativa. A interface consulta o vínculo a cada cinco
segundos e encerra sua sessão quando o Portal responde que foi revogado. Falha
de comunicação bloqueia a tela. As rotas de solicitação de acesso e a decisão
de consentimento OAuth também consultam o vínculo antes de operações privilegiadas.

A migração `corporate_gate_homologation` acrescenta uma política restritiva às
tabelas `public` com RLS e a `storage.objects`. O Portal atualiza primeiro a
condição local para revogar e só depois marca o vínculo como revogado. Uma
restauração inverte essa ordem. Usuários sem linha no cadastro local conservam
as permissões atuais durante o piloto. Um rollback de DDL está em
`docs/corporate-gate-rollback.sql`.

Em 04/11/2026, a migração foi ensaiada em transação revertida no Supabase de
homologação. A identidade piloto revogada leu zero linhas de `profiles`, e
com a condição ativa recuperou a leitura. `corporate_gate_subjects` não ficou
criada ao final do ensaio.

**Pendente:** aplicar a migração, configurar o Portal e testar com sessão
existente, URL direta, consentimento OAuth, Storage e consulta direta ao Supabase.
Até concluir esses testes, não afirmar revogação completa.
