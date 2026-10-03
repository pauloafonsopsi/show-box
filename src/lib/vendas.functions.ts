// Server functions públicas da venda online. Família e público nunca autenticam:
// todo acesso passa por aqui, validando o código do link ou o código de acesso.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import type { MapaSessao } from "@/vendas/tipos";
import {
  ErroPagarme,
  comChaveServico,
  mensagemBanco,
  pagarmeDelete,
  pagarmeGet,
  pagarmePost,
  rpcAdmin,
} from "./vendas.server";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

const Acesso = z.string().trim().min(10).max(64);
type MapaDaSessao = MapaSessao | null;

export interface RespostaReserva {
  ok: boolean;
  pedido_id?: string;
  codigo?: string;
  acesso_token?: string;
  expira_em?: string;
  reservados?: number;
  perdidos?: number[];
}

const IngressoEscolhido = z.object({
  numero: z.number().int().min(1).max(9999),
  sessao_id: z.string().uuid(),
  tipo: z.enum(["meia_todos", "inteira", "meia"]),
  categoria_meia: z.string().trim().max(60).optional(),
});

const AdicionalEscolhido = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().int().min(1).max(50),
  sessao_entrega_id: z.string().uuid().optional(),
  produto_data_id: z.string().uuid().optional(),
});

const Pagador = z.object({
  nome: z.string().trim().min(2).max(120),
  cpf: z.string().trim().max(20),
  email: z.string().trim().max(120),
  celular: z.string().trim().max(20),
});

/** Página da família. `null` = link inválido ou substituído. */
export const painelFamilia = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ codigo: Acesso }).parse(d))
  .handler(async ({ data }) => {
    const painel = await rpcAdmin<Record<string, Json> | null>("familia_painel", {
      p_token: data.codigo,
    });
    return painel;
  });

export const reservarOnline = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        sessao: z.string().uuid(),
        numeros: z.array(z.number().int().min(1).max(9999)).min(1).max(20),
        tokenFamilia: z.string().trim().max(100).optional(),
        acessoPedido: z.string().trim().max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<RespostaReserva> => {
    return rpcAdmin<RespostaReserva>("reservar_online", {
      p_sessao: data.sessao,
      p_numeros: data.numeros,
      p_token_familia: data.tokenFamilia ?? null,
      p_acesso_pedido: data.acessoPedido ?? null,
    });
  });

/** Tudo o que a tela de pagamento precisa: pedido, evento e lugares reservados. */
export const estadoPagamento = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ acesso: Acesso }).parse(d))
  .handler(async ({ data }) => {
    const supabase = await comChaveServico();
    const pedido = await rpcAdmin<Record<string, Json> | null>("pedido_publico", {
      p_acesso: data.acesso,
    });
    if (!pedido) return null;

    const eventoId = pedido["evento_id"] as string | null;
    if (!eventoId) return null;

    const [ev, termos, lugaresRes] = await Promise.all([
      supabase
        .from("eventos")
        .select(
          "id, nome, slug, status, tema, imagem_capa, meia_categorias, parcelamento_min_ingressos, parcelas_max, limite_por_pedido",
        )
        .eq("id", eventoId)
        .maybeSingle(),
      supabase
        .from("termos_versoes")
        .select("id, versao, texto")
        .eq("evento_id", eventoId)
        .eq("tipo", "termos")
        .order("versao", { ascending: false })
        .limit(1),
      supabase.from("pedidos").select("id").eq("acesso_token", data.acesso).maybeSingle(),
    ]);

    const lugares = lugaresRes.data?.id
      ? await supabase
          .from("assentos")
          .select(
            "id, numero, linha, coluna, rotulo_fila, setor_id, sessao_id, acessivel, setores(nome)",
          )
          .eq("reserva_id", lugaresRes.data.id)
          .eq("status", "reservado")
          .order("numero")
      : { data: [] };

    // Mapas das sessões deste pedido, para escolher os tipos de ingresso com preço.
    const sessoesIds = [
      ...new Set(((lugares.data ?? []) as Array<{ sessao_id: string }>).map((l) => l.sessao_id)),
    ];
    const mapas = await Promise.all(
      sessoesIds.map(async (id) => {
        const { data } = await supabase.rpc("mapa_da_sessao", { p_sessao: id });
        return { sessao_id: id, mapa: (data ?? null) as MapaDaSessao | null };
      }),
    );

    return {
      pedido,
      evento: ev.data ?? null,
      termos: termos.data?.[0] ?? null,
      lugares: (lugares.data ?? []) as Array<{
        id: string;
        numero: number;
        linha: number;
        coluna: number;
        rotulo_fila: string | null;
        setor_id: string;
        sessao_id: string;
        acessivel: boolean;
        setores: { nome: string } | null;
      }>,
      sessoes_mapas: mapas,
    };
  });

