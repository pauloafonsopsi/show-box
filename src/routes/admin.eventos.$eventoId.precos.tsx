import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Campo, classeCampo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { supabase } from "@/integrations/supabase/client";
import { setoresDoEventoQuery } from "@/lib/consultas";
import {
  centavosDeTexto,
  dataHora,
  deInputLocal,
  mensagemDeErro,
  paraInputLocal,
  textoDeCentavos,
} from "@/lib/formato";
import { TIPO_JANELA, TIPO_PRECO } from "@/lib/rotulos";

export const Route = createFileRoute("/admin/eventos/$eventoId/precos")({
  component: Precos,
});

function Precos() {
  const { eventoId } = Route.useParams();
  return (
    <div className="space-y-10">
      <Periodos eventoId={eventoId} />
      <Janelas eventoId={eventoId} />
    </div>
  );
}

type Periodo = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  modo: string;
  rotulo_unico: string;
  precos: { id: string; setor_id: string; tipo: string; valor_centavos: number }[];
};

function Periodos({ eventoId }: { eventoId: string }) {
  const [editando, setEditando] = useState<Periodo | "novo" | null>(null);
  const setores = useQuery(setoresDoEventoQuery(eventoId));
  const q = useQuery({
    queryKey: ["periodos", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periodos_preco")
        .select(
          "id, nome, inicio, fim, modo, rotulo_unico, precos(id, setor_id, tipo, valor_centavos)",
        )
        .eq("evento_id", eventoId)
        .order("inicio");
      if (error) throw error;
      return data as Periodo[];
    },
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Períodos de preço</h2>
        <Button className="min-h-11" onClick={() => setEditando("novo")}>
          <Plus aria-hidden="true" />
          Novo período
        </Button>
      </div>
      {q.isPending || setores.isPending ? (
        <EsqueletoLista linhas={2} altura="h-40" />
      ) : q.isError || setores.isError ? (
        <EstadoErro
          mensagem={mensagemDeErro(q.error ?? setores.error)}
          onTentar={() => q.refetch()}
        />
      ) : q.data.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum período de preço"
          texto="Crie o primeiro período para definir os valores."
        />
      ) : (
        <div className="space-y-4">
          {q.data.map((p) => (
            <TabelaPrecos
              key={p.id}
              eventoId={eventoId}
              periodo={p}
              setores={(setores.data ?? []).filter((s) => s.nome !== "A definir")}
              onEditar={() => setEditando(p)}
            />
          ))}
        </div>
      )}
      <EditarPeriodo eventoId={eventoId} periodo={editando} onFechar={() => setEditando(null)} />
    </section>
  );
}

