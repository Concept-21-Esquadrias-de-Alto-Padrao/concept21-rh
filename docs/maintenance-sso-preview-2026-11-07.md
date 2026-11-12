# RH SSO + manutenção — Preview

Combina a revisão de login unificado da branch `codex/sso-rh-oidc` com o controle de manutenção do RH, exclusivamente para Preview na homologação. A base operacional usa o projeto Supabase de homologação; a manutenção permanece desligada.

Variáveis específicas do branch: `CORPORATE_GATE_ENABLED`, `NEXT_PUBLIC_CORPORATE_GATE_ENABLED`, `CORPORATE_GATE_PILOT_USER_ID`, `CORPORATE_GATE_PILOT_LINK_ID`, `PORTAL_CORPORATE_ACCESS_URL` e `PORTAL_GATE_SYNC_SECRET`. A chave de sincronização é exclusiva deste Preview e não está neste arquivo.

O deploy estável de homologação e a `main` oficial não recebem este código. Antes de qualquer promoção, conferir a migração no destino, sessões, OAuth, Storage e reversão.
