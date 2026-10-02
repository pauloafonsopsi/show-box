# Bloco 2: todas as vendas

Entrega de uma vez, conforme a seção 11 do AGENTS.md anexado: Bilheteria da recepção,
página da família, compra pública, Pagar.me (PIX e cartão) com webhook, meia-entrada de
novembro, desistência e estorno, impressão e retirada de ingressos físicos.

## Fase 1: Banco
- Nova migration `vendas.sql` exatamente como o anexo: motor de reservas, preços e
  finalização, recepção, cortesias, troca de lugar, retirada, desistência, expiração,
  Realtime de assentos e agendamentos (`expirar_reservas` a cada minuto, `apagar_contatos` diário).
- Nenhuma tabela, coluna ou política além do anexo.

## Fase 2: Especificação e chaves
- Substituir o AGENTS.md da raiz pelo anexo, mantendo o bloco LOVABLE do topo.
- Secrets: `PAGARME_SECRET_KEY` e `PAGARME_PUBLIC_KEY` já salvas (chave oficial);
  `PAGARME_WEBHOOK_SEGREDO` gerado e salvo. Nenhuma chave no chat ou no código.
- Pasta pública de fotos `produtos` (2 MB, só WebP): tentar criar; se continuar
  bloqueada pela plataforma, seguir sem ela e anotar no fechamento.

## Fase 3: Servidor (Pagar.me e webhook)
- Server functions para as funções "equipe" do banco (login da atendente) e server-only
  helpers com a chave de serviço para as funções "servidor".
- Integração Pagar.me API v5: criar pedido (`POST /orders`), reconsultar
  (`GET /orders/{id}`), estorno (`DELETE /charges/{id}`); PIX com `expires_in` do tempo
  de reserva; cartão tokenizado direto no navegador com a chave pública (o número do
  cartão nunca passa pelo nosso servidor); endereço completo pelo ViaCEP.
- Webhook: `POST /api/pagarme/webhook/$segredo` (segredo do caminho comparado em tempo
  constante), evento registrado, pedido reconsultado antes de nascer ingresso,
  idempotente, pagamentos duplicados anotados.
- Consulta de PIX a cada 5 s por server function; troca de PIX para cartão cancela a
  cobrança pendente anterior.
- Páginas `/f`, `/e` e `/p` com noindex e `Referrer-Policy: no-referrer`; códigos só no
  caminho da URL.

## Fase 4: Bilheteria (Coxia, notebook)
- `/bilheteria`: busca grande focada (atalho `/`) por bailarina ou responsável, sem
  acento; saldo por sessão; "Venda avulsa" e "Retirada de ingressos"; seletor de evento.
- `/bilheteria/familia/$familiaId`: mapa em tempo real, reserva tudo ou nada (perdidos
  saem sozinhos e piscam), adicionais, tipos em novembro, pagamento com troco, cortesia.
- `/bilheteria/avulsa`: mesmo fluxo sem família.
- `/bilheteria/pedidos`: busca, filtros, trocar lugar e cancelar.
- `/bilheteria/caixa`: caixa do dia e fechar caixa com diferença por forma.
- `/bilheteria/retirada`: ler QR pela câmera ou digitar código; marcar entregues;
  imprimir ingressos da família.

## Fase 5: Página da família (Palco, celular primeiro)
- `/f/$codigo`: cortina na primeira visita, um bloco por sessão com quem dança, carteira
  de ingressos com QR, adicionais, detalhes da compra, retirada, ajuda e termos.
- `/f/$codigo/$sessaoId`: mapa em tempo real com Realtime + consulta de segurança,
  seleção até o saldo, barra fixa.
- `/f/$codigo/pagamento/$acesso`: contagem regressiva, meias de novembro com
  declaração, dados do pagador, PIX (QR, copia e cola, atualização sozinha) ou cartão,
  aceite dos termos; retomada ao voltar do banco; reserva expirada com "Escolher de novo".
- `/f/$codigo/pedido/$acesso`: confirmação, ingressos com QR, desistência dentro do prazo.

## Fase 6: Compra pública (Palco)
- `/e/$slug` (sessões e preços, só na janela pública), `/e/$slug/$sessaoId` e
  `/p/$acesso` (link do pedido copiável e envio pelo WhatsApp).

## Fase 7: Admin, acréscimos
- Aba `pedidos`: filtros na URL, pendências no topo (desistências a aprovar e estornar,
  pagos sem lugar, duplicados).
- Impressão: rota de impressão com folhas A4 de 4 ingressos para recortar, estilo
  `@media print`; lista de quem ainda não retirou.
- Aba `adicionais`: relatório de entrega por sessão, imprimir e exportar planilha.
- Visão geral: vendas por canal, setor e dia; meias vendidas; ocupação ao vivo.

## Fase 8: Testes no navegador
- Fluxos da seção 6 do prompt em 360 px e 1280 px, com a sessão do Paulo na prévia.
- Chave oficial (produção): as cobranças serão reais. PIX e cartão testados com valor
  mínimo e estornados pelo próprio fluxo novo de desistência. Sem modo de teste, este é
  o caminho seguro: nada de dado real de pagador além do teste.

## Detalhes técnicos
- QR gerado com `qrcode` (SVG no navegador); leitura com câmera + campo para digitar.
- Realtime de `assentos` com canal por sessão, ouvir `*` e filtrar no callback.
- Textos das telas da família e do público vêm da tabela `conteudos`.
- Pagamento, estorno, fórmulas e papéis: nunca editáveis pelo painel.

## Riscos
- Chave de produção: qualquer teste com PIX/cartão move dinheiro real; estorno pelo
  próprio fluxo compensa, mas a taxa de estorno pode não voltar.
- A URL do webhook (`/api/pagarme/webhook/...`) precisará ser cadastrada na Pagar.me
  junto com o domínio da tokenização; entrego as URLs no fechamento.
- Se o pg_cron não puder ser criado, expiração depende de chamadas do app (o banco
  também trata reserva vencida como livre na hora da compra).
