import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ChangeEvent } from "react";
import { FileSpreadsheet, UserPlus } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Campo, classeCampo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { sessoesQuery } from "@/lib/consultas";
import { mensagemDeErro, primeiroNome, whatsappExibir } from "@/lib/formato";
import {
  linhasParaImportar,
  lerPlanilha,
  CAMPOS,
  camposFaltando,
  normalizar,
  sessaoPelaData,
  type PlanilhaLida,
} from "@/lib/planilha";
import { useRascunho } from "@/lib/rascunho";

const busca = z.object({
  q: z.string().optional().catch(undefined),
  sessao: z.string().optional().catch(undefined),
  pacote: z.string().optional().catch(undefined),
  enviado: z.enum(["sim", "nao"]).optional().catch(undefined),
  pagina: z.number().int().min(1).optional().catch(undefined),
  bailarina: z.string().optional().catch(undefined),
  familia: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/admin/eventos/$eventoId/elenco")({
  validateSearch: (s) => busca.parse(s),
  component: Elenco,
});

const POR_PAGINA = 20;

function Elenco() {
  const { eventoId } = Route.useParams();
  return (
    <div className="space-y-10">
      <Importar eventoId={eventoId} />
      <Familias eventoId={eventoId} />
    </div>
  );
}

/* ----------------------------- Importação ----------------------------- */

type Resumo = {
  bailarinas: number;
  familias: number;
  quebra_nozes: number;
  por_sessao: Record<string, number>;
  vermelhos: { linha: number | null; motivo: string }[];
  amarelos: { linha: number | null; motivo: string }[];
  pode_gravar: boolean;
};

