import { ResumoVendas } from "@/admin-vendas/relatorios";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Campo, classeCampo, EsqueletoLista, EstadoErro } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { eventoQuery } from "@/lib/consultas";
import { mensagemDeErro } from "@/lib/formato";
import { useRascunho } from "@/lib/rascunho";

export const Route = createFileRoute("/admin/eventos/$eventoId/visao-geral")({
  component: VisaoGeral,
});

/** Deixa o texto no formato aceito pelas bandeiras: maiúsculas, sem acento, até 13. */
function limparFatura(v: string, aparar = true): string {
  const s = v
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/ {2,}/g, " ")
    .slice(0, 13);
  return aparar ? s.trim() : s.trimStart();
}

interface Form {
  nome: string;
  fatura: string;
  slug: string;
  status: string;
  cotaLigada: boolean;
  cota: string;
  limite: string;
  reserva: string;
  parcMin: string;
  parcMax: string;
  meiaPct: string;
  meiaCats: string;
}

function VisaoGeral() {
  const { eventoId } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery(eventoQuery(eventoId));

  const inicial = useMemo<Form | undefined>(() => {
    if (!q.data) return undefined;
    const e = q.data;
    return {
      nome: e.nome,
      fatura: e.fatura_cartao ?? "",
      slug: e.slug,
      status: e.status,
      cotaLigada: e.cota_por_participante !== null,
      cota: String(e.cota_por_participante ?? 3),
      limite: String(e.limite_por_pedido),
      reserva: String(e.tempo_reserva_min),
      parcMin: String(e.parcelamento_min_ingressos),
      parcMax: String(e.parcelas_max),
      meiaPct: String(e.meia_percentual),
      meiaCats: (Array.isArray(e.meia_categorias) ? (e.meia_categorias as string[]) : []).join(
        "\n",
      ),
    };
  }, [q.data]);

  const {
    valor: f,
    setValor,
    limpar,
    temRascunho,
  } = useRascunho<Form>(`evento:${eventoId}`, inicial);

  const salvar = useMutation({
    mutationFn: async (v: Form) => {
      const { error } = await supabase
        .from("eventos")
        .update({
          nome: v.nome.trim(),
          fatura_cartao: limparFatura(v.fatura) || null,
          slug: v.slug.trim(),
          status: v.status,
          cota_por_participante: v.cotaLigada ? Number(v.cota) : null,
          limite_por_pedido: Number(v.limite),
          tempo_reserva_min: Number(v.reserva),
          parcelamento_min_ingressos: Number(v.parcMin),
          parcelas_max: Number(v.parcMax),
          meia_percentual: Number(v.meiaPct),
          meia_categorias: v.meiaCats
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        })
        .eq("id", eventoId);
      if (error) throw error;
    },
    onSuccess: async () => {
      limpar();
      await qc.invalidateQueries({ queryKey: ["evento", eventoId] });
      qc.invalidateQueries({ queryKey: ["eventos"] });
      toast.success("Evento salvo.");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  if (q.isPending || !f) return <EsqueletoLista linhas={6} />;
  if (q.isError)
    return <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />;

  const set = (parcial: Partial<Form>) => setValor({ ...f, ...parcial });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (f && !salvar.isPending) salvar.mutate(f);
  }

  return (
    <div className="space-y-10">
      <ResumoVendas eventoId={eventoId} />
      <form onSubmit={enviar} className="max-w-2xl space-y-6">
        {temRascunho && <SeloStatus tom="aviso">Você tem alterações ainda não salvas.</SeloStatus>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="nome"
            rotulo="Nome"
            required
            value={f.nome}
            onChange={(e) => set({ nome: e.target.value })}
          />
          <Campo
            id="slug"
            rotulo="Endereço"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            ajuda="Letras minúsculas, números e hífen."
            value={f.slug}
            onChange={(e) => set({ slug: e.target.value })}
          />
          <div className="space-y-1.5">
            <Label htmlFor="status">Situação</Label>
            <select
              id="status"
              className={classeCampo}
              value={f.status}
              onChange={(e) => set({ status: e.target.value })}
            >
              <option value="rascunho">Rascunho</option>
              <option value="em_venda">Em venda</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
          <Campo
            id="fatura"
            rotulo={`Nome na fatura do cartão (${f.fatura.length}/13)`}
            maxLength={13}
            pattern="[A-Z0-9 ]{3,13}"
            placeholder={limparFatura(f.nome) || "INGRESSOS"}
            ajuda="Como aparece no extrato do cartão da família. Até 13 letras, sem acento. Em branco, usa o começo do nome do evento."
            value={f.fatura}
            onChange={(e) => set({ fatura: limparFatura(e.target.value, false) })}
          />
        </div>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 font-medium text-foreground">Cota por participante</legend>
          <div className="flex min-h-11 items-center gap-3">
            <Switch
              id="cota-ligada"
              checked={f.cotaLigada}
              onCheckedChange={(v) => set({ cotaLigada: v })}
            />
            <Label htmlFor="cota-ligada">{f.cotaLigada ? "Ligada" : "Desligada"}</Label>
          </div>
          {f.cotaLigada && (
            <Campo
              id="cota"
              rotulo="Ingressos por bailarina, por sessão"
              type="number"
              min={0}
              required
              value={f.cota}
              onChange={(e) => set({ cota: e.target.value })}
              className="max-w-xs"
            />
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="limite"
            rotulo="Limite por pedido"
            type="number"
            min={1}
            required
            value={f.limite}
            onChange={(e) => set({ limite: e.target.value })}
          />
          <Campo
            id="reserva"
            rotulo="Tempo de reserva (minutos)"
            type="number"
            min={5}
            max={60}
            required
            value={f.reserva}
            onChange={(e) => set({ reserva: e.target.value })}
          />
          <Campo
            id="parcmin"
            rotulo="Parcelar a partir de quantos ingressos"
            type="number"
            min={1}
            required
            value={f.parcMin}
            onChange={(e) => set({ parcMin: e.target.value })}
          />
          <Campo
            id="parcmax"
            rotulo="Parcelas no máximo"
            type="number"
            min={1}
            max={12}
            required
            value={f.parcMax}
            onChange={(e) => set({ parcMax: e.target.value })}
          />
          <Campo
            id="meiapct"
            rotulo="Meia-entrada: percentual por sessão"
            type="number"
            min={0}
            max={100}
            required
            value={f.meiaPct}
            onChange={(e) => set({ meiaPct: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meiacats">Categorias da meia-entrada (uma por linha)</Label>
          <textarea
            id="meiacats"
            rows={5}
            className={classeCampo}
            value={f.meiaCats}
            onChange={(e) => set({ meiaCats: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar evento"}
          </Button>
          {temRascunho && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => limpar(inicial)}
            >
              Descartar alterações
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