/** Reconsulta a Pagar.me e finaliza se pago. Devolve o estado atual do pedido. */
export const statusPagamento = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ acesso: Acesso }).parse(d))
  .handler(async ({ data }) => {
    const supabase = await comChaveServico();
    const { data: p } = await supabase
      .from("pedidos")
      .select("id, status, pagarme_order_id")
      .eq("acesso_token", data.acesso)
      .maybeSingle();
    if (!p) throw new Error("Pedido não encontrado.");

    let pixQr: string | null = null;
    if (p.pagarme_order_id && (p.status === "aguardando_pagamento" || p.status === "reservado")) {
      try {
        const order = await pagarmeGet<{
          status: string;
          charges?: Array<{
            payment_method?: string;
            status?: string;
            last_transaction?: { qr_code?: string };
          }>;
        }>(`/orders/${p.pagarme_order_id}`);
        const c = order.charges?.[0];
        if (order.status === "pending" && c?.payment_method === "pix")
          pixQr = c.last_transaction?.qr_code ?? null;
        if (order.status === "paid")
          await rpcAdmin("finalizar_pedido_pago", { p_pagarme_order_id: p.pagarme_order_id });
        else if (order.status === "failed" || order.status === "canceled")
          await rpcAdmin("marcar_pagamento_falhou", { p_pagarme_order_id: p.pagarme_order_id });
      } catch (e) {
        if (e instanceof ErroPagarme) throw e;
        // Falha de rede com a Pagar.me: o estado do banco prevalece.
      }
    }
    const pub = await rpcAdmin<Record<string, Json> | null>("pedido_publico", {
      p_acesso: data.acesso,
    });
    return pub ? { ...pub, pix_qr_code: pixQr } : null;
  });

