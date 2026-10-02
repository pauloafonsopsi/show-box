
# Bilheteria de espetáculos: especificação

Este arquivo é a especificação completa do sistema. Ele vale sobre qualquer suposição.
Foi escrito pelo Claude, que cuida da arquitetura. Paulo é o dono e o único admin.
Se algo aqui parecer errado ou impossível, pare e explique antes de mudar.

## 1. O que é

Plataforma de venda de ingressos com lugar marcado para os espetáculos do Ballet Letícia Lobo.
Cada evento tem sessões, um mapa de lugares, preços por período, janelas de venda, elenco
(bailarinas) agrupado em famílias, adicionais (buquês, jóias, ensaio fotográfico) e textos próprios.
Primeiro evento: O Quebra-Nozes 2026, sessões de 28 e 29/11, Casa da Cultura de Santarém.

Venda em dois canais sobre o mesmo banco:
- Recepção (Bilheteria): a atendente vende com a maquininha; o sistema só registra.
- Online: a família entra por um link individual, sem login, e paga com Pagar.me.

Construção em blocos. **Implemente só o bloco pedido no prompt.**
- Bloco 1 (feito): fundação, admin, eventos, mapas, preços, elenco, links, adicionais, conteúdos, equipe.
- Bloco 2: todas as vendas. Bilheteria da recepção, página da família, compra online e pública, Pagar.me (PIX e cartão), webhook, novembro com meia-entrada, desistência e estorno, impressão e retirada de ingressos físicos. Especificação na seção 11.
- Bloco 4 (dezembro): temas por evento, duplicar evento.

## 2. Arquivos do Claude (aplicar exatamente, nunca reescrever)

| Arquivo | O que é |
| --- | --- |
| `supabase/migrations/...bilheteria_fundacao.sql` | Tabelas, RLS e funções do banco |
| `supabase/migrations/...carga_quebra_nozes_2026.sql` | Carga inicial: Casa da Cultura, mapa de 282 lugares, o evento, preços, janelas, adicionais, textos e termos |
| `src/styles.css` | Design system em tokens (modos Coxia e Palco) |
| `src/design/grade.ts` | Lógica pura do mapa em grade (validação, contagem, numeração, CSV) |
| `src/design/palco.tsx` | Componentes: `Proscenio`, `Cortina`, `Poltrona`, `GradeDePoltronas`, `SeloStatus` |
| `src/design/editor-de-grade.tsx` | Editor de mapa em grade (`EditorDeGrade`) |
| `supabase/migrations/...ajustes_fundacao_1.sql` | `definir_escalacao` e correções de search_path |
| `supabase/migrations/...vendas.sql` | Motor de vendas (Bloco 2): reserva, preço, finalização, recepção, família, público, Pagar.me, desistência, expiração |

Se um desses arquivos não compilar ou não encaixar, pare e descreva o problema. Não corrija por conta própria.

## 3. Ambiente

- TanStack Start (rotas em `src/routes`, ver `src/routes/README.md`), React 19, Tailwind v4, shadcn/ui, TanStack Query, Zod.
- Lovable Cloud (Supabase): Postgres, Auth, Storage, Realtime.
- Este tipo de projeto não aceita edge functions. Lógica de servidor fica em server functions (`createServerFn`, arquivos `*.functions.ts`) e server routes do TanStack Start. A chave de serviço só é usada dentro do handler, importada de `@/integrations/supabase/client.server` (como em `src/lib/equipe.functions.ts`).
- Rotas da equipe (`/entrar`, `/admin/**`, `/bilheteria/**`) rodam só no cliente (`ssr: false`), porque a sessão do Cloud vive no navegador.
- Idioma pt-BR em toda interface. Código e nomes de variáveis podem ser em inglês ou português, mas todo texto visível é em português.
- Fuso: America/Belem (UTC-3). Datas no formato 28/11/2026 e horas 10h ou 10h30.
- Dinheiro sempre em centavos (inteiro) no banco. Exibir como R$ 240,00 com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- WhatsApp no banco: `55` + DDD + 9 dígitos (ex.: `5593992277222`). Exibir como (93) 99227-7222.

## 4. Papéis e acesso

