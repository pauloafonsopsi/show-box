import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cabecalho, classeCampo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { supabase } from "@/integrations/supabase/client";
import { emailsDeQuem } from "@/lib/equipe.functions";
import { dataHora, mensagemDeErro } from "@/lib/formato";
import { ACAO, TABELA } from "@/lib/rotulos";
import type { Json } from "@/integrations/supabase/types";

const busca = z.object({
  tabela: z.string().optional().catch(undefined),
  de: z.string().optional().catch(undefined),
  ate: z.string().optional().catch(undefined),
  pagina: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/admin/auditoria")({
  validateSearch: (s) => busca.parse(s),
  head: () => ({ meta: [{ title: "Auditoria | Bilheteria" }] }),
  component: Auditoria,
});

const POR_PAGINA = 30;
const IGNORAR = new Set(["atualizado_em", "criado_em"]);

function diferencas(antes: Json | null, depois: Json | null) {
  const a = (antes && typeof antes === "object" && !Array.isArray(antes) ? antes : {}) as Record<string, Json>;
  const d = (depois && typeof depois === "object" && !Array.isArray(depois) ? depois : {}) as Record<string, Json>;
  const campos = new Set([...Object.keys(a), ...Object.keys(d)]);
  return [...campos]
    .filter((k) => !IGNORAR.has(k) && JSON.stringify(a[k]) !== JSON.stringify(d[k]))
    .map((k) => ({ campo: k, antes: a[k], depois: d[k] }));
}

function mostrar(v: Json | undefined) {
  if (v === undefined || v === null) return "vazio";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Auditoria() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const emails = useServerFn(emailsDeQuem);
  const pagina = s.pagina ?? 1;

  const q = useQuery({
    queryKey: ["auditoria", s.tabela, s.de, s.ate, pagina],
    queryFn: async () => {
      let consulta = supabase
        .from("auditoria")
        .select("id, em, quem, acao, tabela, registro_id, antes, depois", { count: "exact" })
        .order("em", { ascending: false })
        .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
      if (s.tabela) consulta = consulta.eq("tabela", s.tabela);
      if (s.de) consulta = consulta.gte("em", `${s.de}T00:00:00-03:00`);
      if (s.ate) consulta = consulta.lte("em", `${s.ate}T23:59:59-03:00`);
      const { data, error, count } = await consulta;
      if (error) throw error;
      const ids = [...new Set(data.map((x) => x.quem).filter(Boolean))] as string[];
      const nomes = ids.length ? await emails({ data: { ids } }) : {};
      return { linhas: data, total: count ?? 0, nomes };
    },
  });

  const filtro = (p: Partial<z.infer<typeof busca>>) =>
    navigate({ search: (a) => ({ ...a, ...p, pagina: undefined }), replace: true });
  const totalPaginas = Math.max(1, Math.ceil((q.data?.total ?? 0) / POR_PAGINA));

  return (
    <>
      <Cabecalho titulo="Auditoria" trilha={[{ rotulo: "Painel", to: "/admin" }]} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="a-tab">Cadastro</Label>
          <select id="a-tab" className={classeCampo} value={s.tabela ?? ""} onChange={(e) => filtro({ tabela: e.target.value || undefined })}>
            <option value="">Todos</option>
            {Object.entries(TABELA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-de">De</Label>
          <Input id="a-de" type="date" className="min-h-11 text-base md:text-base" value={s.de ?? ""} onChange={(e) => filtro({ de: e.target.value || undefined })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-ate">Até</Label>
          <Input id="a-ate" type="date" className="min-h-11 text-base md:text-base" value={s.ate ?? ""} onChange={(e) => filtro({ ate: e.target.value || undefined })} />
        </div>
      </div>

      {q.isPending ? (
        <EsqueletoLista altura="h-20" />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.linhas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma mudança encontrada" texto="Mude os filtros para ver outro período." />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {q.data.linhas.map((l) => {
              const dif = diferencas(l.antes, l.depois);
              return (
                <li key={l.id} className="px-4 py-3">
                  <p className="text-foreground">
                    <span className="font-medium">{l.quem ? (q.data.nomes[l.quem] ?? "Pessoa removida") : "Sistema"}</span>{" "}
                    {(ACAO[l.acao] ?? l.acao).toLowerCase()} em {TABELA[l.tabela] ?? l.tabela}
                  </p>
                  <p className="text-sm text-muted-foreground">{dataHora(l.em)}</p>
                  {l.acao === "update" && dif.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {dif.map((d) => (
                        <li key={d.campo} className="break-words">
                          <span className="font-mono">{d.campo}</span>: {mostrar(d.antes)} para{" "}
                          <span className="font-medium text-foreground">{mostrar(d.depois)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          {totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={pagina <= 1}
                onClick={() => navigate({ search: (a) => ({ ...a, pagina: pagina - 1 }) })}
              >
                Página anterior
              </Button>
              <span className="text-muted-foreground">
                Página {pagina} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={pagina >= totalPaginas}
                onClick={() => navigate({ search: (a) => ({ ...a, pagina: pagina + 1 }) })}
              >
                Próxima página
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