/** Fecha o pedido no banco e cria a cobrança na Pagar.me. Só o servidor calcula valores. */
export const iniciarPagamento = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        acesso: Acesso,
        ingressos: z.array(IngressoEscolhido).min(1).max(20),
        adicionais: z.array(AdicionalEscolhido).max(50),
        pagador: Pagador,
        forma: z.enum(["pix", "cartao"]),
        parcelas: z.number().int().min(1).max(12),
        termosVersao: z.string().uuid(),
        cartaoToken: z.string().trim().min(4).max(120).optional(),
        cep: z.string().trim().max(9).optional(),
        numero: z.string().trim().max(20).optional(),
        referencia: z.string().trim().max(160).optional(),
        cidade: z.string().trim().max(80).optional(),
        estado: z.string().trim().max(2).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ip = ipDeQuemChama();
    const supabase = await comChaveServico();

    const comp = await rpcAdmin<Record<string, Json>>("fechar_pedido_online", {
      p_acesso: data.acesso,
      p_ingressos: data.ingressos,
      p_adicionais: data.adicionais,
      p_pagador: data.pagador,
      p_forma: data.forma,
      p_parcelas: data.parcelas,
      p_termos_versao: data.termosVersao,
      p_ip: ip,
    });

    // Cancela a cobrança pendente anterior antes de criar uma nova.
    const { data: anterior } = await supabase
      .from("pedidos")
      .select("status, pagarme_order_id")
      .eq("acesso_token", data.acesso)
      .maybeSingle();
    if (anterior?.pagarme_order_id) {
      if (anterior.status === "pago" || anterior.status === "pago_sem_lugar")
        throw new Error("Esta compra já foi paga. Veja os ingressos em Detalhes da compra.");
      const orderAnterior = await pagarmeGet<{
        status: string;
        charges?: Array<{ id: string; status: string }>;
      }>(`/orders/${anterior.pagarme_order_id}`);
      if (orderAnterior.status === "paid")
        throw new Error("Esta compra já foi paga. Veja os ingressos em Detalhes da compra.");
      for (const c of (orderAnterior.charges ?? []).filter((c) => c.status === "pending")) {
        try {
          await pagarmeDelete(`/charges/${c.id}`);
        } catch {
          // Cobrança já cancelada ou expirada: segue.
        }
      }
      await rpcAdmin("marcar_pagamento_falhou", { p_pagarme_order_id: anterior.pagarme_order_id });
    }

    if (data.forma === "cartao" && !data.cartaoToken)
      throw new Error("Cartão não identificado. Preencha os dados de novo.");

    const pedidoId = comp["pedido_id"] as string;
    const { data: ev } = await supabase
      .from("eventos")
      .select("nome, fatura_cartao")
      .eq("id", (await donoEvento(pedidoId)) as string)
      .maybeSingle();
    // Prioridade: nome escolhido no painel; senão, o nome do evento limpo e cortado.
    const descriptor = await descriptorDe(ev?.fatura_cartao || ev?.nome || null);

    if (
      data.forma === "cartao" &&
      (!data.cidade?.trim() || !data.estado?.trim() || !data.cep?.trim() || !data.numero?.trim())
    )
      throw new Error("Preencha CEP, número, cidade e estado do endereço de cobrança.");

    // Celular já normalizado pelo banco: 55 + DDD + 9 dígitos.
    const { data: pg } = await supabase
      .from("pedidos")
      .select("pagador_celular")
      .eq("id", pedidoId)
      .maybeSingle();
    const celular = (pg?.pagador_celular ?? "").replace(/\D/g, "");
    const area = celular.slice(2, 4);
    const numero = celular.slice(4);
    const endereco = {
      line_1: `${data.numero ?? ""}, ${data.referencia ?? ""}`.trim(),
      zip_code: (data.cep ?? "").replace(/\D/g, ""),
      city: data.cidade ?? "",
      state: data.estado ?? "",
      country: "BR",
    };
    const pagamentos =
      data.forma === "pix"
        ? [
            {
              payment_method: "pix",
              pix: { expires_in: Math.max(60, Number(comp["segundos_restantes"] ?? 600)) },
            },
          ]
        : [
            {
              payment_method: "credit_card",
              credit_card: {
                installments: data.parcelas,
                statement_descriptor: descriptor,
                card_token: data.cartaoToken,
                card: { billing_address: endereco },
              },
            },
          ];

    const order = await pagarmePost<{
      id: string;
      status: string;
      charges?: Array<{
        id: string;
        status: string;
        last_transaction?: { qr_code?: string; qr_code_url?: string };
      }>;
    }>("/orders", {
      code: comp["codigo"],
      items: comp["itens_pagarme"],
      customer: {
        name: data.pagador.nome,
        email: data.pagador.email,
        type: "individual",
        document: (data.pagador.cpf ?? "").replace(/\D/g, ""),
        phones: { mobile_phone: { country_code: "55", area_code: area, number: numero } },
      },
      payments: pagamentos,
    });

    await rpcAdmin("registrar_pagarme", {
      p_acesso: data.acesso,
      p_order_id: order.id,
      p_charge_id: order.charges?.[0]?.id ?? null,
    });

    const pix = order.charges?.[0]?.last_transaction;
    if (data.forma === "pix" && (!pix?.qr_code || order.status === "failed")) {
      throw new Error(
        "Não foi possível gerar o PIX agora. Tente de novo em instantes ou pague com cartão.",
      );
    }
    // Cartão recusado na hora: libera a cobrança e devolve o erro para a tela, sem ficar esperando.
    if (data.forma === "cartao" && (order.status === "failed" || order.status === "canceled")) {
      await rpcAdmin("marcar_pagamento_falhou", { p_pagarme_order_id: order.id });
      throw new Error(
        "O cartão não foi aprovado. Confira os dados, tente outro cartão ou pague com PIX.",
      );
    }
    return {
      codigo: comp["codigo"],
      total_centavos: comp["valor_total_centavos"],
      segundos_restantes: comp["segundos_restantes"],
      status: order.status,
      pix_qr_code: pix?.qr_code ?? null,
      pix_qr_code_url: pix?.qr_code_url ?? null,
    };
  });

async function donoEvento(pedidoId: string): Promise<string | null> {
  const supabase = await comChaveServico();
  const { data } = await supabase
    .from("pedidos")
    .select("evento_id")
    .eq("id", pedidoId)
    .maybeSingle();
  return data?.evento_id ?? null;
}

async function descriptorDe(nome: string | null): Promise<string> {
  const limpo = (nome ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim()
    .slice(0, 13) // limite da operadora para o nome na fatura
    .trim();
  return limpo.length >= 3 ? limpo : "INGRESSOS";
}

function ipDeQuemChama(): string | null {
  try {
    const h = getRequest().headers;
    const f = h.get("x-forwarded-for");
    if (f) return f.split(",")[0]?.trim() ?? null;
    return null;
  } catch {
    return null;
  }
}

export const liberarReservaOnline = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ acesso: Acesso }).parse(d))
  .handler(async ({ data }) => {
    await rpcAdmin("liberar_reserva_online", { p_acesso: data.acesso });
    return { ok: true };
  });