- Papéis em `user_roles` (`admin`, `bilheteria`, `porta`). Checagem no banco com `has_role`, `is_admin()`, `is_equipe()`.
- Toda permissão vale no servidor (RLS e funções). Esconder botão é cortesia.
- Família e público nunca autenticam. Leituras públicas diretas: o status dos lugares (`assentos`, colunas sem dado pessoal, também pelo Realtime) e as funções `mapa_da_sessao` e `meias_disponiveis`. Todo o resto público passa por server function com a chave de serviço, validando o código do link da família ou o código de acesso do pedido.
- O código do link da família fica em `familia_links`, que só o admin lê. A atendente nunca vê o código.
- Primeiro acesso: Paulo cria a conta em `/entrar` e, se `existe_admin()` for falso, aparece o botão "Ativar conta de administrador", que chama `reivindicar_admin()`. Depois disso o botão nunca mais aparece.
- Equipe entra por convite (edge function `equipe`, seção 7). É impossível remover o último admin (o banco recusa).
- Segredos (chaves da Pagar.me, token do webhook) só em Secrets do Cloud. O repositório é público durante a construção.
- Nunca grave dados de bailarinas, famílias ou planilhas em arquivos do repositório.

## 5. Banco: como usar

As tabelas estão na migration da fundação. Leia as tabelas com o cliente do Cloud (a RLS protege).
**Quando existir uma função para a operação, use a função. Nunca escreva direto na tabela nesses casos.**

| Função (RPC) | Quem chama | O que faz |
| --- | --- | --- |
| `existe_admin()` | tela de entrar | Diz se já existe administrador |
| `reivindicar_admin()` | tela de entrar | Torna o usuário atual admin, só se não houver nenhum |
| `salvar_mapa(p_mapa, p_colunas, p_filas, p_celulas)` | editor de mapa | Grava o desenho; recusa número repetido e assento sem setor. Use `paraSalvarMapa(grade)` de `src/design/grade.ts` |
| `congelar_mapa_da_sessao(p_sessao)` | aba Sessões | Copia o mapa para os lugares da sessão. Recusa se a sessão já tem vendas |
| `bloquear_lugares(p_sessao, p_numeros, p_bloquear, p_motivo)` | aba Sessões | Bloqueia (com motivo) ou libera lugares livres |
| `importar_planilha(p_evento, p_linhas, p_gravar, p_arquivo)` | aba Elenco | Com `p_gravar = false` devolve a prévia; com `true` grava. Recusa gravar se houver vermelho |
| `gerar_link_familia(p_familia)` | Elenco e Envio | Gera ou troca o código do link. O antigo para de funcionar |
| `gerar_links_do_evento(p_evento)` | Envio | Gera o link de todas as famílias que ainda não têm |
| `marcar_link_enviado(p_familia, p_enviado)` | Envio | Marca ou desmarca o envio |
| `saldo_familia(p_familia, p_sessao)` e `saldos_do_evento(p_evento)` | painel e Bilheteria | Saldo por família e sessão. `null` = evento sem cota |
| `estoque_disponivel(p_estoque)` | Adicionais | Soma dos lotes abertos menos o vendido |
| `abrir_proximo_lote(p_estoque)` | Adicionais | Abre o próximo lote fechado |
| `vagas_disponiveis(p_produto_data)` | Adicionais | Vagas livres de um dia de ensaio |

Regras de negócio que ficam só no banco (nunca reimplementar no navegador como autoridade):
- Saldo da família por sessão = cota do evento x filhas escaladas na sessão menos ingressos ativos da família na sessão. Nunca negativo.
- Mapa da sessão é uma cópia congelada do mapa do local. Lugar vendido nunca muda.
- Termos e política de privacidade são versionados: só se insere nova versão (`termos_versoes`), nunca se edita a publicada. O banco calcula versão e hash.
- Toda mudança nas tabelas operacionais vai para `auditoria` sozinha (gatilhos).

Se achar que precisa de tabela, coluna ou política nova, **pare e explique**. Mudança no banco passa pelo Claude.

## 6. Design system

Conceito: o **proscênio**, o arco dourado que emoldura o palco. Todo o resto fica quieto.
A única coreografia é a cortina de veludo que abre na primeira visita da família.

