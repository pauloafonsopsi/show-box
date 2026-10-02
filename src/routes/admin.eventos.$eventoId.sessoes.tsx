import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Campo, classeCampo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { GradeDePoltronas, SeloStatus, type CelulaGrade, type EstadoPoltrona } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { sessoesQuery } from "@/lib/consultas";
import { dataHora, deInputLocal, mensagemDeErro, paraInputLocal } from "@/lib/formato";

const busca = z.object({ sessao: z.string().optional().catch(undefined) });

export const Route = createFileRoute("/admin/eventos/$eventoId/sessoes")({
  validateSearch: (s) => busca.parse(s),
  component: Sessoes,
});

type Sessao = Awaited<ReturnType<ReturnType<typeof sessoesQuery>["queryFn"]>>[number];

function Sessoes() {
  const { eventoId } = Route.useParams();
  const { sessao: sessaoBloqueio } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = useQuery(sessoesQuery(eventoId));
  const [editando, setEditando] = useState<Sessao | "nova" | null>(null);
  const [congelar, setCongelar] = useState<Sessao | null>(null);
  const qc = useQueryClient();

  const congelarM = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("congelar_mapa_da_sessao", { p_sessao: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      toast.success(`Mapa congelado com ${n} lugares. Agora você pode bloquear lugares abaixo.`);
      qc.invalidateQueries({ queryKey: ["sessoes", eventoId] });
      qc.invalidateQueries({ queryKey: ["assentos"] });
      qc.invalidateQueries({ queryKey: ["painel"] });
      setCongelar(null);
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  if (q.isPending) return <EsqueletoLista />;
  if (q.isError) return <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />;

  const sessaoAtual = q.data.find((s) => s.id === sessaoBloqueio) ?? q.data.find((s) => s.mapa_congelado_em);

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Sessões</h2>
          <Button className="min-h-11" onClick={() => setEditando("nova")}>
            <Plus aria-hidden="true" />
            Nova sessão
          </Button>
        </div>
        {q.data.length === 0 ? (
          <EstadoVazio titulo="Nenhuma sessão" texto="Crie a primeira sessão do evento." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {q.data.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <button type="button" className="min-h-11 text-left" onClick={() => setEditando(s)}>
                  <span className="block font-medium text-foreground underline-offset-4 hover:underline">{s.nome}</span>
                  <span className="block text-sm text-muted-foreground">
                    {s.data_hora ? dataHora(s.data_hora) : "Sem data e hora"}
                    {s.abertura_portas ? `, portas às ${dataHora(s.abertura_portas).split(" às ")[1]}` : ""}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Mapa: {s.mapas ? `${s.mapas.nome} (${s.mapas.locais?.nome ?? ""})` : "não escolhido"}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {s.mapa_congelado_em ? (
                    <SeloStatus tom="sucesso">Congelado em {dataHora(s.mapa_congelado_em)}</SeloStatus>
                  ) : (
                    <SeloStatus tom="aviso">Mapa não congelado</SeloStatus>
                  )}
                  {!s.ativa && <SeloStatus tom="neutro">Inativa</SeloStatus>}
                  <Button variant="outline" className="min-h-11" onClick={() => setCongelar(s)}>
                    <Snowflake aria-hidden="true" />
                    Congelar mapa
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold text-foreground">Bloqueios</h2>
        <p className="mb-3 text-muted-foreground">Escolha a sessão, selecione lugares livres e bloqueie com um motivo.</p>
        {q.data.filter((s) => s.mapa_congelado_em).length === 0 ? (
          <EstadoVazio titulo="Nenhuma sessão com mapa congelado" texto="Congele o mapa de uma sessão para bloquear lugares." />
        ) : (
          <>
            <div className="mb-4 max-w-sm space-y-1.5">
              <Label htmlFor="sessao-bloq">Sessão</Label>
              <select
                id="sessao-bloq"
                className={classeCampo}
                value={sessaoAtual?.id ?? ""}
                onChange={(e) => navigate({ search: { sessao: e.target.value }, replace: true })}
              >
                {q.data
                  .filter((s) => s.mapa_congelado_em)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
              </select>
            </div>
            {sessaoAtual?.mapa_id && <Bloqueios sessaoId={sessaoAtual.id} mapaId={sessaoAtual.mapa_id} />}
          </>
        )}
      </section>

      <EditarSessao eventoId={eventoId} sessao={editando} onFechar={() => setEditando(null)} total={q.data.length} />

      <AlertDialog open={congelar !== null} onOpenChange={(o) => !o && setCongelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Congelar o mapa de {congelar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lugares desta sessão serão substituídos pelos do mapa do local, como ele está agora. Bloqueios feitos
              nesta sessão serão perdidos. Se a sessão já tiver vendas, o sistema recusa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={congelarM.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (congelar) congelarM.mutate(congelar.id);
              }}
            >
              {congelarM.isPending ? "Congelando..." : "Congelar mapa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditarSessao({
  eventoId,
  sessao,
  onFechar,
  total,
}: {
  eventoId: string;
  sessao: Sessao | "nova" | null;
  onFechar: () => void;
  total: number;
}) {
  const qc = useQueryClient();
  const nova = sessao === "nova";
  const s = sessao && sessao !== "nova" ? sessao : null;
  const chave = sessao === null ? "fechado" : nova ? "nova" : s!.id;

  const mapas = useQuery({
    queryKey: ["mapas-prontos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapas")
        .select("id, nome, status, locais(nome)")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: sessao !== null,
  });

  const salvar = useMutation({
    mutationFn: async (form: FormData) => {
      const dados = {
        nome: String(form.get("nome")).trim(),
        data_hora: deInputLocal(String(form.get("data_hora"))),
        abertura_portas: deInputLocal(String(form.get("abertura_portas"))),
        mapa_id: String(form.get("mapa_id")) || null,
        ordem: Number(form.get("ordem")),
        ativa: form.get("ativa") === "on",
      };
      const { error } = nova
        ? await supabase.from("sessoes").insert({ ...dados, evento_id: eventoId })
        : await supabase.from("sessoes").update(dados).eq("id", s!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(nova ? "Sessão criada. Congele o mapa para liberar os lugares." : "Sessão salva.");
      qc.invalidateQueries({ queryKey: ["sessoes", eventoId] });
      qc.invalidateQueries({ queryKey: ["setores-evento", eventoId] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!salvar.isPending) salvar.mutate(new FormData(e.currentTarget));
  }

  return (
    <Sheet open={sessao !== null} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{nova ? "Nova sessão" : `Editar ${s?.nome ?? ""}`}</SheetTitle>
        </SheetHeader>
        <form key={chave} onSubmit={enviar} className="space-y-4 px-4 pb-6">
          <Campo id="s-nome" name="nome" rotulo="Nome" required defaultValue={s?.nome ?? ""} />
          <Campo id="s-dh" name="data_hora" rotulo="Data e hora" type="datetime-local" defaultValue={paraInputLocal(s?.data_hora)} />
          <Campo
            id="s-portas"
            name="abertura_portas"
            rotulo="Abertura das portas"
            type="datetime-local"
            defaultValue={paraInputLocal(s?.abertura_portas)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="s-mapa">Mapa usado</Label>
            <select id="s-mapa" name="mapa_id" className={classeCampo} defaultValue={s?.mapa_id ?? ""}>
              <option value="">Escolha o mapa</option>
              {(mapas.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.locais?.nome}){m.status === "rascunho" ? ", rascunho" : ""}
                </option>
              ))}
            </select>
            {s && <p className="text-sm text-muted-foreground">Trocar o mapa só vale depois de congelar de novo.</p>}
          </div>
          <Campo id="s-ordem" name="ordem" rotulo="Ordem" type="number" min={0} defaultValue={s?.ordem ?? total + 1} />
          <div className="flex min-h-11 items-center gap-3">
            <Switch id="s-ativa" name="ativa" defaultChecked={s?.ativa ?? true} />
            <Label htmlFor="s-ativa">Sessão ativa</Label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar sessão"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const ESTADO: Record<string, EstadoPoltrona> = {
  livre: "livre",
  bloqueado: "bloqueada",
  vendido: "ocupada",
  reservado: "outra-pessoa",
};

function lerNumeros(t: string): number[] {
  const out = new Set<number>();
  for (const parte of t.split(/[,;\s]+/)) {
    const m = parte.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i);
  }
  return [...out];
}

function Bloqueios({ sessaoId, mapaId }: { sessaoId: string; mapaId: string }) {
  const qc = useQueryClient();
  const [selecao, setSelecao] = useState<Set<number>>(new Set());
  const [numerosTexto, setNumerosTexto] = useState("");
  const [motivo, setMotivo] = useState("");

  const q = useQuery({
    queryKey: ["assentos", sessaoId],
    queryFn: async () => {
      const [a, m, c, st] = await Promise.all([
        supabase
          .from("assentos")
          .select("numero, linha, coluna, rotulo_fila, status, bloqueio_motivo, acessivel, setor_id")
          .eq("sessao_id", sessaoId)
          .order("numero")
          .limit(5000),
        supabase.from("mapas").select("colunas, filas").eq("id", mapaId).single(),
        supabase.from("mapa_celulas").select("linha, coluna, tipo").eq("mapa_id", mapaId).neq("tipo", "assento"),
        supabase.from("setores").select("id, nome, cor").eq("mapa_id", mapaId).order("ordem"),
      ]);
      for (const r of [a, m, c, st]) if (r.error) throw r.error;
      return { assentos: a.data!, mapa: m.data!, outras: c.data!, setores: st.data! };
    },
  });

  const acao = useMutation({
    mutationFn: async ({ bloquear, numeros }: { bloquear: boolean; numeros: number[] }) => {
      const { data, error } = await supabase.rpc("bloquear_lugares", {
        p_sessao: sessaoId,
        p_numeros: numeros,
        p_bloquear: bloquear,
        ...(bloquear ? { p_motivo: motivo } : {}),
      });
      if (error) throw error;
      return { n: data, bloquear };
    },
    onSuccess: ({ n, bloquear }) => {
      toast.success(
        n === 0
          ? "Nenhum lugar mudou. Confira se os números estão livres (para bloquear) ou bloqueados (para liberar)."
          : `${n} ${n === 1 ? "lugar" : "lugares"} ${bloquear ? "bloqueado" : "liberado"}${n === 1 ? "" : "s"}.`,
      );
      setSelecao(new Set());
      setNumerosTexto("");
      qc.invalidateQueries({ queryKey: ["assentos", sessaoId] });
      qc.invalidateQueries({ queryKey: ["painel"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const celulas = useMemo<CelulaGrade[]>(() => {
    if (!q.data) return [];
    const cores = new Map(q.data.setores.map((s) => [s.id, s]));
    return [
      ...q.data.outras.map((c) => ({ linha: c.linha, coluna: c.coluna, tipo: c.tipo as "corredor" | "palco" })),
      ...q.data.assentos.map((a) => ({
        linha: a.linha,
        coluna: a.coluna,
        tipo: "assento" as const,
        numero: a.numero,
        rotuloFila: a.rotulo_fila,
        estado: selecao.has(a.numero) ? ("escolhida" as const) : (ESTADO[a.status] ?? "livre"),
        setor: cores.get(a.setor_id)?.nome ?? null,
        corSetor: cores.get(a.setor_id)?.cor ?? null,
        acessivel: a.acessivel,
      })),
    ];
  }, [q.data, selecao]);

  if (q.isPending) return <EsqueletoLista linhas={1} altura="h-64" />;
  if (q.isError) return <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />;

  const { assentos, setores, mapa } = q.data;
  const porEstado = (st: string) => assentos.filter((a) => a.status === st).length;
  const bloqueados = assentos.filter((a) => a.status === "bloqueado");
  const numerosAlvo = [...new Set([...selecao, ...lerNumeros(numerosTexto)])].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border p-3">
        <GradeDePoltronas
          colunas={mapa.colunas}
          filas={mapa.filas}
          celulas={celulas}
          mostrarRotulosDeFila
          onEscolher={(n) =>
            setSelecao((s) => {
              const novo = new Set(s);
              if (novo.has(n)) novo.delete(n);
              else novo.add(n);
              return novo;
            })
          }
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="numeros">Livres: {porEstado("livre")}</span>
        <span className="numeros">Bloqueados: {porEstado("bloqueado")}</span>
        <span className="numeros">Reservados: {porEstado("reservado")}</span>
        <span className="numeros">Vendidos: {porEstado("vendido")}</span>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {setores.map((s) => (
          <li key={s.id} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-1 w-5 rounded-sm" style={{ backgroundColor: s.cor }} />
            <span>
              {s.nome}: <span className="numeros">{assentos.filter((a) => a.setor_id === s.id).length}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
        <Campo
          id="numeros"
          rotulo="Números dos lugares"
          ajuda="Toque nos lugares livres no mapa ou digite, por exemplo: 1, 2, 10-15."
          value={numerosTexto}
          onChange={(e) => setNumerosTexto(e.target.value)}
          inputMode="numeric"
        />
        <Campo id="motivo" rotulo="Motivo do bloqueio" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <span className="text-muted-foreground">
            {numerosAlvo.length === 0 ? "Nenhum lugar escolhido." : `Lugares: ${numerosAlvo.join(", ")}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button
            className="min-h-11"
            disabled={acao.isPending || numerosAlvo.length === 0}
            onClick={() => {
              if (!motivo.trim()) {
                toast.error("Escreva o motivo do bloqueio.");
                return;
              }
              acao.mutate({ bloquear: true, numeros: numerosAlvo });
            }}
          >
            {acao.isPending ? "Salvando..." : "Bloquear lugares"}
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={acao.isPending || numerosAlvo.length === 0}
            onClick={() => acao.mutate({ bloquear: false, numeros: numerosAlvo })}
          >
            Liberar lugares
          </Button>
          {selecao.size > 0 && (
            <Button variant="ghost" className="min-h-11" onClick={() => setSelecao(new Set())}>
              Limpar seleção
            </Button>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-foreground">Lugares bloqueados ({bloqueados.length})</h3>
        {bloqueados.length === 0 ? (
          <p className="text-muted-foreground">Nenhum lugar bloqueado.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {bloqueados.map((a) => (
              <li key={a.numero} className="flex items-center justify-between gap-2 px-4 py-2">
                <span>
                  <span className="numeros font-medium">Lugar {a.numero}</span>
                  <span className="text-muted-foreground">, fila {a.rotulo_fila}: {a.bloqueio_motivo}</span>
                </span>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={acao.isPending}
                  onClick={() => acao.mutate({ bloquear: false, numeros: [a.numero] })}
                >
                  Liberar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
