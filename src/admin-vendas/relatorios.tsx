// Relatórios do admin: entrega dos adicionais e resumo de vendas.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { supabase } from "@/integrations/supabase/client";
import { dinheiro, mensagemDeErro } from "@/lib/formato";
import { useMapaSessao } from "@/vendas/mapa-sessao";

function baixarCsv(nome: string, linhas: Array<Array<string | number>>) {
  const csv = linhas
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function RelatorioEntrega({ eventoId }: { eventoId: string }) {
  const [sessao, setSessao] = useState("");
  const sessoes = useQuery({
    queryKey: ["rel-sessoes", eventoId],
    queryFn: async () =>
      (await supabase.from("sessoes").select("id, nome").eq("evento_id", eventoId).order("ordem"))
        .data ?? [],
  });
  const q = useQuery({
    queryKey: ["rel-entrega", eventoId, sessao],
    queryFn: async () => {
      let c = supabase
        .from("pedido_itens")
        .select(
          "quantidade, sessao_entrega_id, produtos(nome), pedidos!inner(codigo, status, evento_id, familias(responsavel_nome))",
        )
        .eq("pedidos.evento_id", eventoId)
        .in("pedidos.status", ["pago", "pago_sem_lugar"])
        .limit(3000);
      if (sessao) c = c.eq("sessao_entrega_id", sessao);
      const { data, error } = await c;
      if (error) throw error;
      return data ?? [];
    },
  });
  const nomeSessao = (id: string | null) =>
    sessoes.data?.find((s) => s.id === id)?.nome ?? "Sem sessão";
  const linhas = (q.data ?? []).map(
    (i) =>
      [
        nomeSessao(i.sessao_entrega_id),
        i.produtos?.nome ?? "",
        i.quantidade,
        i.pedidos?.codigo ?? "",
        i.pedidos?.familias?.responsavel_nome ?? "Avulso",
      ] as const,
  );

  return (
    <section>
      <style>{`@media print { body * { visibility: hidden; } .rel-entrega, .rel-entrega * { visibility: visible; } .rel-entrega { position: absolute; inset: 0; } .nao-imprimir { display: none !important; } }`}</style>
      <div className="rel-entrega">
        <h2 className="text-lg font-semibold text-foreground">Relatório de entrega</h2>
        <div className="nao-imprimir mt-2 flex flex-wrap gap-2">
          <select
            aria-label="Sessão de entrega"
            className="min-h-11 rounded-md border border-input bg-background px-3 text-[16px]"
            value={sessao}
            onChange={(e) => setSessao(e.target.value)}
          >
            <option value="">Todas as sessões</option>
            {(sessoes.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
          <Button variant="outline" className="min-h-11" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() =>
              baixarCsv("entrega.csv", [
                ["Sessão", "Produto", "Quantidade", "Pedido", "Família"],
                ...linhas.map((l) => [...l]),
              ])
            }
          >
            Exportar planilha
          </Button>
        </div>
        {q.isLoading ? (
          <EsqueletoLista linhas={3} />
        ) : q.error ? (
          <EstadoErro mensagem={mensagemDeErro(q.error)} />
        ) : linhas.length === 0 ? (
          <EstadoVazio titulo="Nenhum adicional vendido" />
        ) : (
          <table className="numeros mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2">Sessão</th>
                <th className="py-2">Produto</th>
                <th className="py-2">Qtd.</th>
                <th className="py-2">Pedido</th>
                <th className="py-2">Família</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-b border-border text-foreground">
                  {l.map((c, j) => (
                    <td key={j} className="py-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Ocupacao({ sessaoId, nome }: { sessaoId: string; nome: string }) {
  const { mapa } = useMapaSessao(sessaoId);
  if (!mapa) return null;
  const total = mapa.assentos.filter((a) => a.estado !== "bloqueado").length;
  const vendidos = mapa.assentos.filter(
    (a) => (a.estado as string) === "vendido" || a.estado === "ocupado",
  ).length;
  const reservados = mapa.assentos.filter((a) => a.estado === "reservado").length;
  return (
    <li>
      {nome}: {vendidos} de {total} vendidos, {reservados} reservados agora,{" "}
      {mapa.meias_disponiveis} meias ainda disponíveis
    </li>
  );
}

export function ResumoVendas({ eventoId }: { eventoId: string }) {
  const q = useQuery({
    queryKey: ["resumo-vendas", eventoId],
    queryFn: async () => {
      const [ings, sess] = await Promise.all([
        supabase
          .from("ingressos")
          .select(
            "tipo, valor_centavos, sessao_id, criado_em, assentos(setores(nome)), pedidos!inner(canal, evento_id)",
          )
          .eq("status", "ativo")
          .eq("pedidos.evento_id", eventoId)
          .limit(5000),
        supabase.from("sessoes").select("id, nome").eq("evento_id", eventoId).order("ordem"),
      ]);
      if (ings.error) throw ings.error;
      return { ingressos: ings.data ?? [], sessoes: sess.data ?? [] };
    },
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <EsqueletoLista linhas={3} />;
  if (q.error) return <EstadoErro mensagem={mensagemDeErro(q.error)} />;
  const { ingressos, sessoes } = q.data!;
  const agrupar = (chave: (i: (typeof ingressos)[number]) => string) => {
    const m = new Map<string, { n: number; v: number }>();
    for (const i of ingressos) {
      const k = chave(i);
      const a = m.get(k) ?? { n: 0, v: 0 };
      a.n++;
      a.v += i.valor_centavos;
      m.set(k, a);
    }
    return [...m.entries()].sort();
  };
  const CANAL: Record<string, string> = {
    presencial: "Recepção",
    online: "Famílias online",
    publico: "Público",
    cortesia: "Cortesia",
  };
  const blocos = [
    {
      titulo: "Por canal",
      dados: agrupar((i) => CANAL[i.pedidos?.canal ?? ""] ?? i.pedidos?.canal ?? ""),
    },
    { titulo: "Por setor", dados: agrupar((i) => i.assentos?.setores?.nome ?? "") },
    {
      titulo: "Por dia de venda",
      dados: agrupar((i) =>
        new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem" }).format(
          new Date(i.criado_em),
        ),
      ),
    },
    {
      titulo: "Meias vendidas por sessão",
      dados: agrupar((i) =>
        i.tipo === "meia" ? (sessoes.find((s) => s.id === i.sessao_id)?.nome ?? "") : "",
      ).filter(([k]) => k),
    },
  ];
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Vendas</h2>
      <ul className="numeros space-y-1 text-sm text-foreground">
        {sessoes.map((s) => (
          <Ocupacao key={s.id} sessaoId={s.id} nome={s.nome} />
        ))}
      </ul>
      <div className="grid gap-6 sm:grid-cols-2">
        {blocos.map((b) => (
          <div key={b.titulo}>
            <h3 className="text-sm font-medium text-muted-foreground">{b.titulo}</h3>
            {b.dados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada ainda.</p>
            ) : (
              <table className="numeros mt-1 w-full text-sm">
                <tbody>
                  {b.dados.map(([k, v]) => (
                    <tr key={k} className="border-b border-border text-foreground">
                      <td className="py-1">{k}</td>
                      <td className="py-1 text-right">{v.n}</td>
                      <td className="py-1 text-right">{dinheiro(v.v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
