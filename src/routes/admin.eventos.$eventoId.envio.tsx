import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { dataHora, juntarNomes, mensagemDeErro, preencher, primeiroNome, whatsappExibir } from "@/lib/formato";

const busca = z.object({
  pendentes: z.boolean().optional().catch(undefined),
  pagina: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/admin/eventos/$eventoId/envio")({
  validateSearch: (s) => busca.parse(s),
  component: Envio,
});

const POR_PAGINA = 30;

type Linha = {
  id: string;
  responsavel_nome: string;
  whatsapp: string;
  bailarinas: { nome: string; ativa: boolean }[];
  familia_links: { token: string; enviado_em: string | null } | null;
};

function Envio() {
  const { eventoId } = Route.useParams();
  const { pendentes, pagina = 1 } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Linha | null>(null);

  const q = useQuery({
    queryKey: ["envio", eventoId],
    queryFn: async () => {
      const [f, c] = await Promise.all([
        supabase
          .from("familias")
          .select("id, responsavel_nome, whatsapp, bailarinas(nome, ativa), familia_links(token, enviado_em)")
          .eq("evento_id", eventoId)
          .eq("ativa", true)
          .order("responsavel_nome")
          .limit(2000),
        supabase.from("conteudos").select("texto").eq("evento_id", eventoId).eq("chave", "mensagem_link").maybeSingle(),
      ]);
      if (f.error) throw f.error;
      if (c.error) throw c.error;
      return { familias: f.data as unknown as Linha[], mensagem: c.data?.texto ?? "" };
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("gerar_links_do_evento", { p_evento: eventoId });
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      toast.success(n === 0 ? "Todas as famílias já tinham link." : `${n} links gerados. Agora envie pelo WhatsApp.`);
      qc.invalidateQueries({ queryKey: ["envio", eventoId] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const marcar = useMutation({
    mutationFn: async ({ id, enviado }: { id: string; enviado: boolean }) => {
      const { error } = await supabase.rpc("marcar_link_enviado", { p_familia: id, p_enviado: enviado });
      if (error) throw error;
      return enviado;
    },
    onSuccess: (enviado) => {
      toast.success(enviado ? "Marcado como enviado." : "Envio desmarcado.");
      qc.invalidateQueries({ queryKey: ["envio", eventoId] });
      qc.invalidateQueries({ queryKey: ["painel"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  if (q.isPending) return <EsqueletoLista />;
  if (q.isError) return <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />;

  const semLink = q.data.familias.filter((f) => !f.familia_links).length;
  const filtradas = q.data.familias.filter((f) => !pendentes || !f.familia_links?.enviado_em);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const mensagemDe = (f: Linha) =>
    preencher(q.data.mensagem, {
      responsavel: f.responsavel_nome,
      bailarinas: juntarNomes(f.bailarinas.filter((b) => b.ativa).map((b) => primeiroNome(b.nome))),
      link: f.familia_links ? `${window.location.origin}/f/${f.familia_links.token}` : "",
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-h-11 items-center gap-2">
          <Checkbox
            id="pendentes"
            checked={Boolean(pendentes)}
            onCheckedChange={(v) => navigate({ search: { pendentes: v ? true : undefined, pagina: undefined }, replace: true })}
          />
          <Label htmlFor="pendentes">Só não enviados</Label>
        </div>
        <Button className="min-h-11" disabled={gerar.isPending} onClick={() => gerar.mutate()}>
          <Link2 aria-hidden="true" />
          {gerar.isPending ? "Gerando..." : "Gerar links que faltam"}
        </Button>
      </div>
      {semLink > 0 && <SeloStatus tom="aviso">{semLink} famílias ainda sem link.</SeloStatus>}
      {!q.data.mensagem && <SeloStatus tom="erro">Falta o texto "Mensagem do link" em Conteúdos.</SeloStatus>}

      {filtradas.length === 0 ? (
        <EstadoVazio
          titulo={q.data.familias.length === 0 ? "Nenhuma família" : "Todos os links foram enviados"}
          {...(q.data.familias.length === 0 ? { texto: "Importe a planilha na aba Elenco e famílias." } : {})}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {visiveis.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-foreground">{f.responsavel_nome}</p>
                <p className="text-sm text-muted-foreground">
                  {juntarNomes(f.bailarinas.filter((b) => b.ativa).map((b) => primeiroNome(b.nome)))},{" "}
                  {whatsappExibir(f.whatsapp)}
                </p>
                <div className="mt-1">
                  {!f.familia_links ? (
                    <SeloStatus tom="erro">Sem link</SeloStatus>
                  ) : f.familia_links.enviado_em ? (
                    <SeloStatus tom="sucesso">Enviado em {dataHora(f.familia_links.enviado_em)}</SeloStatus>
                  ) : (
                    <SeloStatus tom="aviso">Não enviado</SeloStatus>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="min-h-11" disabled={!f.familia_links} onClick={() => setPreview(f)}>
                  <MessageCircle aria-hidden="true" />
                  Abrir no WhatsApp
                </Button>
                {f.familia_links && (
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    disabled={marcar.isPending}
                    onClick={() => marcar.mutate({ id: f.id, enviado: !f.familia_links!.enviado_em })}
                  >
                    {f.familia_links.enviado_em ? "Desmarcar envio" : "Marcar como enviado"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={pagina <= 1}
            onClick={() => navigate({ search: (s) => ({ ...s, pagina: pagina - 1 }) })}
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
            onClick={() => navigate({ search: (s) => ({ ...s, pagina: pagina + 1 }) })}
          >
            Próxima página
          </Button>
        </div>
      )}

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mensagem para {preview?.responsavel_nome}</DialogTitle>
          </DialogHeader>
          {preview && (
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-foreground">{mensagemDe(preview)}</pre>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setPreview(null)}>
              Fechar
            </Button>
            {preview && (
              <Button asChild className="min-h-11">
                <a
                  href={`https://wa.me/${preview.whatsapp}?text=${encodeURIComponent(mensagemDe(preview))}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setPreview(null)}
                >
                  Abrir no WhatsApp
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
