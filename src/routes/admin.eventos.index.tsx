import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cabecalho, Campo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { gerarSlug, mensagemDeErro } from "@/lib/formato";
import { STATUS_EVENTO } from "@/lib/rotulos";

export const Route = createFileRoute("/admin/eventos/")({
  component: Eventos,
});

function Eventos() {
  const [aberto, setAberto] = useState(false);
  const q = useQuery({
    queryKey: ["eventos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id, nome, slug, status")
        .order("criado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <Cabecalho
        titulo="Eventos"
        trilha={[{ rotulo: "Painel", to: "/admin" }]}
        acao={
          <Button className="min-h-11" onClick={() => setAberto(true)}>
            <Plus aria-hidden="true" />
            Novo evento
          </Button>
        }
      />
      {q.isPending ? (
        <EsqueletoLista />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio titulo="Nenhum evento" texto="Crie o primeiro evento." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {q.data.map((ev) => {
            const st = STATUS_EVENTO[ev.status] ?? STATUS_EVENTO["rascunho"]!;
            return (
              <li key={ev.id}>
                <Link
                  to="/admin/eventos/$eventoId/visao-geral"
                  params={{ eventoId: ev.id }}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <span>
                    <span className="block font-medium text-foreground">{ev.nome}</span>
                    <span className="block text-sm text-muted-foreground">/{ev.slug}</span>
                  </span>
                  <SeloStatus tom={st.tom}>{st.texto}</SeloStatus>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <NovoEvento aberto={aberto} onFechar={() => setAberto(false)} />
    </>
  );
}

function NovoEvento({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .insert({ nome: nome.trim(), slug: slug.trim() })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um evento com este endereço. Mude o endereço.");
        throw error;
      }
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["eventos"] });
      toast.success("Evento criado. Agora crie as sessões.");
      onFechar();
      navigate({ to: "/admin/eventos/$eventoId/visao-geral", params: { eventoId: id } });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!criar.isPending) criar.mutate();
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <Campo
            id="ev-nome"
            rotulo="Nome do evento"
            required
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (!slugEditado) setSlug(gerarSlug(e.target.value));
            }}
          />
          <Campo
            id="ev-slug"
            rotulo="Endereço"
            ajuda="Letras minúsculas, números e hífen."
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => {
              setSlugEditado(true);
              setSlug(e.target.value);
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={criar.isPending}>
              {criar.isPending ? "Criando..." : "Criar evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
