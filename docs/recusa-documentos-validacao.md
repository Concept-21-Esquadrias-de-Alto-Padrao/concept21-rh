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
