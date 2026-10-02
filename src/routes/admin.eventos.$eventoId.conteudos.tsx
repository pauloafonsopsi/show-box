import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { classeCampo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { PublicarVersao } from "@/design/publicar-versao";
import { supabase } from "@/integrations/supabase/client";
import { dataHora, mensagemDeErro, preencher, variaveisDoTexto } from "@/lib/formato";

const busca = z.object({
  editar: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/admin/eventos/$eventoId/conteudos")({
  validateSearch: (s) => busca.parse(s),
  component: Conteudos,
});

const EXEMPLO: Record<string, string> = {
  responsavel: "Ana",
  bailarinas: "Maria e Clara",
  link: "https://exemplo/f/codigo",
  lista_ingressos: "Sábado, lugares 12 e 13",
  dia: "Sábado, 28 de novembro",
  bailarinas_do_dia: "Maria e Clara",
  saldo: "6",
  valor: "R$ 240,00",
  valor_inteira: "R$ 480,00",
  minutos: "15",
  data_limite: "05/11/2026",
  hora_inicio: "8h",
  hora_fim: "20h",
  vagas: "9",
  retirada_inicio: "16/11",
  retirada_fim: "27/11",
  contato_privacidade: "o WhatsApp da recepção",
};

function Conteudos() {
  const { eventoId } = Route.useParams();
  const { editar, q: termo = "" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["conteudos", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos")
        .select("id, chave, rotulo, texto, atualizado_em")
        .eq("evento_id", eventoId)
        .order("rotulo");
      if (error) throw error;
      return data;
    },
  });

  const aberto = q.data?.find((c) => c.id === editar) ?? null;
  const [texto, setTexto] = useState<string | null>(null);
  const valor = texto ?? aberto?.texto ?? "";

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("conteudos").update({ texto: valor }).eq("id", aberto!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Texto salvo.");
      qc.invalidateQueries({ queryKey: ["conteudos", eventoId] });
      setTexto(null);
      navigate({ search: (s) => ({ ...s, editar: undefined }) });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const fechar = () => {
    setTexto(null);
    navigate({ search: (s) => ({ ...s, editar: undefined }) });
  };

  const lista = (q.data ?? []).filter((c) => !termo || c.rotulo.toLowerCase().includes(termo.toLowerCase()));

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Textos do evento</h2>
        <div className="mb-3 max-w-sm">
          <Label htmlFor="busca-cont" className="sr-only">
            Buscar texto
          </Label>
          <Input
            id="busca-cont"
            placeholder="Buscar texto"
            className="min-h-11 text-base md:text-base"
            value={termo}
            onChange={(e) => navigate({ search: (s) => ({ ...s, q: e.target.value || undefined }), replace: true })}
          />
        </div>
        {q.isPending ? (
          <EsqueletoLista />
        ) : q.isError ? (
          <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
        ) : lista.length === 0 ? (
          <EstadoVazio titulo="Nenhum texto encontrado" />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="block min-h-14 w-full px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() => navigate({ search: (s) => ({ ...s, editar: c.id }) })}
                >
                  <span className="block font-medium text-foreground">{c.rotulo}</span>
                  <span className="block truncate text-sm text-muted-foreground">{c.texto}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Termos eventoId={eventoId} />

      <Sheet open={aberto !== null} onOpenChange={(o) => !o && fechar()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{aberto?.rotulo}</SheetTitle>
          </SheetHeader>
          {aberto && (
            <div className="space-y-4 px-4 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="texto">Texto</Label>
                <textarea id="texto" rows={8} className={classeCampo} value={valor} onChange={(e) => setTexto(e.target.value)} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Variáveis deste texto</p>
                {variaveisDoTexto(aberto.texto).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma.</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                    {variaveisDoTexto(aberto.texto).map((v) => (
                      <li key={v} className="rounded-sm bg-muted px-2 py-0.5 font-mono">{`{{${v}}}`}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Como fica, com um exemplo</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-foreground">
                  {preencher(valor, EXEMPLO)}
                </pre>
              </div>
              <p className="text-sm text-muted-foreground">Última mudança em {dataHora(aberto.atualizado_em)}.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11" onClick={fechar}>
                  Cancelar
                </Button>
                <Button className="min-h-11" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
                  {salvar.isPending ? "Salvando..." : "Salvar texto"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Termos({ eventoId }: { eventoId: string }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const q = useQuery({
    queryKey: ["termos", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termos_versoes")
        .select("id, versao, texto, hash, publicada_em")
        .eq("evento_id", eventoId)
        .eq("tipo", "termos")
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const publicar = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase
        .from("termos_versoes")
        .insert({ evento_id: eventoId, tipo: "termos", texto, versao: 0, hash: "" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nova versão dos termos publicada.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["termos", eventoId] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-foreground">Termos de compra</h2>
      {q.isPending ? (
        <EsqueletoLista linhas={1} />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
          {q.data ? (
            <p className="text-foreground">
              Versão <span className="numeros">{q.data.versao}</span>, publicada em {dataHora(q.data.publicada_em)}. Código{" "}
              <span className="font-mono">{q.data.hash.slice(0, 12)}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">Nenhuma versão publicada.</p>
          )}
          <Button className="min-h-11" onClick={() => setAberto(true)}>
            Publicar nova versão
          </Button>
        </div>
      )}
      <PublicarVersao
        titulo="Nova versão dos termos"
        aberto={aberto}
        onFechar={() => setAberto(false)}
        inicial={q.data?.texto ?? ""}
        onPublicar={(t) => publicar.mutate(t)}
        publicando={publicar.isPending}
      />
    </section>
  );
}