- Use só os tokens de `src/styles.css` e os componentes de `src/design` e `src/components/ui`.
- Nunca use cor, fonte, raio ou sombra que não esteja nos tokens.
- **Coxia** (padrão, sem classe): equipe e admin. Claro, alto contraste, sem animação. Botão principal na cor `primary` (Tinta).
- **Palco** (classe `palco` no contêiner da página): família e público. Escuro, botão principal dourado.
- Fontes: `font-sans` (IBM Plex Sans) em toda interface; `titulo-palco` (Cormorant Garamond) só em títulos do Palco e nos nomes das bailarinas. Números de dinheiro, saldo e tabela com a classe `numeros`.
- Escala de texto: corpo 16 px, tabela densa 14 px, nunca abaixo de 13 px. Campos sempre com 16 px.
- Alvos de toque com pelo menos 44 px (`min-h-11`).
- Estados sempre com cor, ícone e texto juntos: use `SeloStatus`.
- Poltrona e mapa: use `Poltrona` e `GradeDePoltronas`. Mapa de admin: `EditorDeGrade`.
- Setores aparecem como uma marca fina na base da poltrona livre e na legenda. A cor da poltrona mostra o estado, nunca o setor.

O que abre onde:

| Situação | Contêiner |
| --- | --- |
| Tela principal, aba de evento, editor | Página com URL própria |
| Ver ou editar um item sem perder a lista | Painel lateral (`Sheet`); no celular, tela cheia |
| Decisão curta ou formulário de até 5 campos | Janela (`Dialog`). Nunca janela sobre janela |
| Confirmação de ação destrutiva | `AlertDialog` dizendo o que será perdido |
| Ação concluída | Aviso temporário (`sonner`), com Desfazer quando possível |
| Situação que persiste (prévia com erros, link não enviado) | Faixa de aviso na própria tela |

Proibido (só entra se o Paulo pedir): visual padrão do shadcn sem os tokens; conteúdo picado em cartões idênticos;
gradiente decorativo; vidro fosco; rótulo em caixa alta espaçada acima de título; numeração 01, 02, 03 em conteúdo
que não é sequência; palavra do título em outra cor; metadados separados por ponto central; travessão em qualquer
texto; seta em texto de botão; emoji como ícone; ícone em círculo colorido em cima de cartão; animação de entrada
em seção; efeito em todo cartão ao passar o mouse.

## 7. Telas do Bloco 1

Toda tela tem título claro, ação principal evidente, voltar no mesmo lugar, e os quatro estados:
vazio (com convite para a primeira ação), carregando (esqueleto no formato do conteúdo), erro (com saída) e cheio.
Filtros, busca, aba e página ficam na URL. Listas com mais de 10 itens têm busca. Listas longas são paginadas.
No celular, tabelas viram cartões com 3 informações.

### `/entrar`
Entrar com e-mail e senha. Recuperar senha. Depois de entrar:
- admin vai para `/admin`;
- bilheteria vai para `/bilheteria` (no Bloco 1, só uma página dizendo que a Bilheteria chega no próximo bloco);
- sem papel e sem admin no sistema: botão "Ativar conta de administrador" (`reivindicar_admin`);
- sem papel e com admin no sistema: "Sua conta ainda não tem acesso. Fale com o administrador."

### Estrutura do admin (`/admin`)
Menu lateral recolhível: Painel, Eventos, Locais e mapas, Equipe, Configurações, Auditoria. Trilha de navegação nas telas internas.
Toda rota de admin confere o papel no carregamento e manda para `/entrar` quem não é admin.

### `/admin` (Painel)
Para cada evento: nome, status, e por sessão: lugares livres, bloqueados e vendidos; famílias, bailarinas e links enviados (x de y).

### `/admin/eventos` e `/admin/eventos/$eventoId/...`
Lista de eventos com status. "Novo evento" pede nome; o slug é gerado e editável.
Dentro do evento, abas como rotas filhas:

1. **`visao-geral`**: nome, slug, status (rascunho, em venda, encerrado), cota por participante (interruptor ligada ou desligada e o número), limite por pedido, tempo de reserva em minutos, parcelamento (mínimo de ingressos e parcelas máximas), percentual e categorias da meia-entrada.
2. **`sessoes`**: lista com nome, data e hora, abertura das portas, mapa usado e data do congelamento. Editar em painel lateral. Botão "Congelar mapa" (`congelar_mapa_da_sessao`) com confirmação que explica que o mapa da sessão será substituído pelo do local. Seção "Bloqueios": desenha o mapa da sessão com `GradeDePoltronas`; a pessoa seleciona lugares e bloqueia com motivo ou libera (`bloquear_lugares`). Legenda com contagem por setor e por estado.
3. **`precos`** (Preços e calendário): períodos de preço (nome, início, fim, modo único ou inteira e meia, rótulo do valor único) e, em cada período, o preço por setor e tipo. Janelas (tipo, início, fim, observação) numa tabela simples. Mostrar os tipos com nomes de gente: "Quebra-Nozes", "Recepção", "Link das famílias", "Público", "Retirada de ingressos".
4. **`elenco`** (Elenco e famílias):
   - Importar planilha: aceita `.xlsx` e `.csv`; leitura no navegador com a biblioteca `read-excel-file` (xlsx) ou parser de CSV. No xlsx, ler a aba chamada "Bailarinas"; se não existir, a primeira aba que tiver o cabeçalho "Nome completo da bailarina" (procurar a linha de cabeçalho nas 10 primeiras linhas). Colunas esperadas pelo nome do cabeçalho (sem acento e sem diferença de maiúsculas): "Nome completo da bailarina", "Turma", "Pacote", "Responsável (primeiro nome)", "WhatsApp do responsável", e uma coluna "Dança ..." por sessão. A tela mostra cada coluna "Dança ..." e pede para escolher a sessão correspondente (pré-selecionar pela data no texto, ex.: "28/11"). Valor "S" marca a sessão. Ignorar outras colunas.
   - Primeiro chama `importar_planilha(..., p_gravar = false)` e mostra a prévia: totais (bailarinas, famílias, Quebra-Nozes, por sessão), lista vermelha (bloqueia) e amarela (conferir), cada item com a linha da planilha. Botão "Gravar" só habilitado sem vermelho; chama com `p_gravar = true`.
   - Lista de famílias com busca por nome de bailarina ou responsável, filtros por sessão, pacote e link enviado. Cada família mostra as bailarinas, os dias, o pacote e o saldo por sessão (`saldos_do_evento`). Editar bailarina e família em painel lateral (nome, turma, pacote, dias, ativa; responsável e WhatsApp). "Gerar novo link" com confirmação: o link antigo para de funcionar.
5. **`envio`** (Envio de links): "Gerar links que faltam" (`gerar_links_do_evento`). Uma linha por família: responsável, bailarinas, WhatsApp, status (enviado em tal data ou não enviado). Ações: "Abrir no WhatsApp" e "Marcar como enviado" (ou desmarcar). Filtro "Não enviados". A mensagem vem do conteúdo `mensagem_link` do evento, com as variáveis `{{responsavel}}`, `{{bailarinas}}` (primeiros nomes: "Maria", "Maria e Clara", "Maria, Clara e Júlia") e `{{link}}` (`https://<domínio>/f/<código>`). O botão abre `https://wa.me/<whatsapp>?text=<mensagem codificada>` em nova aba. Pré-visualização da mensagem antes de abrir.
6. **`adicionais`**: produtos (nome, descrição, foto, preço antecipado, preço cheio, venda online até, entrega na sessão ou agendada, ativo, ordem). Foto: upload para o bucket público `produtos` do Storage, convertida no navegador para WebP com no máximo 1200 px de largura, com texto alternativo. Estoques e lotes: quantidade de cada lote, aberto ou fechado, disponível agora (`estoque_disponivel`), botão "Abrir próximo lote" (`abrir_proximo_lote`). Vínculo produto e estoque (quantos itens do estoque cada produto consome). Dias de ensaio (`produto_datas`): data (pode ficar vazia), vagas, reservas internas e vagas livres (`vagas_disponiveis`). Produto só pode ser ativado com os dois preços preenchidos (o banco recusa).
7. **`conteudos`**: lista dos textos do evento pelo rótulo. Editar em painel lateral com a lista de variáveis do texto e a pré-visualização preenchida com um exemplo. Termos do evento: versão atual (número, data, início do hash) e "Publicar nova versão" (texto inteiro; insere em `termos_versoes`).