export const pedidoPublico = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ acesso: Acesso }).parse(d))
  .handler(async ({ data }) => {
    return rpcAdmin<Record<string, Json> | null>("pedido_publico", { p_acesso: data.acesso });
  });

export const desistirDaCompra = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ acesso: Acesso, motivo: z.string().trim().max(500).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    await rpcAdmin("solicitar_desistencia", {
      p_acesso: data.acesso,
      p_motivo: data.motivo ?? null,
    });
    return { ok: true };
  });

/** Dados do espetáculo para a compra pública: sessões, janela e termos vigentes. */
export const dadosEventoPublico = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = await comChaveServico();
    const { data: ev, error } = await supabase
      .from("eventos")
      .select("id, nome, slug, status, tema, imagem_capa, limite_por_pedido")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(mensagemBanco(error));
    if (!ev) return null;
    const [sessoes, janelas, termos, conteudos] = await Promise.all([
      supabase
        .from("sessoes")
        .select("id, nome, data_hora, abertura_portas")
        .eq("evento_id", ev.id)
        .eq("ativa", true)
        .order("ordem"),
      supabase
        .from("janelas")
        .select("tipo, inicio, fim")
        .eq("evento_id", ev.id)
        .eq("tipo", "publico")
        .order("inicio"),
      supabase
        .from("termos_versoes")
        .select("id, versao, texto")
        .eq("evento_id", ev.id)
        .eq("tipo", "termos")
        .order("versao", { ascending: false })
        .limit(1),
      supabase.from("conteudos").select("chave, texto").eq("evento_id", ev.id),
    ]);
    if (sessoes.error || janelas.error || termos.error || conteudos.error)
      throw new Error(
        mensagemBanco(sessoes.error ?? janelas.error ?? termos.error ?? conteudos.error),
      );
    const textos: Record<string, string> = {};
    for (const c of conteudos.data ?? []) if (c.chave) textos[c.chave] = c.texto;
    return {
      evento: ev,
      sessoes: sessoes.data ?? [],
      janelas: janelas.data ?? [],
      termos: termos.data?.[0] ?? null,
      conteudos: textos,
    };
  });

/** Chave pública da Pagar.me para o navegador tokenizar o cartão (nunca a chave secreta). */
export const chavePublicaPagarme = createServerFn({ method: "GET" }).handler(async () => {
  const chave = process.env["PAGARME_PUBLIC_KEY"];
  if (!chave)
    throw new Error("A chave pública de pagamento não está configurada. Fale com o administrador.");
  return chave;
});

/** Evento e textos do pedido pelo código de acesso (página /p). */
export const contextoPedido = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ acesso: Acesso }).parse(d))
  .handler(async ({ data }) => {
    const supabase = await comChaveServico();
    const { data: p } = await supabase
      .from("pedidos")
      .select("evento_id")
      .eq("acesso_token", data.acesso)
      .maybeSingle();
    if (!p) return null;
    const [ev, cont] = await Promise.all([
      supabase
        .from("eventos")
        .select("nome, slug, limite_por_pedido")
        .eq("id", p.evento_id)
        .maybeSingle(),
      supabase.from("conteudos").select("chave, texto").eq("evento_id", p.evento_id),
    ]);
    const conteudos: Record<string, string> = {};
    for (const c of cont.data ?? []) if (c.chave) conteudos[c.chave] = c.texto;
    return { evento: ev.data ?? null, conteudos };
  });

/** Texto vigente dos termos (por evento) ou da política de privacidade. */
export const textoLegal = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        tipo: z.enum(["termos", "privacidade"]),
        slug: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await comChaveServico();
    let eventoId: string | null = null;
    let nome: string | null = null;
    if (data.slug) {
      const { data: ev } = await supabase
        .from("eventos")
        .select("id, nome")
        .eq("slug", data.slug)
        .maybeSingle();
      if (!ev) return null;
      eventoId = ev.id;
      nome = ev.nome;
    }
    let q = supabase
      .from("termos_versoes")
      .select("versao, texto, publicada_em")
      .eq("tipo", data.tipo);
    if (eventoId) q = q.eq("evento_id", eventoId);
    const { data: t } = await q.order("publicada_em", { ascending: false }).limit(1);
    const v = t?.[0];
    return v ? { evento: nome, versao: v.versao, texto: v.texto } : null;
  });
