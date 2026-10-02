// Webhook da Pagar.me. A URL tem o segredo no caminho: /api/pagarme/webhook/$segredo
// Nunca confia no corpo do evento: reconsulta a Pagar.me antes de finalizar.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

import { mensagemBanco, rpcAdmin, comChaveServico, pagarmeGet } from "@/lib/vendas.server";

interface OrderPagar {
  id: string;
  status: string;
  charges?: Array<{ id: string; status: string }>;
}

function corpoDoEvento(c: unknown): { tipo: string; idEvento: string; idPedido: string | null } | null {
  const e = c as { type?: string; data?: { id?: string; order?: { id?: string } } } | null;
  if (!e?.type) return null;
  const idPedido = e.data?.id ?? e.data?.order?.id ?? null;
  return { tipo: e.type, idEvento: e.data?.id ?? "", idPedido };
}

function segredoIgual(recebido: string, esperado: string): boolean {
  if (recebido.length !== esperado.length) return false;
  try {
    return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/pagarme/webhook/$segredo")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const segredo = process.env["PAGARME_WEBHOOK_SEGREDO"];
        if (!segredo) return new Response("Webhook sem segredo configurado.", { status: 500 });
        if (!segredoIgual(params.segredo ?? "", segredo)) return new Response("Not found", { status: 404 });

        try {
          const corpo = (await request.json().catch(() => null)) as unknown;
          const ev = corpoDoEvento(corpo);
          if (!ev || !ev.idPedido) {
            // Evento sem pedido: registra e responde bem para a Pagar.me não repetir.
            if (ev) await rpcAdmin("registrar_evento_pagamento", { p_evento_id: ev.idEvento, p_tipo: ev.tipo, p_payload: corpo });
            return new Response("ok");
          }

          const primeiro = await rpcAdmin<boolean>("registrar_evento_pagamento", {
            p_evento_id: ev.idEvento,
            p_tipo: ev.tipo,
            p_payload: corpo,
          });
          if (!primeiro) return new Response("ok"); // evento repetido

          const order = await pagarmeGet<OrderPagar>(`/orders/${ev.idPedido}`);
          const status = order.status;
          let resultado: string;

          if (status === "paid") {
            const supabase = await comChaveServico();
            const { data: ja } = await supabase
              .from("pedidos")
              .select("status")
              .eq("pagarme_order_id", order.id)
              .maybeSingle();
            resultado = ja && (ja.status === "pago" || ja.status === "pago_sem_lugar") ? "pagamento duplicado" : "";
            await rpcAdmin("finalizar_pedido_pago", { p_pagarme_order_id: order.id });
            if (!resultado) resultado = "pedido pago";
          } else if (status === "failed" || status === "canceled") {
            await rpcAdmin("marcar_pagamento_falhou", { p_pagarme_order_id: order.id });
            resultado = `pagamento ${status}`;
          } else {
            resultado = `consulta: ${status}`;
          }

          await rpcAdmin("resultado_evento_pagamento", { p_evento_id: ev.idEvento, p_resultado: resultado });
          return new Response("ok");
        } catch (e) {
          console.error("[pagarme webhook]", mensagemBanco(e));
          return new Response("Erro interno", { status: 500 });
        }
      },
    },
  },
});
