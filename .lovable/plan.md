# Separar Gestão e Frente de Caixa + ingresso de gala

## O que muda para você

1. **Dois ambientes com nome claro**
   - **Gestão** (`/admin`): criar e configurar eventos, mapas, preços, elenco, equipe.
   - **Frente de Caixa** (`/bilheteria`): vender presencialmente no mapa, buscar família, venda avulsa, pedidos, retirada e caixa.
2. **Ligação evidente entre os dois**
   - No menu lateral da Gestão: item de destaque "Frente de Caixa" (ícone de bilheteria), separado das configurações.
   - Na barra da Frente de Caixa: botão "Gestão" (só aparece para o admin; atendente não vê).
   - Cada ambiente mostra no topo o nome do ambiente, para você saber onde está.
3. **Painel inicial com atalhos de operação**
   - Em cada evento no Painel: botões "Vender na recepção", "Retirada de ingressos" e "Pedidos", levando direto para a Frente de Caixa já com o evento escolhido.
4. **Ingresso de gala (tela de confirmação)**
   - Cartão em formato de canhoto de teatro: à esquerda sessão, setor, fila e poltrona em destaque numérico grande; picote vertical; à direita QR Code em fundo branco com margem igual nos lados.
   - No celular (360 px) o QR desce para baixo dos dados, centralizado e maior, para facilitar a leitura na portaria.
   - Bloco "Link do pedido" com botões Copiar e WhatsApp lado a lado, 44 px.
   - Vale para família, público e confirmação.

## O que não muda

Regras de venda, saldo, pagamento, webhook, reserva, banco de dados. Só menus, atalhos e aparência.

## Detalhes técnicos

- `src/routes/admin.tsx`: novo grupo "Operação" no Sidebar com Link para `/bilheteria`; rótulo "Gestão" no cabeçalho.
- `src/routes/bilheteria.tsx`: rótulo "Frente de Caixa"; Link para `/admin` visível só se o usuário tem papel admin (lido do contexto de `exigirPapel`).
- `src/routes/admin.index.tsx`: atalhos com `search={{ evento: ev.id }}` para `/bilheteria`, `/bilheteria/retirada`, `/bilheteria/pedidos`.
- `src/vendas/carteira.tsx`: novo layout com grid, picote via borda tracejada em token `border-primary/40`, QR 128 px dentro de `bg-card p-3`; só tokens existentes.
- `src/vendas/confirmacao.tsx`: reorganizar bloco do link e espaçamentos.
- Remover a frase duplicada "Esta página atualiza sozinha" restante em `pagamento.tsx`.
- Teste com Playwright em 360 px e 1280 px no painel, bilheteria e confirmação.