### `/admin/locais` e `/admin/locais/$localId/mapas/$mapaId`
Locais (nome, endereço, ativo) e, em cada local, os mapas (nome, status rascunho ou pronto).
Tela do mapa, feita para computador: setores do mapa (nome, cor com seletor, ordem) num painel e o `EditorDeGrade` ocupando o resto.
- Carregar `mapa_celulas` e converter com `deMapaCelulas`.
- `onSalvar` chama `salvar_mapa` com `paraSalvarMapa(grade)` e mostra o retorno (total e por setor).
- Interruptor "Mapa pronto para usar em sessões" (status). Passar o número de sessões que usam o mapa em `emUsoEmSessoes`.
- No celular, mostrar o mapa só para visualização com `GradeDePoltronas` e a frase "Edite o mapa num computador".

### `/admin/equipe`
Lista das pessoas da equipe (e-mail, papéis, último acesso). "Convidar pessoa" (e-mail e papel). Trocar papel. Remover acesso.
Precisa da edge function `equipe` (service role só dentro da função), que confere se quem chama é admin
(`has_role` com o usuário do token) e então: lista usuários com papéis, convida por e-mail com o papel escolhido,
troca papel e remove papel. O banco já impede remover o último admin; mostre a mensagem dele.

### `/admin/configuracoes`
Edita a tabela `configuracoes` com o campo certo para cada tipo (texto, número, moeda, sim ou não, data, hora), rótulo e explicação.
Mostra quem mudou e quando (de `auditoria`). Política de privacidade: versão atual e "Publicar nova versão".

### `/admin/auditoria`
Lista paginada: quando, quem (e-mail), ação (criou, alterou, apagou), tabela com nome de gente e o que mudou (antes e depois, só os campos diferentes).
Filtros por tabela e período na URL.

## 8. Textos

Todo texto que existe na tabela `conteudos` é lido de lá, nunca escrito no código. Variáveis entre `{{ }}`.
Linguagem do usuário: "Salvar mapa", "Gravar planilha", "Abrir no WhatsApp". Nunca "Enviar", "Submit", "registro", "entidade", "status: pending".
Mensagem de erro diz o que aconteceu e o que fazer. Erros do banco já chegam em português: mostre o texto deles.

## 9. Carregamento e memória

- Rotas carregadas sob demanda. O editor de grade só carrega na tela do mapa.
- TanStack Query com cache; voltar a uma tela visitada é instantâneo.
- Buscar só as colunas usadas. Contagens vêm do banco (funções e `count`).
- Botão de envio mostra "Salvando..." e fica bloqueado até a resposta. Clique duplo nunca duplica.
- Formulário com mais de 5 campos guarda rascunho no navegador até salvar.
- Se a conexão cair no meio de uma ação, a tela diz se salvou ou não e oferece tentar de novo.

## 10. Fechamento obrigatório de toda tarefa

Ao terminar, responda:
1. "Editável no painel em: [caminho]" ou "Ficou no código porque: [motivo]", para cada coisa criada.
2. O que não fez e por quê.
3. Riscos que percebeu.
Não implemente nada além do bloco pedido. Necessidade extra vai numa lista no final.


## 11. Vendas (Bloco 2)

A regra de negócio inteira está no banco (`vendas.sql`). O app só chama as funções e mostra o resultado.
Toda mensagem de erro dessas funções já está em português e é mostrada como veio.

### 11.1 Funções do banco

Equipe (cliente do Cloud com o login da atendente ou do admin):

| Função | Uso |
| --- | --- |
| `reservar_presencial(p_sessao, p_numeros, p_familia, p_pedido)` | Reserva tudo ou nada. Resposta `ok: false` traz `perdidos` (números tomados). `p_pedido` acrescenta lugares a um pedido aberto |
| `previa_pedido(p_pedido, p_ingressos, p_adicionais)` | Calcula tipos, adicionais e total sem fechar |
| `registrar_venda_presencial(p_pedido, p_ingressos, p_adicionais, p_forma, p_parcelas, p_valor_recebido_centavos)` | Fecha e finaliza a venda da recepção. `p_forma`: credito, debito, pix, dinheiro. Devolve total, ingressos e troco |
| `liberar_reserva(p_pedido)` | Desiste da reserva aberta |
| `cancelar_venda(p_pedido, p_motivo)` | Cancela venda da recepção ou cortesia |
| `trocar_lugar(p_ingresso, p_novo_numero, p_motivo)` | Troca por lugar livre da mesma sessão; devolve a diferença de preço |
| `emitir_cortesia(p_sessao, p_numeros, p_motivo, p_familia)` | Ingresso de R$ 0, fora da cota |
| `buscar_para_retirada(p_codigo)` | Aceita o código do link da família, o código de acesso do pedido ou o QR de um ingresso |
| `marcar_entregues(p_ingressos, p_entregue)` | Marca a retirada dos ingressos físicos |
| `caixa_do_dia(p_evento, p_data, p_atendente)` | Totais da recepção por forma de pagamento |
| `aprovar_desistencia(p_pedido)` | Só admin. Devolve o `pagarme_charge_id` para o estorno |
| `saldo_familia`, `saldos_do_evento` | Saldo por família e sessão (seção 5) |