function TabelaPrecos({
  eventoId,
  periodo,
  setores,
  onEditar,
}: {
  eventoId: string;
  periodo: Periodo;
  setores: { id: string; nome: string; cor: string }[];
  onEditar: () => void;
}) {
  const qc = useQueryClient();
  const tipos = periodo.modo === "unico" ? ["unico"] : ["inteira", "meia"];
  const atual = (setor: string, tipo: string) =>
    periodo.precos.find((x) => x.setor_id === setor && x.tipo === tipo)?.valor_centavos;
  const [valores, setValores] = useState<Record<string, string>>({});

  const salvar = useMutation({
    mutationFn: async () => {
      const mudancas: {
        periodo_id: string;
        setor_id: string;
        tipo: string;
        valor_centavos: number;
      }[] = [];
      for (const [k, v] of Object.entries(valores)) {
        const [setor = "", tipo = ""] = k.split("|");
        const c = centavosDeTexto(v);
        if (c === null)
          throw new Error("Preencha todos os valores alterados com um número, por exemplo 240,00.");
        if (c !== atual(setor, tipo))
          mudancas.push({ periodo_id: periodo.id, setor_id: setor, tipo, valor_centavos: c });
      }
      if (mudancas.length === 0) return 0;
      const { error } = await supabase
        .from("precos")
        .upsert(mudancas, { onConflict: "periodo_id,setor_id,tipo" });
      if (error) throw error;
      return mudancas.length;
    },
    onSuccess: (n) => {
      toast.success(n === 0 ? "Nada mudou." : "Preços salvos. A mudança aparece em Auditoria.");
      setValores({});
      qc.invalidateQueries({ queryKey: ["periodos", eventoId] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const alterado = Object.keys(valores).length > 0;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">{periodo.nome}</h3>
          <p className="text-sm text-muted-foreground">
            De {dataHora(periodo.inicio)} até {dataHora(periodo.fim)}.{" "}
            {periodo.modo === "unico" ? `Valor único: ${periodo.rotulo_unico}` : "Inteira e meia"}
          </p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={onEditar}>
          Editar período
        </Button>
      </div>
      {setores.length === 0 ? (
        <p className="text-muted-foreground">
          Escolha o mapa das sessões para definir os preços por setor.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Setor</th>
                {tipos.map((t) => (
                  <th key={t} className="py-2 pr-4 font-medium">
                    {TIPO_PRECO[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {setores.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block h-1 w-4 rounded-sm"
                        style={{ backgroundColor: s.cor }}
                      />
                      {s.nome}
                    </span>
                  </td>
                  {tipos.map((t) => {
                    const k = `${s.id}|${t}`;
                    return (
                      <td key={t} className="py-2 pr-4">
                        <Label htmlFor={`p-${periodo.id}-${k}`} className="sr-only">
                          {s.nome} {TIPO_PRECO[t]}
                        </Label>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">R$</span>
                          <Input
                            id={`p-${periodo.id}-${k}`}
                            inputMode="decimal"
                            className="numeros min-h-11 w-28 text-base md:text-base"
                            value={valores[k] ?? textoDeCentavos(atual(s.id, t))}
                            placeholder="0,00"
                            onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {alterado && (
        <div className="mt-3 flex gap-2">
          <Button className="min-h-11" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando..." : "Salvar preços"}
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => setValores({})}>
            Desfazer
          </Button>
        </div>
      )}
    </div>
  );
}

function EditarPeriodo({
  eventoId,
  periodo,
  onFechar,
}: {
  eventoId: string;
  periodo: Periodo | "novo" | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const p = periodo && periodo !== "novo" ? periodo : null;
  const salvar = useMutation({
    mutationFn: async (f: FormData) => {
      const dados = {
        nome: String(f.get("nome")).trim(),
        inicio: deInputLocal(String(f.get("inicio")))!,
        fim: deInputLocal(String(f.get("fim")))!,
        modo: String(f.get("modo")),
        rotulo_unico: String(f.get("rotulo_unico") || "Meia-entrada para todos"),
      };
      const { error } = p
        ? await supabase.from("periodos_preco").update(dados).eq("id", p.id)
        : await supabase.from("periodos_preco").insert({ ...dados, evento_id: eventoId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(p ? "Período salvo." : "Período criado. Agora preencha os preços.");
      qc.invalidateQueries({ queryKey: ["periodos", eventoId] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!salvar.isPending) salvar.mutate(new FormData(e.currentTarget));
  }

  return (
    <Dialog open={periodo !== null} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p ? "Editar período" : "Novo período"}</DialogTitle>
        </DialogHeader>
        <form key={p?.id ?? "novo"} onSubmit={enviar} className="space-y-4">
          <Campo id="pr-nome" name="nome" rotulo="Nome" required defaultValue={p?.nome ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="pr-ini"
              name="inicio"
              rotulo="Início"
              type="datetime-local"
              required
              defaultValue={paraInputLocal(p?.inicio)}
            />
            <Campo
              id="pr-fim"
              name="fim"
              rotulo="Fim"
              type="datetime-local"
              required
              defaultValue={paraInputLocal(p?.fim)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-modo">Modo</Label>
            <select
              id="pr-modo"
              name="modo"
              className={classeCampo}
              defaultValue={p?.modo ?? "inteira_meia"}
            >
              <option value="unico">Valor único</option>
              <option value="inteira_meia">Inteira e meia</option>
            </select>
          </div>
          <Campo
            id="pr-rot"
            name="rotulo_unico"
            rotulo="Rótulo do valor único"
            defaultValue={p?.rotulo_unico ?? "Meia-entrada para todos"}
          />
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar período"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Janela = {
  id: string;
  tipo: string;
  inicio: string;
  fim: string | null;
  observacao: string | null;
};

function Janelas({ eventoId }: { eventoId: string }) {
  const qc = useQueryClient();
  const [apagar, setApagar] = useState<Janela | null>(null);
  const q = useQuery({
    queryKey: ["janelas", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("janelas")
        .select("id, tipo, inicio, fim, observacao")
        .eq("evento_id", eventoId)
        .order("inicio");
      if (error) throw error;
      return data as Janela[];
    },
  });

  const salvar = useMutation({
    mutationFn: async ({ id, f }: { id: string | null; f: FormData }) => {
      const dados = {
        tipo: String(f.get("tipo")),
        inicio: deInputLocal(String(f.get("inicio")))!,
        fim: deInputLocal(String(f.get("fim"))),
        observacao: String(f.get("observacao") || "") || null,
      };
      const { error } = id
        ? await supabase.from("janelas").update(dados).eq("id", id)
        : await supabase.from("janelas").insert({ ...dados, evento_id: eventoId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Calendário salvo.");
      qc.invalidateQueries({ queryKey: ["janelas", eventoId] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("janelas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Janela apagada.");
      setApagar(null);
      qc.invalidateQueries({ queryKey: ["janelas", eventoId] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const linha = (j: Janela | null) => (
    <form
      key={j?.id ?? "nova"}
      onSubmit={(e) => {
        e.preventDefault();
        if (!salvar.isPending)
          salvar.mutate({ id: j?.id ?? null, f: new FormData(e.currentTarget) });
        if (!j) e.currentTarget.reset();
      }}
      className="grid gap-2 border-t border-border py-3 md:grid-cols-[10rem_12rem_12rem_1fr_auto] md:items-end"
    >
      <div className="space-y-1">
        <Label className="md:sr-only">Tipo</Label>
        <select
          name="tipo"
          className={classeCampo}
          defaultValue={j?.tipo ?? "presencial"}
          aria-label="Tipo"
        >
          {Object.entries(TIPO_JANELA).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="md:sr-only">Início</Label>
        <Input
          name="inicio"
          type="datetime-local"
          required
          aria-label="Início"
          className="min-h-11 text-base md:text-base"
          defaultValue={paraInputLocal(j?.inicio)}
        />
      </div>
      <div className="space-y-1">
        <Label className="md:sr-only">Fim</Label>
        <Input
          name="fim"
          type="datetime-local"
          aria-label="Fim"
          className="min-h-11 text-base md:text-base"
          defaultValue={paraInputLocal(j?.fim)}
        />
      </div>
      <div className="space-y-1">
        <Label className="md:sr-only">Observação</Label>
        <Input
          name="observacao"
          aria-label="Observação"
          className="min-h-11 text-base md:text-base"
          defaultValue={j?.observacao ?? ""}
        />
      </div>
      <div className="flex gap-1">
        <Button
          type="submit"
          variant={j ? "outline" : "default"}
          className="min-h-11"
          disabled={salvar.isPending}
        >
          {j ? "Salvar" : "Adicionar"}
        </Button>
        {j && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            aria-label="Apagar janela"
            onClick={() => setApagar(j)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </form>
  );

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-foreground">Calendário de vendas</h2>
      <p className="mb-3 text-muted-foreground">Quando cada canal abre e fecha.</p>
      {q.isPending ? (
        <EsqueletoLista linhas={4} />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : (
        <div className="rounded-lg border border-border px-4">
          <div className="hidden gap-2 py-2 text-sm text-muted-foreground md:grid md:grid-cols-[10rem_12rem_12rem_1fr_auto]">
            <span>Tipo</span>
            <span>Início</span>
            <span>Fim</span>
            <span>Observação</span>
            <span />
          </div>
          {q.data.map((j) => linha(j))}
          {linha(null)}
        </div>
      )}
      <AlertDialog open={apagar !== null} onOpenChange={(o) => !o && setApagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar esta janela?</AlertDialogTitle>
            <AlertDialogDescription>
              {apagar && `${TIPO_JANELA[apagar.tipo]} de ${dataHora(apagar.inicio)}`} sai do
              calendário. Este canal deixa de ter horário definido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              onClick={(e) => {
                e.preventDefault();
                if (apagar) remover.mutate(apagar.id);
              }}
            >
              Apagar janela
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
