import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Cabecalho, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { dataHora, mensagemDeErro } from "@/lib/formato";
import { STATUS_EVENTO } from "@/lib/rotulos";

export const Route = createFileRoute("/admin/")({
  component: Painel,
});

async function contarAssentos(sessaoId: string, status: string) {
  const { count, error } = await supabase
    .from("assentos")
    .select("id", { count: "exact", head: true })
    .eq("sessao_id", sessaoId)
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

async function carregarPainel() {
  const { data: eventos, error } = await supabase
    .from("eventos")
    .select("id, nome, status, sessoes(id, nome, data_hora, ordem)")
    .order("criado_em", { ascending: false })
    .limit(20);
  if (error) throw error;

  return Promise.all(
    (eventos ?? []).map(async (ev) => {
      const sessoes = await Promise.all(
        [...(ev.sessoes ?? [])]
          .sort((a, b) => a.ordem - b.ordem)
          .map(async (s) => ({
            ...s,
            livres: await contarAssentos(s.id, "livre"),
            bloqueados: await contarAssentos(s.id, "bloqueado"),
            vendidos: await contarAssentos(s.id, "vendido"),
          })),
      );
      const [fam, bai, env] = await Promise.all([
        supabase
          .from("familias")
          .select("id", { count: "exact", head: true })
          .eq("evento_id", ev.id)
          .eq("ativa", true),
        supabase
          .from("bailarinas")
          .select("id", { count: "exact", head: true })
          .eq("evento_id", ev.id)
          .eq("ativa", true),
        supabase
          .from("familia_links")
          .select("familia_id, familias!inner(evento_id)", { count: "exact", head: true })
          .eq("familias.evento_id", ev.id)
          .not("enviado_em", "is", null),
      ]);
      for (const r of [fam, bai, env]) if (r.error) throw r.error;
      return {
        ...ev,
        sessoes,
        familias: fam.count ?? 0,
        bailarinas: bai.count ?? 0,
        enviados: env.count ?? 0,
      };
    }),
  );
}

function Painel() {
  const q = useQuery({ queryKey: ["painel"], queryFn: carregarPainel });

  return (
    <>
      <Cabecalho titulo="Painel" descricao="Como está cada evento agora." />
      {q.isPending ? (
        <EsqueletoLista linhas={3} altura="h-40" />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum evento ainda"
          texto="Crie o primeiro evento para começar."
          acao={
            <Link
              to="/admin/eventos"
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
            >
              Ir para Eventos
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {q.data.map((ev) => {
            const st = STATUS_EVENTO[ev.status] ?? STATUS_EVENTO["rascunho"]!;
            return (
              <section key={ev.id} className="rounded-lg border border-border p-4 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    <Link
                      to="/admin/eventos/$eventoId/visao-geral"
                      params={{ eventoId: ev.id }}
                      className="underline-offset-4 hover:underline"
                    >
                      {ev.nome}
                    </Link>
                  </h2>
                  <SeloStatus tom={st.tom}>{st.texto}</SeloStatus>
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <div>
                    <dt className="inline">Famílias: </dt>
                    <dd className="numeros inline text-foreground">{ev.familias}</dd>
                  </div>
                  <div>
                    <dt className="inline">Bailarinas: </dt>
                    <dd className="numeros inline text-foreground">{ev.bailarinas}</dd>
                  </div>
                  <div>
                    <dt className="inline">Links enviados: </dt>
                    <dd className="numeros inline text-foreground">
                      {ev.enviados} de {ev.familias}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(
                    [
                      { to: "/bilheteria", rotulo: "Vender na recepção", forte: true },
                      { to: "/bilheteria/retirada", rotulo: "Retirada de ingressos" },
                      { to: "/bilheteria/pedidos", rotulo: "Pedidos" },
                    ] as const
                  ).map((a) => (
                    <Link
                      key={a.to}
                      to={a.to}
                      search={{ evento: ev.id }}
                      className={
                        "forte" in a
                          ? "inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
                          : "inline-flex min-h-11 items-center rounded-md border border-border px-4 text-foreground"
                      }
                    >
                      {a.rotulo}
                    </Link>
                  ))}
                </div>
                {ev.sessoes.length === 0 ? (
                  <p className="mt-4 text-muted-foreground">Este evento ainda não tem sessões.</p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {ev.sessoes.map((s) => (
                      <div key={s.id} className="rounded-md bg-muted/50 p-3">
                        <p className="font-medium text-foreground">{s.nome}</p>
                        {s.data_hora && (
                          <p className="text-sm text-muted-foreground">{dataHora(s.data_hora)}</p>
                        )}
                        <p className="numeros mt-2 text-foreground">
                          {s.livres} livres, {s.bloqueados} bloqueados, {s.vendidos} vendidos
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
