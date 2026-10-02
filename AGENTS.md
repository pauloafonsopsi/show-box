<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Bilheteria de espetáculos

Especificação completa do sistema: `docs/ESPECIFICACAO.md` — vale sobre qualquer suposição; leia-a antes de mudar banco, telas ou regras de venda. Regras resumidas abaixo; a especificação manda quando houver diferença.

## Essência

Venda de ingressos com lugar marcado para o Ballet Letícia Lobo (primeiro evento: O Quebra-Nozes 2026, 28 e 29/11). Canais: recepção (atendente registra, sem gateway), família (link individual sem login, `/f/<código>` no caminho) e público (`/e/<slug>`, após abertura). Paulo é o único admin.

## Regras inegociáveis

1. Toda regra de venda (cota, preços, janelas, textos, termos) pertence ao evento; nada específico de evento no código. Dado operacional fica no banco e editável no painel.
2. Saldo da família por sessão = cota do evento x filhas escaladas menos ingressos ativos; nunca negativo; calculado só no banco.
3. Família e público nunca autenticam. Única leitura pública direta: status dos lugares. Todo o resto passa por server function que valida o código.
4. Preço, parcelas e estoque calculados no servidor; o navegador nunca envia valor a cobrar.
5. Mapa da sessão é cópia congelada; lugar vendido via reserva atômica com prazo; no máximo um ingresso ativo por lugar.
6. Ingresso só nasce depois que o servidor reconsulta a Pagar.me; atendente nunca é bloqueada pela cota.
7. Dado de criança mínimo: só primeiros nomes; nada de nascimento/CPF de bailarina.
8. Papéis em `user_roles` com `has_role`; permissão checada no servidor; RLS em toda tabela; segredos só em Secrets.
9. Pagamento: Pagar.me (PIX e cartão tokenizado); webhook em `src/routes/api/pagarme/webhook.$segredo.ts` (rota de API, não Edge Function). Nada de fórmula de saldo, congelamento, pagamento, estorno, webhook, papéis, chaves editáveis pelo painel.

## Arquivos do Claude (aplicar exatamente, nunca reescrever)

`docs/ESPECIFICACAO.md` seção 2 lista as migrations da fundação/carga, `src/styles.css`, `src/design/grade.ts`, `src/design/palco.tsx`, `src/design/editor-de-grade.tsx`. Se um não encaixar, pare e explique antes de alterar.

## Design e idioma

- Coxia (equipe, claro) e Palco (família, escuro, dourado). Só tokens de `src/styles.css` e componentes de `src/design` e `src/components/ui`; nunca o visual padrão do shadcn.
- pt-BR; fuso America/Belem; dinheiro em centavos, exibido com `Intl.NumberFormat("pt-BR")`; WhatsApp `55`+DDD+número.
- Proibido: gradiente decorativo, vidro fosco, emoji como ícone, travessão, rótulo em caixa alta acima de título, animação de entrada em seção, efeito ao passar o mouse em cartões.
- Alvos de toque 44 px (`min-h-11`), campos 16 px, corpo 16 px, tabela densa 14 px.
- Construção em blocos: implemente só o bloco pedido; necessidade extra vai numa lista no final.

## Fechamento obrigatório de toda tarefa

1. "Editável no painel em: [caminho]" ou "Ficou no código porque: [motivo]" para cada coisa criada.
2. O que não fez e por quê.
3. Riscos que percebeu.