Leitura pública: `mapa_da_sessao(p_sessao)` devolve dimensões, palco, corredor, setores com preço vigente,
lugares com estado (livre, reservado, ocupado, bloqueado) e meias disponíveis. `meias_disponiveis(p_sessao)`.

Servidor (só server functions e server routes, com a chave de serviço):

| Função | Uso |
| --- | --- |
| `familia_painel(p_token)` | Tudo da página da família: evento, primeiros nomes das filhas, sessões com saldo, janelas, ingressos com QR, pedidos, adicionais à venda, conteúdos, contatos e termos vigentes. `null` = link inválido |
| `reservar_online(p_sessao, p_numeros, p_token_familia, p_acesso_pedido)` | Com token: link da família (janela e saldo; depois da abertura pública, regras do público). Sem token: compra pública. Com `p_acesso_pedido`, a nova escolha substitui a anterior daquela sessão |
| `fechar_pedido_online(p_acesso, p_ingressos, p_adicionais, p_pagador, p_forma, p_parcelas, p_termos_versao, p_ip)` | Compõe e grava pagador e aceite. `p_forma`: pix ou cartao. Devolve total, `segundos_restantes` e `itens_pagarme` prontos |
| `registrar_pagarme(p_acesso, p_order_id, p_charge_id)` | Guarda o pedido criado na Pagar.me (o histórico fica salvo) |
| `finalizar_pedido_pago(p_pagarme_order_id)` | Só depois de reconsultar a Pagar.me e ver `paid`. Idempotente. Pode devolver `pago_sem_lugar` |
| `marcar_pagamento_falhou(p_pagarme_order_id)` | Cartão recusado ou PIX vencido: o pedido aceita nova tentativa enquanto a reserva valer |
| `registrar_evento_pagamento(p_evento_id, p_tipo, p_payload)` | `false` = evento repetido, responder 200 e parar |
| `resultado_evento_pagamento(p_evento_id, p_resultado)` | Anota o que foi feito |
| `liberar_reserva_online(p_acesso)` | A pessoa desistiu antes de pagar |
| `pedido_publico(p_acesso)` | Pedido e ingressos pelo código de acesso (compra pública e retomada do pagamento) |
| `solicitar_desistencia(p_acesso, p_motivo)` | Compra online paga há até 7 dias |
| `concluir_estorno(p_pedido)` | Só depois que a Pagar.me confirmou o estorno |

Agendamentos já criados no banco: `expirar_reservas` (a cada minuto) e `apagar_contatos` (diário).
Reserva vencida conta como livre na hora da compra, mesmo se o agendamento atrasar.

### 11.2 Pagar.me

- API v5: `https://api.pagar.me/core/v5`, autenticação Basic com a chave secreta como usuário e senha vazia.
- Secrets do Cloud: `PAGARME_SECRET_KEY`, `PAGARME_PUBLIC_KEY`, `PAGARME_WEBHOOK_SEGREDO`. A chave pública vai para o navegador só para tokenizar o cartão. Peça os valores ao Paulo pelo formulário de Secrets; nunca no chat.
- Criar pedido (`POST /orders`): `items` = `itens_pagarme` da função; `customer` com nome, e-mail, `document` (CPF só números), `type: individual` e `phones.mobile_phone` (55, DDD, número); `code` = código do pedido.
  - PIX: `payments: [{ payment_method: "pix", pix: { expires_in: segundos_restantes } }]`. Mostrar `charges[0].last_transaction.qr_code` (copia-e-cola) e `qr_code_url`.
  - Cartão: o navegador tokeniza o cartão direto na Pagar.me com a chave pública (o número do cartão nunca passa pelo nosso servidor). O servidor envia `payment_method: "credit_card"` com `installments`, `statement_descriptor` curto do evento, `card_token` e o endereço de cobrança no formato da referência v5. Endereço: pedir só CEP e número; completar pelo ViaCEP no navegador; se falhar, mostrar os campos.
  - Cadastrar o domínio do app na Pagar.me para a tokenização (orientar o Paulo no fechamento).