function Importar({ eventoId }: { eventoId: string }) {
  const qc = useQueryClient();
  const sessoes = useQuery(sessoesQuery(eventoId));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null);
  const [ligacao, setLigacao] = useState<Record<number, string>>({});
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [lendo, setLendo] = useState(false);

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setLendo(true);
    setResumo(null);
    try {
      const p = await lerPlanilha(f);
      setArquivo(f);
      setPlanilha(p);
      const lista = sessoes.data ?? [];
      setLigacao(
        Object.fromEntries(p.dancas.map((d) => [d.indice, sessaoPelaData(d.titulo, lista)])),
      );
    } catch (err) {
      setPlanilha(null);
      toast.error(mensagemDeErro(err));
    } finally {
      setLendo(false);
    }
  }

  const importar = useMutation({
    mutationFn: async (gravar: boolean) => {
      const linhas = linhasParaImportar(planilha!, ligacao);
      const { data, error } = await supabase.rpc("importar_planilha", {
        p_evento: eventoId,
        p_linhas: linhas,
        p_gravar: gravar,
        ...(arquivo ? { p_arquivo: arquivo.name } : {}),
      });
      if (error) throw error;
      return { resumo: data as unknown as Resumo, gravar };
    },
    onSuccess: ({ resumo: r, gravar }) => {
      setResumo(r);
      if (gravar) {
        toast.success(`Planilha gravada: ${r.bailarinas} bailarinas em ${r.familias} famílias.`);
        setPlanilha(null);
        setArquivo(null);
        setResumo(null);
        qc.invalidateQueries({ queryKey: ["familias", eventoId] });
        qc.invalidateQueries({ queryKey: ["envio", eventoId] });
        qc.invalidateQueries({ queryKey: ["painel"] });
      }
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const faltaLigar =
    !planilha ||
    planilha.dancas.length === 0 ||
    planilha.dancas.some((d) => !ligacao[d.indice]) ||
    camposFaltando(planilha).length > 0;

  function escolherColuna(campo: (typeof CAMPOS)[number]["id"], indice: number) {
    setPlanilha((p) => (p ? { ...p, colunas: { ...p.colunas, [campo]: indice } } : p));
    setResumo(null);
  }

  function alternarDanca(indice: number) {
    if (!planilha) return;
    const tem = planilha.dancas.some((d) => d.indice === indice);
    const dancas = tem
      ? planilha.dancas.filter((d) => d.indice !== indice)
      : [...planilha.dancas, { indice, titulo: planilha.cabecalhos[indice] ?? "" }].sort(
          (a, b) => a.indice - b.indice,
        );
    setPlanilha({ ...planilha, dancas });
    setResumo(null);
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-foreground">Importar planilha</h2>
      <p className="mb-3 text-muted-foreground">
        Arquivo .xlsx ou .csv. O sistema reconhece nomes parecidos (Aluna, Mãe, Celular...) e você
        confere qual coluna é qual antes de gravar.
      </p>
      <div className="rounded-lg border border-border p-4">
        <Label
          htmlFor="arquivo"
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-4 font-medium hover:bg-muted"
        >
          <FileSpreadsheet aria-hidden="true" className="size-4" />
          {lendo ? "Lendo planilha..." : arquivo ? "Escolher outra planilha" : "Escolher planilha"}
        </Label>
        <input
          id="arquivo"
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          onChange={escolher}
          disabled={lendo}
        />

        {planilha && (
          <div className="mt-4 space-y-4">
            <p className="text-foreground">
              {arquivo?.name}, aba "{planilha.aba}", {planilha.linhas.length} linhas depois do
              cabeçalho.
            </p>
            <div>
              <p className="mb-1 font-medium text-foreground">Qual coluna é qual?</p>
              <p className="mb-2 text-sm text-muted-foreground">
                Já deixamos sugerido. Ajuste se alguma estiver errada.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {CAMPOS.map((c) => {
                  const v = planilha.colunas[c.id];
                  return (
                    <div key={c.id} className="space-y-1.5">
                      <Label htmlFor={`campo-${c.id}`}>{c.nome}</Label>
                      <select
                        id={`campo-${c.id}`}
                        className={classeCampo}
                        aria-invalid={v < 0}
                        value={v}
                        onChange={(e) => escolherColuna(c.id, Number(e.target.value))}
                      >
                        <option value={-1}>Escolha a coluna</option>
                        {planilha.cabecalhos.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </select>
                      {v >= 0 ? (
                        <p className="truncate text-sm text-muted-foreground">
                          Ex.: {String(planilha.linhas[0]?.celulas[v] ?? "vazio")}
                        </p>
                      ) : (
                        <p className="text-sm text-destructive">Não encontrei esta coluna.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-1 font-medium text-foreground">Colunas que marcam os dias de dança</p>
              <p className="mb-2 text-sm text-muted-foreground">
                Na linha da bailarina, vale S, Sim, X ou 1.
              </p>
              <div className="flex flex-wrap gap-2">
                {planilha.cabecalhos.map((h, i) => {
                  if (Object.values(planilha.colunas).includes(i)) return null;
                  const ativo = planilha.dancas.some((d) => d.indice === i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => alternarDanca(i)}
                      className={
                        ativo
                          ? "min-h-11 rounded-md border border-primary bg-primary px-3 text-sm text-primary-foreground"
                          : "min-h-11 rounded-md border border-input px-3 text-sm text-muted-foreground"
                      }
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium text-foreground">Cada coluna de dança é qual sessão?</p>
              {planilha.dancas.length === 0 && (
                <p className="text-sm text-destructive">Marque acima pelo menos uma coluna de dança.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {planilha.dancas.map((d) => (
                  <div key={d.indice} className="space-y-1.5">
                    <Label htmlFor={`danca-${d.indice}`}>{d.titulo}</Label>
                    <select
                      id={`danca-${d.indice}`}
                      className={classeCampo}
                      value={ligacao[d.indice] ?? ""}
                      onChange={(e) => {
                        setLigacao((l) => ({ ...l, [d.indice]: e.target.value }));
                        setResumo(null);
                      }}
                    >
                      <option value="">Escolha a sessão</option>
                      {(sessoes.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                disabled={faltaLigar || importar.isPending}
                onClick={() => importar.mutate(false)}
              >
                {importar.isPending && !resumo ? "Conferindo..." : "Ver prévia"}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setPlanilha(null);
                  setArquivo(null);
                  setResumo(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {resumo && (
          <div className="mt-6 space-y-4 border-t border-border pt-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Total rotulo="Bailarinas" valor={resumo.bailarinas} />
              <Total rotulo="Famílias" valor={resumo.familias} />
              <Total rotulo="Quebra-Nozes" valor={resumo.quebra_nozes} />
              {Object.entries(resumo.por_sessao).map(([s, n]) => (
                <Total key={s} rotulo={s} valor={n} />
              ))}
            </dl>
            <ListaAvisos
              titulo="Precisa corrigir antes de gravar"
              tom="erro"
              itens={resumo.vermelhos}
            />
            <ListaAvisos titulo="Vale conferir" tom="aviso" itens={resumo.amarelos} />
            <Button
              className="min-h-11"
              disabled={!resumo.pode_gravar || importar.isPending}
              onClick={() => importar.mutate(true)}
            >
              {importar.isPending ? "Gravando..." : "Gravar planilha"}
            </Button>
            {!resumo.pode_gravar && (
              <p className="text-muted-foreground">
                Corrija as linhas em vermelho na planilha e escolha o arquivo de novo.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Total({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="numeros text-xl font-semibold text-foreground">{valor}</dd>
    </div>
  );
}

function ListaAvisos({
  titulo,
  tom,
  itens,
}: {
  titulo: string;
  tom: "erro" | "aviso";
  itens: { linha: number | null; motivo: string }[];
}) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
        <SeloStatus tom={tom}>{itens.length}</SeloStatus>
        {titulo}
      </p>
      <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
        {itens.map((i, k) => (
          <li key={k} className="px-3 py-2">
            {i.linha ? <span className="numeros font-medium">Linha {i.linha}: </span> : null}
            {i.motivo}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ Famílias ------------------------------ */

type Bailarina = {
  id: string;
  nome: string;
  turma: string | null;
  pacote: string | null;
  ativa: boolean;
  escalacao: { sessao_id: string }[];
};
type Familia = {
  id: string;
  responsavel_nome: string;
  whatsapp: string;
  ativa: boolean;
  bailarinas: Bailarina[];
  familia_links: { enviado_em: string | null } | null;
};

function Familias({ eventoId }: { eventoId: string }) {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const sessoes = useQuery(sessoesQuery(eventoId));
  const [novoLink, setNovoLink] = useState<Familia | null>(null);
  const [nova, setNova] = useState<{ familia: Familia | null } | null>(null);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["familias", eventoId],
    queryFn: async () => {
      const [f, sal] = await Promise.all([
        supabase
          .from("familias")
          .select(
            "id, responsavel_nome, whatsapp, ativa, bailarinas(id, nome, turma, pacote, ativa, escalacao(sessao_id)), familia_links(enviado_em)",
          )
          .eq("evento_id", eventoId)
          .order("responsavel_nome")
          .limit(2000),
        supabase.rpc("saldos_do_evento", { p_evento: eventoId }),
      ]);
      if (f.error) throw f.error;
      if (sal.error) throw sal.error;
      return { familias: f.data as unknown as Familia[], saldos: sal.data };
    },
  });

  const gerar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("gerar_link_familia", { p_familia: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Novo link gerado. Envie de novo pela aba Envio de links.");
      setNovoLink(null);
      qc.invalidateQueries({ queryKey: ["familias", eventoId] });
      qc.invalidateQueries({ queryKey: ["envio", eventoId] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const pacotes = useMemo(() => {
    const set = new Set<string>();
    q.data?.familias.forEach((f) => f.bailarinas.forEach((b) => b.pacote && set.add(b.pacote)));
    return [...set].sort();
  }, [q.data]);

  const filtradas = useMemo(() => {
    if (!q.data) return [];
    const termo = normalizar(s.q);
    return q.data.familias.filter((f) => {
      if (
        termo &&
        !normalizar(f.responsavel_nome).includes(termo) &&
        !f.bailarinas.some((b) => normalizar(b.nome).includes(termo))
      )
        return false;
      if (s.sessao && !f.bailarinas.some((b) => b.escalacao.some((e) => e.sessao_id === s.sessao)))
        return false;
      if (s.pacote && !f.bailarinas.some((b) => b.pacote === s.pacote)) return false;
      if (s.enviado === "sim" && !f.familia_links?.enviado_em) return false;
      if (s.enviado === "nao" && f.familia_links?.enviado_em) return false;
      return true;
    });
  }, [q.data, s.q, s.sessao, s.pacote, s.enviado]);

  const pagina = s.pagina ?? 1;
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const nomeSessao = (id: string) => sessoes.data?.find((x) => x.id === id)?.nome ?? "";

  const filtro = (patch: Partial<z.infer<typeof busca>>) =>
    navigate({ search: (a) => ({ ...a, ...patch, pagina: undefined }), replace: true });

  const bailarinaAberta =
    q.data?.familias.flatMap((f) => f.bailarinas).find((b) => b.id === s.bailarina) ?? null;
  const familiaAberta = q.data?.familias.find((f) => f.id === s.familia) ?? null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Famílias</h2>
        <Button className="min-h-11" onClick={() => setNova({ familia: null })}>
          <UserPlus aria-hidden="true" />
          Adicionar bailarina
        </Button>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="busca">Buscar</Label>
          <Input
            id="busca"
            placeholder="Bailarina ou responsável"
            className="min-h-11 text-base md:text-base"
            value={s.q ?? ""}
            onChange={(e) => filtro({ q: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-sessao">Sessão</Label>
          <select
            id="f-sessao"
            className={classeCampo}
            value={s.sessao ?? ""}
            onChange={(e) => filtro({ sessao: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {(sessoes.data ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-pacote">Pacote</Label>
          <select
            id="f-pacote"
            className={classeCampo}
            value={s.pacote ?? ""}
            onChange={(e) => filtro({ pacote: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {pacotes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-env">Link</Label>
          <select
            id="f-env"
            className={classeCampo}
            value={s.enviado ?? ""}
            onChange={(e) =>
              filtro({ enviado: (e.target.value || undefined) as "sim" | "nao" | undefined })
            }
          >
            <option value="">Todos</option>
            <option value="sim">Enviado</option>
            <option value="nao">Não enviado</option>
          </select>
        </div>
      </div>

      {q.isPending ? (
        <EsqueletoLista altura="h-24" />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : filtradas.length === 0 ? (
        <EstadoVazio
          titulo={
            q.data.familias.length === 0
              ? "Nenhuma família cadastrada"
              : "Nenhuma família com esses filtros"
          }
          {...(q.data.familias.length === 0 ? { texto: "Importe a planilha acima." } : {})}
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{filtradas.length} famílias</p>
          <ul className="space-y-3">
            {visiveis.map((f) => (
              <li key={f.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <button
                      type="button"
                      className="min-h-11 text-left font-semibold text-foreground underline-offset-4 hover:underline"
                      onClick={() => navigate({ search: (a) => ({ ...a, familia: f.id }) })}
                    >
                      {f.responsavel_nome}, {whatsappExibir(f.whatsapp)}
                    </button>
                    <div className="flex flex-wrap gap-2">
                      {!f.ativa && <SeloStatus tom="neutro">Inativa</SeloStatus>}
                      {f.familia_links?.enviado_em ? (
                        <SeloStatus tom="sucesso">Link enviado</SeloStatus>
                      ) : (
                        <SeloStatus tom="aviso">Link não enviado</SeloStatus>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="min-h-11" onClick={() => setNova({ familia: f })}>
                      <UserPlus aria-hidden="true" />
                      Adicionar irmã
                    </Button>
                    <Button variant="outline" className="min-h-11" onClick={() => setNovoLink(f)}>
                      Gerar novo link
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-border">
                  {f.bailarinas.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full flex-wrap items-center gap-x-3 py-2 text-left hover:bg-muted/50"
                        onClick={() => navigate({ search: (a) => ({ ...a, bailarina: b.id }) })}
                      >
                        <span
                          className={
                            b.ativa
                              ? "font-medium text-foreground"
                              : "text-muted-foreground line-through"
                          }
                        >
                          {b.nome}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {[
                            b.turma,
                            b.pacote,
                            b.escalacao.map((e) => nomeSessao(e.sessao_id)).join(" e "),
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {q.data.saldos
                    .filter((x) => x.familia_id === f.id && x.escaladas > 0)
                    .map((x) => (
                      <span key={x.sessao_id}>
                        {nomeSessao(x.sessao_id)}: saldo{" "}
                        <span className="numeros font-medium">{x.saldo}</span> de{" "}
                        <span className="numeros">{x.cota}</span>
                      </span>
                    ))}
                </div>
              </li>
            ))}
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

      <EditarBailarina
        eventoId={eventoId}
        bailarina={bailarinaAberta}
        sessoes={(sessoes.data ?? []).map((s) => ({ id: s.id, nome: s.nome }))}
        onFechar={() => navigate({ search: (a) => ({ ...a, bailarina: undefined }) })}
      />
      <EditarFamilia
        eventoId={eventoId}
        familia={familiaAberta}
        onFechar={() => navigate({ search: (a) => ({ ...a, familia: undefined }) })}
      />
      <NovaBailarina
        eventoId={eventoId}
        aberto={nova}
        sessoes={(sessoes.data ?? []).map((s) => ({ id: s.id, nome: s.nome }))}
        onFechar={() => setNova(null)}
      />

      <AlertDialog open={novoLink !== null} onOpenChange={(o) => !o && setNovoLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link para {novoLink?.responsavel_nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O link antigo para de funcionar na hora. Você vai precisar mandar o novo link pelo
              WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={gerar.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (novoLink) gerar.mutate(novoLink.id);
              }}
            >
              {gerar.isPending ? "Gerando..." : "Gerar novo link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

interface FormBailarina {
  nome: string;
  turma: string;
  pacote: string;
  ativa: boolean;
  dias: string[];
}

type SessaoOpcao = { id: string; nome: string };

function EditarBailarina({
  eventoId,
  bailarina,
  sessoes,
  onFechar,
}: {
  eventoId: string;
  bailarina: Bailarina | null;
  sessoes: SessaoOpcao[];
  onFechar: () => void;
}) {
  return (
    <Sheet open={bailarina !== null} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Editar bailarina</SheetTitle>
        </SheetHeader>
        {bailarina && (
          <FormularioBailarina
            key={bailarina.id}
            eventoId={eventoId}
            bailarina={bailarina}
            sessoes={sessoes}
            onFechar={onFechar}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function FormularioBailarina({
  eventoId,
  bailarina,
  sessoes,
  onFechar,
}: {
  eventoId: string;
  bailarina: Bailarina;
  sessoes: SessaoOpcao[];
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const inicial = useMemo<FormBailarina>(
    () => ({
      nome: bailarina.nome,
      turma: bailarina.turma ?? "",
      pacote: bailarina.pacote ?? "",
      ativa: bailarina.ativa,
      dias: bailarina.escalacao.map((e) => e.sessao_id),
    }),
    [bailarina],
  );
  const { valor, setValor, limpar, temRascunho } = useRascunho<FormBailarina>(
    `bailarina:${bailarina.id}`,
    inicial,
  );
  const f = { ...inicial, ...(valor ?? {}) };
  const mudar = (p: Partial<FormBailarina>) => setValor({ ...f, ...p });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("bailarinas")
        .update({
          nome: f.nome.trim(),
          turma: f.turma.trim() || null,
          pacote: f.pacote.trim() || null,
          ativa: f.ativa,
        })
        .eq("id", bailarina.id);
      if (error) throw error;
      const r = await supabase.rpc("definir_escalacao", {
        p_bailarina: bailarina.id,
        p_sessoes: f.dias,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Bailarina salva.");
      limpar();
      qc.invalidateQueries({ queryKey: ["familias", eventoId] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const semDia = f.dias.length === 0;

  return (
    <form
      className="space-y-4 px-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (semDia) {
          toast.error("Marque pelo menos um dia.");
          return;
        }
        if (!salvar.isPending) salvar.mutate();
      }}
    >
      {temRascunho && <SeloStatus tom="aviso">Rascunho não salvo</SeloStatus>}
      <Campo
        id="b-nome"
        rotulo="Nome completo"
        required
        value={f.nome}
        onChange={(e) => mudar({ nome: e.target.value })}
      />
      <Campo
        id="b-turma"
        rotulo="Turma"
        value={f.turma}
        onChange={(e) => mudar({ turma: e.target.value })}
      />
      <Campo
        id="b-pacote"
        rotulo="Pacote"
        value={f.pacote}
        onChange={(e) => mudar({ pacote: e.target.value })}
      />
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-foreground">Dias em que dança</legend>
        {sessoes.map((s) => (
          <div key={s.id} className="flex min-h-11 items-center gap-3">
            <Checkbox
              id={`b-dia-${s.id}`}
              checked={f.dias.includes(s.id)}
              onCheckedChange={(v) =>
                mudar({ dias: v === true ? [...f.dias, s.id] : f.dias.filter((d) => d !== s.id) })
              }
            />
            <Label htmlFor={`b-dia-${s.id}`}>{s.nome}</Label>
          </div>
        ))}
        {semDia && <p className="text-sm text-destructive">Marque pelo menos um dia.</p>}
      </fieldset>
      <div className="flex min-h-11 items-center gap-3">
        <Switch id="b-ativa" checked={f.ativa} onCheckedChange={(v) => mudar({ ativa: v })} />
        <Label htmlFor="b-ativa">Bailarina ativa</Label>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            limpar();
            onFechar();
          }}
        >
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando..." : "Salvar bailarina"}
        </Button>
      </div>
    </form>
  );
}

function EditarFamilia({
  eventoId,
  familia,
  onFechar,
}: {
  eventoId: string;
  familia: Familia | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: async (fd: FormData) => {
      const bruto = String(fd.get("whatsapp"));
      const { data: whatsapp, error: e1 } = await supabase.rpc("normalizar_whatsapp", { p: bruto });
      if (e1) throw e1;
      if (!whatsapp)
        throw new Error("WhatsApp inválido. Use DDD e número, por exemplo (91) 98888-7777.");
      const { error } = await supabase
        .from("familias")
        .update({
          responsavel_nome: String(fd.get("responsavel")).trim(),
          whatsapp,
          ativa: fd.get("ativa") === "on",
        })
        .eq("id", familia!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família salva.");
      qc.invalidateQueries({ queryKey: ["familias", eventoId] });
      qc.invalidateQueries({ queryKey: ["envio", eventoId] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <Sheet open={familia !== null} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Editar família</SheetTitle>
        </SheetHeader>
        {familia && (
          <form
            key={familia.id}
            className="space-y-4 px-4 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!salvar.isPending) salvar.mutate(new FormData(e.currentTarget));
            }}
          >
            <p className="text-muted-foreground">
              Bailarinas: {familia.bailarinas.map((b) => primeiroNome(b.nome)).join(", ")}
            </p>
            <Campo
              id="fa-resp"
              name="responsavel"
              rotulo="Responsável"
              required
              defaultValue={familia.responsavel_nome}
            />
            <Campo
              id="fa-whats"
              name="whatsapp"
              rotulo="WhatsApp"
              inputMode="tel"
              required
              defaultValue={whatsappExibir(familia.whatsapp)}
            />
            <div className="flex min-h-11 items-center gap-3">
              <Switch id="fa-ativa" name="ativa" defaultChecked={familia.ativa} />
              <Label htmlFor="fa-ativa">Família ativa</Label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={onFechar}>
                Cancelar
              </Button>
              <Button type="submit" className="min-h-11" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar família"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NovaBailarina({
  eventoId,
  aberto,
  sessoes,
  onFechar,
}: {
  eventoId: string;
  aberto: { familia: Familia | null } | null;
  sessoes: SessaoOpcao[];
  onFechar: () => void;
}) {
  const familia = aberto?.familia ?? null;
  return (
    <Sheet open={aberto !== null} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {familia ? `Adicionar irmã na família de ${familia.responsavel_nome}` : "Adicionar bailarina"}
          </SheetTitle>
        </SheetHeader>
        {aberto && (
          <FormNovaBailarina
            key={familia?.id ?? "nova"}
            eventoId={eventoId}
            familia={familia}
            sessoes={sessoes}
            onFechar={onFechar}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function FormNovaBailarina({
  eventoId,
  familia,
  sessoes,
  onFechar,
}: {
  eventoId: string;
  familia: Familia | null;
  sessoes: SessaoOpcao[];
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [dias, setDias] = useState<string[]>([]);

  const salvar = useMutation({
    mutationFn: async (fd: FormData) => {
      const nome = String(fd.get("nome") ?? "").trim();
      if (nome.split(/\s+/).length < 2) throw new Error("Escreva o nome completo da bailarina.");
      let familiaId = familia?.id ?? null;
      let novaFamilia = false;
      if (!familiaId) {
        const { data: whatsapp, error: e1 } = await supabase.rpc("normalizar_whatsapp", {
          p: String(fd.get("whatsapp") ?? ""),
        });
        if (e1) throw e1;
        if (!whatsapp)
          throw new Error("WhatsApp inválido. Use DDD e número, por exemplo (91) 98888-7777.");
        const { data: existe } = await supabase
          .from("familias")
          .select("responsavel_nome")
          .eq("evento_id", eventoId)
          .eq("whatsapp", whatsapp)
          .maybeSingle();
        if (existe)
          throw new Error(
            `Esse WhatsApp já é da família de ${existe.responsavel_nome}. Use "Adicionar irmã" no cartão dela.`,
          );
        const { data: nova, error: e2 } = await supabase
          .from("familias")
          .insert({
            evento_id: eventoId,
            responsavel_nome: String(fd.get("responsavel") ?? "").trim(),
            whatsapp,
          })
          .select("id")
          .single();
        if (e2) throw e2;
        familiaId = nova.id;
        novaFamilia = true;
      }
      const { data: b, error: e3 } = await supabase
        .from("bailarinas")
        .insert({
          evento_id: eventoId,
          familia_id: familiaId,
          nome,
          nome_busca: normalizar(nome),
          turma: String(fd.get("turma") ?? "").trim() || null,
          pacote: String(fd.get("pacote") ?? "").trim() || null,
          origem: "recepcao",
        })
        .select("id")
        .single();
      if (e3) {
        if (e3.code === "23505") throw new Error("Já existe uma bailarina com esse nome neste evento.");
        throw e3;
      }
      const r = await supabase.rpc("definir_escalacao", { p_bailarina: b.id, p_sessoes: dias });
      if (r.error) throw r.error;
      if (novaFamilia) {
        const g = await supabase.rpc("gerar_link_familia", { p_familia: familiaId });
        if (g.error) throw g.error;
      }
      return novaFamilia;
    },
    onSuccess: (novaFamilia) => {
      toast.success(
        novaFamilia
          ? "Bailarina e família cadastradas. O link já está na aba Envio de links."
          : "Irmã adicionada. O saldo da família foi atualizado.",
      );
      qc.invalidateQueries({ queryKey: ["familias", eventoId] });
      qc.invalidateQueries({ queryKey: ["envio", eventoId] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const semDia = dias.length === 0;

  return (
    <form
      className="space-y-4 px-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (semDia) {
          toast.error("Marque pelo menos um dia.");
          return;
        }
        if (!salvar.isPending) salvar.mutate(new FormData(e.currentTarget));
      }}
    >
      {familia ? (
        <p className="text-muted-foreground">
          Já na família: {familia.bailarinas.map((b) => primeiroNome(b.nome)).join(", ")}
        </p>
      ) : (
        <>
          <Campo id="n-resp" name="responsavel" rotulo="Responsável" required autoComplete="off" />
          <Campo
            id="n-whats"
            name="whatsapp"
            rotulo="WhatsApp do responsável"
            inputMode="tel"
            placeholder="(91) 98888-7777"
            required
          />
        </>
      )}
      <Campo id="n-nome" name="nome" rotulo="Nome completo da bailarina" required autoComplete="off" />
      <Campo id="n-turma" name="turma" rotulo="Turma" />
      <Campo id="n-pacote" name="pacote" rotulo="Pacote" />
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-foreground">Dias em que dança</legend>
        {sessoes.map((s) => (
          <div key={s.id} className="flex min-h-11 items-center gap-3">
            <Checkbox
              id={`n-dia-${s.id}`}
              checked={dias.includes(s.id)}
              onCheckedChange={(v) =>
                setDias(v === true ? [...dias, s.id] : dias.filter((d) => d !== s.id))
              }
            />
            <Label htmlFor={`n-dia-${s.id}`}>{s.nome}</Label>
          </div>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando..." : familia ? "Adicionar irmã" : "Cadastrar bailarina"}
        </Button>
      </div>
    </form>
  );
}
