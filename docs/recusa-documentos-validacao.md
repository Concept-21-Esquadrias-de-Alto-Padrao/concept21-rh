# Recusa de documentos: correção local

## Diagnóstico

O botão Recusar dependia de window.prompt. Cancelamento, retorno vazio ou supressão da janela encerravam o fluxo sem mensagem. Isso é compatível com a ausência de mudança observada no navegador de testes, mas não comprova uma falha de permissão no banco.

## Alteração

- Formulário dentro da aplicação, identificando colaborador e tipo de documento.
- Motivo obrigatório, incluindo bloqueio de texto composto apenas por espaços.
- Cancelamento sem chamada ao serviço e confirmação explícita.
- Durante o envio, confirmação e fechamento ficam bloqueados.
- Erros de permissão, rede ou validação mantêm o formulário e o texto para nova tentativa.
- O serviço valida o motivo antes de obter o cliente Supabase e remove espaços externos.
- Preservados os controles de acesso existentes e o evento document.rejected. Não houve SQL ou alteração de permissões.

## Verificação e limites

26 testes automatizados na suíte, incluindo motivo vazio/espaços, acentos e múltiplas linhas. Cenários adicionais de PDF incluem 1.200 seleções de filtro atravessando nove páginas, nomes extensos com acentos e texto sem espaços. Conferência visual e de coordenadas dos PDFs fictícios: sem texto fora dos limites úteis.

A interação completa de confirmar/cancelar/erro e a persistência da recusa ainda precisam de validação autenticada após liberação dos acessos. O teste unitário do motivo não substitui teste de interface ou RLS. Nenhum dado remoto foi alterado nesta rodada.

## Validação publicada em 27/10/2026

A correção original `3667c0a` foi revisada e incorporada pelo merge `c88f153`, preservando seu histórico. A aplicação foi publicada somente em https://concept21-rh-homologacao.vercel.app, no deployment `dpl_GQxrVXukWsg8zLykm15gH82zTugQ`. A publicação conjunta e o procedimento de reversão estão registrados em `docs/pdf-mensal-validacao.md`.

Os cenários abaixo passaram tanto no build temporário quanto no domínio publicado, usando conta RH fictícia e documento descartável de HOM-001:

- Motivo vazio ou composto por espaços mantém a confirmação desabilitada, sem gravação.
- Cancelar preserva o status e não gera evento de recusa.
- Uma falha de rede simulada no envio mantém formulário, motivo e status para nova tentativa.
- Confirmar após a falha grava `rejected`, motivo sem espaços externos e o usuário responsável. O status permanece Recusado após recarregar.
- O evento `document.rejected` foi conferido diretamente na auditoria, com ator e novo status corretos. Eventos: `03375cc7-96dd-418c-8074-7294845202e3` no build temporário e `53318993-7b9c-4d08-85bb-f4440b690691` no domínio fixo.
- O perfil restrito não conseguiu alterar esse documento de outro colaborador pela API; o status permaneceu inalterado. Não foi usada chave administrativa na tentativa negada.
- O formulário foi conferido em viewport de celular de 390 por 844 pixels, sem corte horizontal; cancelar não gravou nada.

Os documentos e ocorrências criados exclusivamente para estes testes foram removidos por UUID e marcador próprios. A auditoria permaneceu como evidência. Não foram alterados usuários, perfis, políticas, migrations ou arquivos do Storage. Esta validação cobre o fluxo de recusa e uma tentativa negada pela RLS, não toda a matriz administrativa de permissões.
