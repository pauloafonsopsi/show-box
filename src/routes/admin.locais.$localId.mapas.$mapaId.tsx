import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Cabecalho, EsqueletoLista, EstadoErro } from "@/design/coxia";
import { deMapaCelulas, paraSalvarMapa, type Grade } from "@/design/grade";
import { GradeDePoltronas, type CelulaGrade } from "@/design/palco";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/formato";

const EditorDeGrade = lazy(() => import("@/design/editor-de-grade").then((m) => ({ default: m.EditorDeGrade })));

export const Route = createFileRoute("/admin/locais/$localId/mapas/$mapaId")({
  head: () => ({ meta: [{ title: "Mapa de lugares | Bilheteria" }] }),
  component: TelaMapa,
});

function TelaMapa() {
  const { localId, mapaId } = Route.useParams();
  const qc = useQueryClient();
  const celular = useIsMobile();

  const q = useQuery({
    queryKey: ["mapa", mapaId],
    queryFn: async () => {
      const [m, s, c, uso] = await Promise.all([
        supabase.from("mapas").select("id, nome, colunas, filas, status, locais(nome)").eq("id", mapaId).eq("local_id", localId).single(),
        supabase.from("setores").select("id, nome, cor, ordem").eq("mapa_id", mapaId).order("ordem"),
        supabase
          .from("mapa_celulas")
          .select("linha, coluna, tipo, rotulo_fila, numero, setor_id, acessivel, bloqueado_padrao")
          .eq("mapa_id", mapaId)
          .limit(5000),
        supabase.from("sessoes").select("id", { count: "exact", head: true }).eq("mapa_id", mapaId),
      ]);
      for (const r of [m, s, c]) if (r.error) throw r.error;
      if (uso.error) throw uso.error;
      return {
        mapa: m.data!,
        setores: s.data!,
        grade: deMapaCelulas(m.data!.colunas, m.data!.filas, c.data!),
        emUso: uso.count ?? 0,
      };
    },
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["mapa", mapaId] });

  const salvarSetor = useMutation({
    mutationFn: async (v: { id?: string | undefined; nome: string; cor: string; ordem: number }) => {
      const { error } = v.id
        ? await supabase.from("setores").update({ nome: v.nome, cor: v.cor, ordem: v.ordem }).eq("id", v.id)
        : await supabase.from("setores").insert({ mapa_id: mapaId, nome: v.nome, cor: v.cor, ordem: v.ordem });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setor salvo.");
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const status = useMutation({
    mutationFn: async (pronto: boolean) => {
      const { error } = await supabase.from("mapas").update({ status: pronto ? "pronto" : "rascunho" }).eq("id", mapaId);
      if (error) throw error;
      return pronto;
    },
    onSuccess: (p) => {
      toast.success(p ? "Mapa pronto para usar em sessões." : "Mapa voltou para rascunho.");
      invalidar();
      qc.invalidateQueries({ queryKey: ["locais"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  async function salvarMapa(grade: Grade) {
    const { data, error } = await supabase.rpc("salvar_mapa", { p_mapa: mapaId, ...paraSalvarMapa(grade) });
    if (error) {
      toast.error(mensagemDeErro(error));
      throw error;
    }
    const r = data as { assentos: number; por_setor: Record<string, number> | null };
    const partes = Object.entries(r.por_setor ?? {}).map(([k, n]) => {
      const nome = q.data?.setores.find((s) => s.id === k)?.nome ?? k;
      return `${nome}: ${n}`;
    });
    toast.success(`Mapa salvo com ${r.assentos} lugares.${partes.length ? ` ${partes.join(", ")}.` : ""}`);
    invalidar();
  }

  const celulasVisao = useMemo<CelulaGrade[]>(() => {
    if (!q.data) return [];
    const cores = new Map(q.data.setores.map((s) => [s.id, s]));
    return q.data.grade.celulas.map((c) => ({
      linha: c.linha,
      coluna: c.coluna,
      tipo: c.tipo,
      numero: c.numero,
      rotuloFila: c.rotuloFila,
      estado: c.bloqueadoPadrao ? ("bloqueada" as const) : ("livre" as const),
      setor: c.setorId ? (cores.get(c.setorId)?.nome ?? null) : null,
      corSetor: c.setorId ? (cores.get(c.setorId)?.cor ?? null) : null,
      acessivel: c.acessivel,
    }));
  }, [q.data]);

  if (q.isPending) return <EsqueletoLista linhas={2} altura="h-64" />;
  if (q.isError) return <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />;
  const { mapa, setores, grade, emUso } = q.data;

  return (
    <>
      <Cabecalho
        titulo={mapa.nome}
        trilha={[
          { rotulo: "Painel", to: "/admin" },
          { rotulo: "Locais e mapas", to: "/admin/locais" },
          { rotulo: mapa.locais?.nome ?? "Local", to: "/admin/locais" },
        ]}
        acao={
          <div className="flex min-h-11 items-center gap-3">
            <Switch
              id="pronto"
              checked={mapa.status === "pronto"}
              disabled={status.isPending}
              onCheckedChange={(v) => status.mutate(v)}
            />
            <Label htmlFor="pronto">Mapa pronto para usar em sessões</Label>
          </div>
        }
      />

      {celular ? (
        <div className="space-y-3">
          <p className="text-foreground">Edite o mapa num computador.</p>
          <div className="overflow-x-auto rounded-lg border border-border p-2">
            <GradeDePoltronas colunas={grade.colunas} filas={grade.filas} celulas={celulasVisao} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <aside className="space-y-3">
            <h2 className="font-semibold text-foreground">Setores</h2>
            {[...setores, null].map((s) => (
              <form
                key={s?.id ?? "novo"}
                className="space-y-2 rounded-lg border border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  salvarSetor.mutate({
                    id: s?.id,
                    nome: String(fd.get("nome")).trim(),
                    cor: String(fd.get("cor")),
                    ordem: Number(fd.get("ordem")),
                  });
                  if (!s) e.currentTarget.reset();
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor={`st-n-${s?.id ?? "n"}`}>{s ? "Nome" : "Novo setor"}</Label>
                  <Input id={`st-n-${s?.id ?? "n"}`} name="nome" required defaultValue={s?.nome ?? ""} className="min-h-11 text-base md:text-base" />
                </div>
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`st-c-${s?.id ?? "n"}`}>Cor</Label>
                    <input
                      id={`st-c-${s?.id ?? "n"}`}
                      name="cor"
                      type="color"
                      defaultValue={s?.cor ?? "#888888"}
                      className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`st-o-${s?.id ?? "n"}`}>Ordem</Label>
                    <Input
                      id={`st-o-${s?.id ?? "n"}`}
                      name="ordem"
                      type="number"
                      min={0}
                      defaultValue={s?.ordem ?? setores.length + 1}
                      className="numeros min-h-11 text-base md:text-base"
                    />
                  </div>
                </div>
                <Button type="submit" variant={s ? "outline" : "default"} className="min-h-11 w-full" disabled={salvarSetor.isPending}>
                  {s ? "Salvar setor" : (
                    <>
                      <Plus aria-hidden="true" />
                      Criar setor
                    </>
                  )}
                </Button>
              </form>
            ))}
          </aside>
          <Suspense fallback={<EsqueletoLista linhas={1} altura="h-96" />}>
            <EditorDeGrade
              gradeInicial={grade}
              setores={setores}
              onSalvar={salvarMapa}
              emUsoEmSessoes={emUso}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
