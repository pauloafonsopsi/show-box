import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { EsqueletoLista, EstadoErro } from "@/design/coxia";
import { supabase } from "@/integrations/supabase/client";
import { dinheiro, mensagemDeErro } from "@/lib/formato";
import { semAcento, useEventoAtual, useSaldos, useSessoesEvento, FORMA_PRESENCIAL } from "@/bilheteria/comum";
import { VendaPresencial } from "@/bilheteria/venda-presencial";

export const Route = createFileRoute("/bilheteria/familia/$familiaId")({
  validateSearch: (s) => z.object({ evento: z.string().uuid().optional(), sessao: z.string().uuid().optional() }).parse(s),
  component: FamiliaBilheteria,
});

function FamiliaBilheteria() {
  const { familiaId } = Route.useParams();
  const { sessao } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { evento } = useEventoAtual();
  const sessoes = useSessoesEvento(evento?.id);
  const saldos = useSaldos(evento?.id);

  const q = useQuery({
    queryKey: ["bilheteria-familia", familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, responsavel_nome, whatsapp, bailarinas(id, nome, pacote, ativa, escalacao(sessao_id)), pedidos(id, codigo, status, canal, forma_pagamento, valor_total_centavos, pago_em)")
        .eq("id", familiaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (q.isLoading || !evento) return <EsqueletoLista />;
  if (q.error || !q.data) return <EstadoErro mensagem={q.error ? mensagemDeErro(q.error) : "Família não encontrada."} />;
  const f = q.data;
  const filhas = (f.bailarinas ?? []).filter((b) => b.ativa);
  const saldoPor: Record<string, number> = {};
  for (const s of saldos.data ?? []) if (s.familia_id === f.id) saldoPor[s.sessao_id] = s.saldo;
  const compras = (f.pedidos ?? []).filter((p) => p.status === "pago" || p.status === "pago_sem_lugar");

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Link to="/bilheteria" search={{ evento: evento.id }} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4">
          Voltar à busca
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{f.responsavel_nome}</h1>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Filhas e dias</h2>
          <ul className="mt-1 space-y-1 text-sm text-foreground">
            {filhas.map((b) => (
              <li key={b.id}>
                {b.nome}
                {semAcento(b.pacote ?? "") === "quebra-nozes" ? " (Quebra-Nozes)" : ""}:{" "}
                {(b.escalacao ?? []).map((e) => sessoes.data?.find((s) => s.id === e.sessao_id)?.nome).filter(Boolean).join(", ")}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Saldo</h2>
          <ul className="numeros mt-1 text-sm text-foreground">
            {(sessoes.data ?? []).map((s) => (
              <li key={s.id}>
                {s.nome}: {saldoPor[s.id] ?? 0}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Compras anteriores</h2>
          {compras.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma.</p>
          ) : (
            <ul className="numeros mt-1 space-y-1 text-sm text-foreground">
              {compras.map((p) => (
                <li key={p.id}>
                  {p.codigo}: {dinheiro(p.valor_total_centavos)} ({FORMA_PRESENCIAL[p.forma_pagamento ?? ""] ?? p.forma_pagamento})
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button asChild variant="outline" className="min-h-11 w-full">
          <Link to="/bilheteria/impressao" search={{ evento: evento.id, familia: f.id }}>
            Imprimir ingressos da família
          </Link>
        </Button>
      </aside>
      <section>
        <VendaPresencial
          evento={evento}
          sessaoId={sessao}
          aoMudarSessao={(id) => navigate({ search: (s) => ({ ...s, sessao: id }) })}
          familia={{
            id: f.id,
            responsavel: f.responsavel_nome,
            whatsapp: f.whatsapp,
            saldos: saldoPor,
            temQuebraNozes: filhas.some((b) => semAcento(b.pacote ?? "") === "quebra-nozes"),
          }}
        />
      </section>
    </div>
  );
}
