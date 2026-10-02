import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cabecalho, EsqueletoLista, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { dataHora, dinheiro, mensagemDeErro } from "@/lib/formato";
import { cancelarVendaEquipe, trocarLugar } from "@/lib/vendas-equipe.functions";
import { MapaPoltronas, useMapaSessao } from "@/vendas/mapa-sessao";
import { FORMA_PRESENCIAL, useEventoAtual, useSessoesEvento } from "@/bilheteria/comum";

export const Route = createFileRoute("/bilheteria/pedidos")({
  validateSearch: (s) =>
    z
      .object({
        evento: z.string().uuid().optional(),
        q: z.string().max(80).optional(),
        sessao: z.string().uuid().optional(),
        forma: z.string().max(20).optional(),
        pedido: z.string().uuid().optional(),
      })
      .parse(s),
  component: Pedidos,
});

const POR_PAGINA = 30;

function Pedidos() {
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const { evento } = useEventoAtual();
  const sessoes = useSessoesEvento(evento?.id);
  const [texto, setTexto] = useState(busca.q ?? "");

  const lista = useQuery({
    enabled: Boolean(evento),
    queryKey: ["bilheteria-pedidos", evento?.id, busca.q, busca.forma, busca.sessao],
    queryFn: async () => {
      let q = supabase
        .from("pedidos")
        .select("id, codigo, status, canal, forma_pagamento, valor_total_centavos, pago_em, familias(responsavel_nome), ingressos!inner(sessao_id)")
        .eq("evento_id", evento!.id)
        .in("status", ["pago", "pago_sem_lugar"])
        .order("pago_em", { ascending: false })
        .limit(POR_PAGINA);
      if (busca.forma) q = q.eq("forma_pagamento", busca.forma);
      if (busca.sessao) q = q.eq("ingressos.sessao_id", busca.sessao);
      if (busca.q) {
        const t = busca.q.trim();
        const { data: fams } = await supabase.from("familias").select("id").eq("evento_id", evento!.id).ilike("responsavel_nome", `%${t}%`).limit(30);
        const ids = (fams ?? []).map((f) => f.id);
        q = ids.length ? q.or(`codigo.ilike.%${t}%,familia_id.in.(${ids.join(",")})`) : q.ilike("codigo", `%${t}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const mudar = (s: Partial<typeof busca>) => navigate({ search: (a) => ({ ...a, ...s }) });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div>
        <Cabecalho titulo="Pedidos" trilha={[{ rotulo: "Bilheteria", to: "/bilheteria" }]} />
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            mudar({ q: texto || undefined });
          }}
        >
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Código ou nome do responsável" className="h-11 flex-1 text-[16px]" aria-label="Buscar pedido" />
          <select aria-label="Sessão" className="min-h-11 rounded-md border border-input bg-background px-3 text-[16px]" value={busca.sessao ?? ""} onChange={(e) => mudar({ sessao: e.target.value || undefined })}>
            <option value="">Todos os dias</option>
            {(sessoes.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
          <select aria-label="Forma" className="min-h-11 rounded-md border border-input bg-background px-3 text-[16px]" value={busca.forma ?? ""} onChange={(e) => mudar({ forma: e.target.value || undefined })}>
            <option value="">Todas as formas</option>
            {Object.entries(FORMA_PRESENCIAL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Button type="submit" className="min-h-11">
            Buscar
          </Button>
        </form>
        <div className="mt-4">
          {lista.isLoading ? (
            <EsqueletoLista />
          ) : (lista.data ?? []).length === 0 ? (
            <EstadoVazio titulo="Nenhum pedido encontrado" />
          ) : (
            <table className="numeros w-full text-sm">
              <tbody>
                {(lista.data ?? []).map((p) => (
                  <tr key={p.id} className={`border-b border-border ${busca.pedido === p.id ? "bg-secondary" : ""}`}>
                    <td className="py-2">
                      <button type="button" className="min-h-11 text-left font-medium text-foreground underline underline-offset-4" onClick={() => mudar({ pedido: p.id })}>
                        {p.codigo}
                      </button>
                    </td>
                    <td className="py-2 text-foreground">{p.familias?.responsavel_nome ?? "Avulso"}</td>
                    <td className="py-2">{FORMA_PRESENCIAL[p.forma_pagamento ?? ""] ?? p.forma_pagamento}</td>
                    <td className="py-2">{dinheiro(p.valor_total_centavos)}</td>
                    <td className="py-2 text-muted-foreground">{dataHora(p.pago_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <aside>{busca.pedido ? <PainelPedido pedidoId={busca.pedido} fechar={() => mudar({ pedido: undefined })} /> : null}</aside>
    </div>
  );
}

function PainelPedido({ pedidoId, fechar }: { pedidoId: string; fechar: () => void }) {
  const queryClient = useQueryClient();
  const cancelar = useServerFn(cancelarVendaEquipe);
  const trocar = useServerFn(trocarLugar);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [troca, setTroca] = useState<{ ingresso: string; sessao: string; numero: number } | null>(null);
  const [novo, setNovo] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  const q = useQuery({
    queryKey: ["bilheteria-pedido", pedidoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, codigo, canal, status, forma_pagamento, valor_total_centavos, motivo, familias(responsavel_nome), ingressos(id, status, tipo, sessao_id, valor_centavos, sessoes(nome), assentos(numero, rotulo_fila, setores(nome))), pedido_itens(quantidade, produtos(nome))")
        .eq("id", pedidoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { mapa } = useMapaSessao(troca?.sessao);

  if (q.isLoading) return <EsqueletoLista linhas={3} />;
  const p = q.data;
  if (!p) return null;
  const ativos = (p.ingressos ?? []).filter((i) => i.status === "ativo");
  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ["bilheteria-pedido", pedidoId] });
    void queryClient.invalidateQueries({ queryKey: ["bilheteria-pedidos"] });
  };

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Pedido {p.codigo}</h2>
        <Button variant="outline" className="min-h-11" onClick={fechar}>
          Fechar
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {p.familias?.responsavel_nome ?? "Avulso"}. {FORMA_PRESENCIAL[p.forma_pagamento ?? ""] ?? p.forma_pagamento}, {dinheiro(p.valor_total_centavos)}
      </p>
      {p.status === "pago_sem_lugar" ? <SeloStatus tom="aviso">Pago sem lugar</SeloStatus> : null}
      <ul className="numeros mt-3 divide-y divide-border text-sm">
        {ativos.map((i) => (
          <li key={i.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-foreground">
              {i.sessoes?.nome}, {i.assentos?.setores?.nome}, poltrona {i.assentos?.numero}
            </span>
            {p.canal === "presencial" || p.canal === "cortesia" ? (
              <Button variant="outline" className="min-h-11" onClick={() => setTroca({ ingresso: i.id, sessao: i.sessao_id, numero: i.assentos?.numero ?? 0 })}>
                Trocar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {(p.pedido_itens ?? []).length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Adicionais: {(p.pedido_itens ?? []).map((x) => `${x.quantidade} ${x.produtos?.nome}`).join(", ")}</p>
      ) : null}
      {p.motivo ? <p className="mt-2 text-sm text-muted-foreground">Histórico: {p.motivo}</p> : null}
      {(p.canal === "presencial" || p.canal === "cortesia") && p.status === "pago" ? (
        <Button variant="destructive" className="mt-4 min-h-11" onClick={() => setCancelando(true)}>
          Cancelar venda
        </Button>
      ) : null}

      <Dialog open={cancelando} onOpenChange={setCancelando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pedido {p.codigo}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground">
            Serão perdidos {ativos.length} ingressos (poltronas {ativos.map((i) => i.assentos?.numero).join(", ")})
            {(p.pedido_itens ?? []).length ? " e os adicionais" : ""}. Os lugares voltam a ficar livres. Devolva {dinheiro(p.valor_total_centavos)} pela mesma forma.
          </p>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" className="text-[16px]" aria-label="Motivo" />
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={!motivo.trim() || enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await cancelar({ data: { pedido: p.id, motivo } });
                toast.success("Venda cancelada.");
                setCancelando(false);
                recarregar();
              } catch (e) {
                toast.error(mensagemDeErro(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Confirmar cancelamento
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(troca)} onOpenChange={(a) => (!a ? (setTroca(null), setNovo(null)) : undefined)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trocar a poltrona {troca?.numero}</DialogTitle>
          </DialogHeader>
          {mapa ? (
            <MapaPoltronas mapa={mapa} escolhidos={new Set(novo ? [novo] : [])} onEscolher={(n) => setNovo(n)} semProscenio />
          ) : (
            <EsqueletoLista linhas={3} />
          )}
          <Button
            className="min-h-11"
            disabled={!novo || enviando}
            onClick={async () => {
              if (!troca || !novo) return;
              setEnviando(true);
              try {
                const r = await trocar({ data: { ingresso: troca.ingresso, novoNumero: novo } });
                const dif = Number(r["diferenca_centavos"] ?? 0);
                toast.success(dif === 0 ? "Troca feita." : dif > 0 ? `Troca feita. Cobrar ${dinheiro(dif)}.` : `Troca feita. Devolver ${dinheiro(-dif)}.`);
                setTroca(null);
                setNovo(null);
                recarregar();
              } catch (e) {
                toast.error(mensagemDeErro(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Trocar para {novo ?? "..."}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