- Antes de criar um novo pedido na Pagar.me para o mesmo pedido nosso (troca de PIX para cartão), cancelar a cobrança anterior pendente.
- Resposta `paid`: chamar `finalizar_pedido_pago`. `failed`: `marcar_pagamento_falhou` e mostrar `cartao_recusado`. `pending` (PIX): mostrar o QR e consultar a cada 5 segundos por server function, que reconsulta `GET /orders/{id}` e finaliza quando pago.
- Webhook: server route `POST /api/pagarme/webhook/$segredo`.
  1. Comparar `$segredo` com `PAGARME_WEBHOOK_SEGREDO` em tempo constante; diferente = 404.
  2. `registrar_evento_pagamento(id do evento, type, corpo)`; `false` = responder 200 e parar.
  3. Achar o pedido da Pagar.me (`data.id` em eventos `order.*`; `data.order.id` em `charge.*`) e reconsultar `GET /orders/{id}`. Nunca confiar no corpo do evento.
  4. `paid`: `finalizar_pedido_pago`. `failed` ou `canceled`: `marcar_pagamento_falhou`.
  5. `resultado_evento_pagamento` e responder 200. Erro inesperado: 500, para a Pagar.me tentar de novo.
  6. Se o pedido já estava pago e chegou outra cobrança paga, anotar "pagamento duplicado" no resultado e mostrar em Pendências.
- Estorno (admin): server function que confere admin, chama `aprovar_desistencia`, cancela a cobrança na Pagar.me (`DELETE /charges/{charge_id}`) e, com sucesso, chama `concluir_estorno`.

### 11.3 Bilheteria da recepção (modo Coxia, notebook, `ssr: false`, papel bilheteria ou admin)

- `/bilheteria`: busca grande já focada (atalho `/`) por nome de bailarina ou responsável, sem acento. Resultado: família, filhas, selo Quebra-Nozes, saldo por sessão. Botões secundários: "Venda avulsa" e "Retirada de ingressos". Com mais de um evento em venda, seletor no topo, evento na URL.
- `/bilheteria/familia/$familiaId?sessao=`: painel da família à esquerda (filhas, dias, saldo, compras anteriores); mapa da sessão ao centro com `GradeDePoltronas`, em tempo real; barra fixa com lugares, total e "Reservar e cobrar".
  - Reservar com `reservar_presencial`. Se vierem `perdidos`, só esses saem da seleção e piscam no mapa, com a frase dizendo quais; os demais continuam.
  - Painel de adicionais (quantidade, entrega na sessão, dia do ensaio) e tipos de ingresso em novembro (inteira ou meia com categoria).
  - Janela de pagamento: forma, parcelas (só crédito e a partir do mínimo de ingressos), valor recebido e troco no dinheiro. "Registrar venda" chama `registrar_venda_presencial`.
  - Depois: aviso "Venda registrada", "Enviar comprovante no WhatsApp" (conteúdo `comprovante_presencial`) e "Próxima família", que volta à busca focada.
  - A cota nunca bloqueia. Fora das janelas Quebra-Nozes e Recepção, passar do saldo mostra aviso amarelo com o excedente. No dia da janela Quebra-Nozes, família sem o pacote mostra aviso amarelo.
  - "Emitir cortesia" com motivo.
- `/bilheteria/avulsa`: mesmo fluxo sem família.
- `/bilheteria/pedidos`: busca por código ou nome, filtros por dia e forma. Painel do pedido: trocar lugar (mini mapa) e cancelar (janela com motivo e o que será perdido).
- `/bilheteria/caixa`: `caixa_do_dia` de hoje e "Fechar caixa" com os valores conferidos por forma e a diferença (tabela `fechamentos_caixa`).
- `/bilheteria/retirada`: ler QR pela câmera (notebook ou celular) ou digitar o código ou buscar a família; `buscar_para_retirada`; marcar os ingressos entregues; "Imprimir ingressos da família".

