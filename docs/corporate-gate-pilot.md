# Vínculo corporativo: piloto de homologação

No deploy de homologação, configure `CORPORATE_GATE_ENABLED=true`,
`NEXT_PUBLIC_CORPORATE_GATE_ENABLED=true` e
`PORTAL_CORPORATE_ACCESS_URL=https://concept21-portal-homologacao.vercel.app/api/internal/module-access`.
Não configure o sinalizador na produção.

O Portal verifica o token emitido pelo projeto Supabase do RH e consulta o
vínculo da identidade corporativa. A interface consulta o vínculo a cada cinco
segundos e encerra sua sessão quando o Portal responde que foi revogado. Falha
de comunicação bloqueia a tela.

**Limite atual:** o RH usa consultas diretas do navegador ao Supabase e possui
rotas de API que ainda não consultam esse vínculo. Um JWT ainda válido pode
acessar essas operações até que regras restritivas de RLS e as rotas de API
reflitam a revogação. Este piloto não cumpre o requisito de revogação completa
antes dessa etapa e do teste com sessão existente, URL direta e consulta direta
ao Supabase.
