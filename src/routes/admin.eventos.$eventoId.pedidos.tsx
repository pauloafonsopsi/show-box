import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { dataHora, dinheiro, mensagemDeErro } from "@/lib/formato";
import { estornarDesistencia } from "@/lib/vendas-equipe.functions";

export const Route = createFileRoute("/admin/eventos/$eventoId/pedidos")({
  validateSearch: (s) =>
    z
      .object({
        canal: z.string().max(20).optional(),
        status: z.string().max(30).optional(),
        sessao: z.string().uuid().optional(),
        de: z.string().max(10).optional(),
        ate: z.string().max(10).optional(),
        pagina: z.number().int().min(0).optional(),
      })
      .parse(s),
  component: PedidosAdmin,
});

const POR_PAGINA = 50;
const CANAL: Record<string, string> = { presencial: "Recepção", online: "Família online", publico: "Público", cortesia: "Cortesia" };
const STATUS: Record<string, string> = {
  reservado: "Reservado",
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  pago_sem_lugar: "Pago sem lugar",
  cancelado: "Cancelado",
  expirado: "Expirado",
  estornado: "Estornado",
};

function Pendencias({ eventoId }: { eventoId: string }) {
  const queryClient = useQueryClient();
  const estornar = useServerFn(estornarDesistencia);
  const [enviando, setEnviando] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["pendencias", eventoId],
    queryFn: async () => {
      const [desist, semLugar, dup] = await Promise.all([
        supabase
          .from("desistencias")
          .select("id, motivo, solicitada_em, pedidos!inner(id, codigo, valor_total_centavos, evento_id, pagador_nome)")
          .is("estornada_em", null)
          .eq("pedidos.evento_id", eventoId),
        supabase.from("pedidos").select("id, codigo, valor_total_centavos, pagador_nome").eq("evento_id", eventoId).eq("status", "pago_sem_lugar"),
        supabase.from("eventos_pagamento").select("id, evento_gateway_id, tipo, recebido_em, payload").eq("resultado", "pagamento duplicado").order("recebido_em", { ascending: false }).limit(50),
      ]);
      if (desist.error) throw desist.error;
      if (semLugar.error) throw semLugar.error;
      return { desist: desist.data ?? [], semLugar: (semLugar.data ?? []).filter((p) => !(desist.data ?? []).some((d) => d.pedidos?.id === p.id)), dup: dup.data ?? [] };
    },
  });
  const aprovar = async (pedido: string) => {
    if (!window.confirm("Aprovar e estornar este pedido na Pagar.me?")) return;
    setEnviando(pedido);
    try {
      const r = await estornar({ data: { pedido } });
      toast.success(`Estorno de ${dinheiro(r.valor_total_centavos)} concluído.`);
      void queryClient.invalidateQueries({ queryKey: ["pendencias", eventoId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-pedidos"] });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(null);
    }
  };
  if (q.isLoading) return <EsqueletoLista linhas={2} />;
  if (q.error) return <EstadoErro mensagem={mensagemDeErro(q.error)} />;
  const d = q.data!;
  if (d.desist.length + d.semLugar.length + d.dup.length === 0) return null;
  return (
    <section className="mb-8 rounded-md border border-border p-4">
      <h2 className="text-lg font-semibold text-foreground">Pendências</h2>
      <ul className="numeros mt-2 divide-y divide-border text-sm">
        {d.desist.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 py-2">
            <SeloStatus tom="aviso">Desistência</SeloStatus>
            <span className="flex-1 text-foreground">
              {x.pedidos?.codigo}, {x.pedidos?.pagador_nome}, {dinheiro(x.pedidos?.valor_total_centavos)}. Pedida em {dataHora(x.solicitada_em)}
              {x.motivo ? `: ${x.motivo}` : ""}
            </span>
            <Button className="min-h-11" disabled={enviando === x.pedidos?.id} onClick={() => aprovar(x.pedidos!.id)}>
              Aprovar e estornar
            </Button>
          </li>
        ))}
        {d.semLugar.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
            <SeloStatus tom="erro">Pago sem lugar</SeloStatus>
            <span className="flex-1 text-foreground">
              {p.codigo}, {p.pagador_nome}, {dinheiro(p.valor_total_centavos)}
            </span>
            <Button variant="outline" className="min-h-11" asChild>
              <Link to="/bilheteria/avulsa">Vender outro lugar</Link>
            </Button>
            <Button className="min-h-11" disabled={enviando === p.id} onClick={() => aprovar(p.id)}>
              Estornar
            </Button>
          </li>
        ))}
        {d.dup.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
            <SeloStatus tom="erro">Pagamento duplicado</SeloStatus>
            <span className="flex-1 text-foreground">
              Evento {e.evento_gateway_id} ({e.tipo}) em {dataHora(e.recebido_em)}. Estorne a cobrança extra no painel da Pagar.me.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PedidosAdmin() {
  const { eventoId } = Route.useParams();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const pagina = busca.pagina ?? 0;
  const mudar = (s: Partial<typeof busca>) => navigate({ search: (a) => ({ ...a, pagina: undefined, ...s }) });

  const sessoes = useQuery({
    queryKey: ["admin-ped-sessoes", eventoId],
    queryFn: async () => (await supabase.from("sessoes").select("id, nome").eq("evento_id", eventoId).order("ordem")).data ?? [],
  });
  const q = useQuery({
    queryKey: ["admin-pedidos", eventoId, busca],
    queryFn: async () => {
      let c = supabase
        .from("pedidos")
        .select(busca.sessao ? "id, codigo, canal, status, forma_pagamento, valor_total_centavos, criado_em, pagador_nome, familias(responsavel_nome), ingressos!inner(sessao_id)" : "id, codigo, canal, status, forma_pagamento, valor_total_centavos, criado_em, pagador_nome, familias(responsavel_nome)")
        .eq("evento_id", eventoId)
        .order("criado_em", { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (busca.canal) c = c.eq("canal", busca.canal);
      if (busca.status) c = c.eq("status", busca.status);
      if (busca.sessao) c = c.eq("ingressos.sessao_id", busca.sessao);
      if (busca.de) c = c.gte("criado_em", `${busca.de}T00:00:00-03:00`);
      if (busca.ate) c = c.lte("criado_em", `${busca.ate}T23:59:59-03:00`);
      const { data, error } = await c;
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        codigo: string;
        canal: string;
        status: string;
        forma_pagamento: string | null;
        valor_total_centavos: number;
        criado_em: string;
        pagador_nome: string | null;
        familias: { responsavel_nome: string } | null;
      }>;
    },
  });

  const sel = "min-h-11 rounded-md border border-input bg-background px-3 text-[16px]";
  return (
    <div>
      <Pendencias eventoId={eventoId} />
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Canal" className={sel} value={busca.canal ?? ""} onChange={(e) => mudar({ canal: e.target.value || undefined })}>
          <option value="">Todos os canais</option>
          {Object.entries(CANAL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Situação" className={sel} value={busca.status ?? ""} onChange={(e) => mudar({ status: e.target.value || undefined })}>
          <option value="">Todas as situações</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Sessão" className={sel} value={busca.sessao ?? ""} onChange={(e) => mudar({ sessao: e.target.value || undefined })}>
          <option value="">Todas as sessões</option>
          {(sessoes.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <input type="date" aria-label="De" className={sel} value={busca.de ?? ""} onChange={(e) => mudar({ de: e.target.value || undefined })} />
        <input type="date" aria-label="Até" className={sel} value={busca.ate ?? ""} onChange={(e) => mudar({ ate: e.target.value || undefined })} />
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/admin/eventos/$eventoId/impressao" params={{ eventoId }} search={busca.sessao ? { sessao: busca.sessao } : {}}>
            Imprimir ingressos
          </Link>
        </Button>
      </div>
      {q.isLoading ? (
        <EsqueletoLista />
      ) : q.error ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} />
      ) : (q.data ?? []).length === 0 ? (
        <EstadoVazio titulo="Nenhum pedido com estes filtros" />
      ) : (
        <table className="numeros w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2">Pedido</th>
              <th className="py-2">Quem</th>
              <th className="py-2">Canal</th>
              <th className="py-2">Situação</th>
              <th className="py-2 text-right">Valor</th>
              <th className="py-2">Criado</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border text-foreground">
                <td className="py-2 font-medium">{p.codigo}</td>
                <td className="py-2">{p.familias?.responsavel_nome ?? p.pagador_nome ?? "Avulso"}</td>
                <td className="py-2">{CANAL[p.canal] ?? p.canal}</td>
                <td className="py-2">{STATUS[p.status] ?? p.status}</td>
                <td className="py-2 text-right">{dinheiro(p.valor_total_centavos)}</td>
                <td className="py-2 text-muted-foreground">{dataHora(p.criado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="min-h-11" disabled={pagina === 0} onClick={() => navigate({ search: (a) => ({ ...a, pagina: pagina - 1 }) })}>
          Anteriores
        </Button>
        <Button variant="outline" className="min-h-11" disabled={(q.data ?? []).length < POR_PAGINA} onClick={() => navigate({ search: (a) => ({ ...a, pagina: pagina + 1 }) })}>
          Próximos
        </Button>
      </div>
    </div>
  );
}