### 11.4 Página da família (modo Palco, celular primeiro, `noindex`, `Referrer-Policy: no-referrer`)

- `/f/$codigo`: `Cortina` (chave = slug do evento) e `Proscenio`. Título `familia_titulo`. Um bloco por sessão com quem dança (`dia_bloco`), lugares da família (`dia_lugares`) e o botão "Escolher lugares". Depois: "Seus ingressos" (carteira com ingressos no estilo `.ingresso` e o QR), adicionais à venda, "Detalhes da compra", `retirada_aviso` dentro da janela de retirada, ajuda (`wa.me` para o WhatsApp da recepção com `ajuda`), e rodapé com termos e privacidade.
  - Estados: link inválido (`link_substituido`); antes da janela (`antes_online`, com o calendário); saldo zero (`dia_garantido`); pagamento pendente (faixa com "Voltar ao pagamento"); esqueleto ao carregar.
- `/f/$codigo/$sessaoId`: mapa com `mapa_da_sessao` e Realtime em `assentos` filtrado pela sessão (canal com nome único, ouvir `*` e filtrar no callback; consulta a cada 10 s se o tempo real cair). Visão geral cabendo na largura; tocar num setor aproxima (poltronas com 44 px, rolagem só dentro do mapa, palco sempre visível). Seleção até o saldo. Barra fixa com lugares, total e "Continuar", que chama `reservar_online`. Perdidos: só eles saem e piscam.
- `/f/$codigo/pagamento/$acesso`: `reserva_tempo` com contagem regressiva; tipos de ingresso em novembro (inteira ou meia com categoria e a declaração "declaro ter direito", desmarcada); adicionais; dados de quem paga (nome, CPF com máscara, e-mail, celular); PIX ou cartão; parcelas quando permitido; aceite dos termos (caixa desmarcada, com link); "Pagar". PIX: QR, copia-e-cola com botão de copiar e texto selecionável (`pix_instrucao`), a página atualiza sozinha. Ao voltar do app do banco ou recarregar, retoma pelo `pedido_publico` e reconsulta a Pagar.me. Reserva vencida: `reserva_expirou` com "Escolher de novo".
- `/f/$codigo/pedido/$acesso`: confirmação (`confirmacao`, `lembrete_filmagem`), ingressos com QR e "Detalhes da compra". Dentro dos detalhes, a linha discreta `desistencia_linha` até o prazo (sem cor, sem ícone, mesmo peso dos outros textos), que abre a janela `desistencia_confirmar` com "Confirmar desistência" e "Manter a compra".

### 11.5 Compra pública (modo Palco)

- `/e/$slug`: sessões com data e preços; aberta só na janela pública; antes disso, "A venda ao público abre em ...".
- `/e/$slug/$sessaoId` e `/p/$acesso`: mesmo mapa, pagamento e confirmação da família, sem saldo, com o limite por pedido. O código de acesso do pedido (`/p/$acesso`) é o "link do pedido": a confirmação mostra o link com botão de copiar e um botão para a pessoa enviar o link para o próprio WhatsApp.

### 11.6 Admin, acréscimos

- Aba `pedidos` do evento: todos os pedidos com filtros (canal, status, sessão, período) na URL; Pendências no topo: desistências a aprovar ("Aprovar e estornar"), pagos sem lugar ("Estornar" ou vender outro lugar pela Bilheteria) e pagamentos duplicados.
- Impressão de ingressos físicos: rota de impressão (`/admin/eventos/$eventoId/impressao?sessao=&familia=`), acessível também pela Bilheteria, com folhas A4 de 4 ingressos para recortar: proscênio fino, nome do evento, sessão, data e hora, setor, fila, número, tipo, código do pedido e QR. Estilo próprio de impressão (`@media print`), sem cor de fundo. Lista de quem ainda não retirou.
- Aba `adicionais`: "Relatório de entrega" por sessão (produto, quantidade, pedido e família), para imprimir e exportar em planilha.
- Visão geral: vendas por canal, setor e dia; meias vendidas por sessão; ocupação ao vivo.
- QR: biblioteca `qrcode` gerando SVG no navegador. Leitura: biblioteca de câmera de código aberto que funcione no notebook e no celular, com campo para digitar como alternativa.
