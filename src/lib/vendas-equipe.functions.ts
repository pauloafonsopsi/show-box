// Server functions da equipe: Bilheteria, trocas, cortesias, caixa, retirada e estorno.
// Autenticam com o login da atendente ou do admin; o banco confere o papel por dentro.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mensagemBanco, pagarmeDelete, rpcAdmin } from "./vendas.server";

type Supa = { rpc: (nome: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
type Ctx = { supabase: Supa; userId: string };

async function rpcEquipe<T>(context: unknown, nome: string, args: Record<string, unknown>): Promise<T> {
  const { supabase } = context as Ctx;
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw new Error(mensagemBanco(error));
  return data as T;
}

async function exigirAdmin(context: unknown): Promise<boolean> {
  const { supabase, userId } = context as Ctx;
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Não foi possível conferir sua permissão.");
  if (!data) throw new Error("Somente administradores podem aprovar estornos.");
  return true;
}

const IngressoEscolhido = z.object({
  numero: z.number().int().min(1).max(9999),
  sessao_id: z.string().uuid(),
  tipo: z.enum(["meia_todos", "inteira", "meia", "cortesia"]),
  categoria_meia: z.string().trim().max(60).optional(),
});

const AdicionalEscolhido = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().int().min(1).max(50),
  sessao_entrega_id: z.string().uuid().optional(),
  produto_data_id: z.string().uuid().optional(),
});

export interface RespostaReserva {
  ok: boolean;
  pedido_id?: string;
  codigo?: string;
  acesso_token?: string;
  expira_em?: string;
  reservados?: number;
  perdidos?: number[];
}

export const reservarPresencial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessao: z.string().uuid(),
        numeros: z.array(z.number().int().min(1).max(9999)).min(1).max(20),
        familia: z.string().uuid().optional(),
        pedido: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpcEquipe<RespostaReserva>(context, "reservar_presencial", {
      p_sessao: data.sessao,
      p_numeros: data.numeros,
      p_familia: data.familia ?? null,
      p_pedido: data.pedido ?? null,
    }),
  );

export const previaPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        pedido: z.string().uuid(),
        ingressos: z.array(IngressoEscolhido).max(30),
        adicionais: z.array(AdicionalEscolhido).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpcEquipe<Record<string, unknown>>(context, "previa_pedido", {
      p_pedido: data.pedido,
      p_ingressos: data.ingressos,
      p_adicionais: data.adicionais,
    }),
  );

export const registrarVendaPresencial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        pedido: z.string().uuid(),
        ingressos: z.array(IngressoEscolhido).max(30),
        adicionais: z.array(AdicionalEscolhido).max(50),
        forma: z.enum(["credito", "debito", "pix", "dinheiro"]),
        parcelas: z.number().int().min(1).max(12).default(1),
        valorRecebidoCentavos: z.number().int().min(0).max(100_000_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpcEquipe<Record<string, unknown>>(context, "registrar_venda_presencial", {
      p_pedido: data.pedido,
      p_ingressos: data.ingressos,
      p_adicionais: data.adicionais,
      p_forma: data.forma,
      p_parcelas: data.parcelas,
      p_valor_recebido_centavos: data.valorRecebidoCentavos ?? null,
    }),
  );

export const liberarReservaEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pedido: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => rpcEquipe<void>(context, "liberar_reserva", { p_pedido: data.pedido }));

export const cancelarVendaEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pedido: z.string().uuid(), motivo: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => rpcEquipe<void>(context, "cancelar_venda", { p_pedido: data.pedido, p_motivo: data.motivo }));

export const trocarLugar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ ingresso: z.string().uuid(), novoNumero: z.number().int().min(1).max(9999), motivo: z.string().trim().max(300).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpcEquipe<Record<string, unknown>>(context, "trocar_lugar", {
      p_ingresso: data.ingresso,
      p_novo_numero: data.novoNumero,
      p_motivo: data.motivo ?? null,
    }),
  );

export const emitirCortesia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessao: z.string().uuid(),
        numeros: z.array(z.number().int().min(1).max(9999)).min(1).max(20),
        motivo: z.string().trim().min(1).max(200),
        familia: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpcEquipe<RespostaReserva>(context, "emitir_cortesia", {
      p_sessao: data.sessao,
      p_numeros: data.numeros,
      p_motivo: data.motivo,
      p_familia: data.familia ?? null,
    }),
  );

export const buscarParaRetirada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string().trim().min(4).max(120) }).parse(d))
  .handler(async ({ data, context }) => rpcEquipe<Record<string, unknown> | null>(context, "buscar_para_retirada", { p_codigo: data.codigo }));

export const marcarEntregues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ingressos: z.array(z.string().uuid()).min(1).max(200), entregue: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => rpcEquipe<number>(context, "marcar_entregues", { p_ingressos: data.ingressos, p_entregue: data.entregue }));

export const caixaDoDia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ evento: z.string().uuid(), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), atendente: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) =>
    rpcEquipe<Record<string, { pedidos: number; total_centavos: number }>>(context, "caixa_do_dia", {
      p_evento: data.evento,
      p_data: data.data,
      p_atendente: data.atendente ?? null,
    }),
  );

/** Admin aprova a desistência, cancela a cobrança na Pagar.me e conclui o estorno. */
export const estornarDesistencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pedido: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const aprov = await rpcEquipe<{ pagarme_charge_id: string; valor_total_centavos: number }>(context, "aprovar_desistencia", {
      p_pedido: data.pedido,
    });
    try {
      await pagarmeDelete(`/charges/${aprov.pagarme_charge_id}`);
    } catch (e) {
      throw new Error(mensagemBanco(e) === "A operadora de pagamento respondeu com erro 404."
        ? "A cobrança não foi encontrada na Pagar.me. Confira o valor recebido antes de continuar."
        : mensagemBanco(e));
    }
    await rpcAdmin("concluir_estorno", { p_pedido: data.pedido });
    return { ok: true, valor_total_centavos: aprov.valor_total_centavos };
  });
