import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Cabecalho, Campo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/formato";

export const Route = createFileRoute("/admin/locais/")({
  head: () => ({ meta: [{ title: "Locais e mapas | Bilheteria" }] }),
  component: Locais,
});

type Local = {
  id: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
  mapas: { id: string; nome: string; status: string }[];
};

function Locais() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [local, setLocal] = useState<Local | "novo" | null>(null);
  const [novoMapa, setNovoMapa] = useState<Local | null>(null);

  const q = useQuery({
    queryKey: ["locais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locais")
        .select("id, nome, endereco, ativo, mapas(id, nome, status)")
        .order("nome");
      if (error) throw error;
      return data as Local[];
    },
  });

  const salvarLocal = useMutation({
    mutationFn: async (fd: FormData) => {
      const dados = {
        nome: String(fd.get("nome")).trim(),
        endereco: String(fd.get("endereco") || "").trim() || null,
        ativo: fd.get("ativo") === "on",
      };
      const l = local !== "novo" ? local : null;
      const { error } = l
        ? await supabase.from("locais").update(dados).eq("id", l.id)
        : await supabase.from("locais").insert(dados);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Local salvo.");
      setLocal(null);
      qc.invalidateQueries({ queryKey: ["locais"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const criarMapa = useMutation({
    mutationFn: async (fd: FormData) => {
      const { data, error } = await supabase
        .from("mapas")
        .insert({
          local_id: novoMapa!.id,
          nome: String(fd.get("nome")).trim(),
          colunas: Number(fd.get("colunas")),
          filas: Number(fd.get("filas")),
        })
        .select("id, local_id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (m) => {
      toast.success("Mapa criado. Agora crie os setores e desenhe os lugares.");
      setNovoMapa(null);
      qc.invalidateQueries({ queryKey: ["locais"] });
      navigate({ to: "/admin/locais/$localId/mapas/$mapaId", params: { localId: m.local_id, mapaId: m.id } });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const enviar = (fn: (fd: FormData) => void, pendente: boolean) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendente) fn(new FormData(e.currentTarget));
  };
  const l = local && local !== "novo" ? local : null;

  return (
    <>
      <Cabecalho
        titulo="Locais e mapas"
        trilha={[{ rotulo: "Painel", to: "/admin" }]}
        acao={
          <Button className="min-h-11" onClick={() => setLocal("novo")}>
            <Plus aria-hidden="true" />
            Novo local
          </Button>
        }
      />
      {q.isPending ? (
        <EsqueletoLista altura="h-28" />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio titulo="Nenhum local" texto="Cadastre o teatro ou espaço onde o espetáculo acontece." />
      ) : (
        <div className="space-y-4">
          {q.data.map((x) => (
            <section key={x.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-foreground">{x.nome}</h2>
                  <p className="text-sm text-muted-foreground">{x.endereco ?? "Sem endereço"}</p>
                  {!x.ativo && <SeloStatus tom="neutro">Inativo</SeloStatus>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="min-h-11" onClick={() => setLocal(x)}>
                    Editar local
                  </Button>
                  <Button className="min-h-11" onClick={() => setNovoMapa(x)}>
                    <Plus aria-hidden="true" />
                    Novo mapa
                  </Button>
                </div>
              </div>
              {x.mapas.length === 0 ? (
                <p className="mt-3 text-muted-foreground">Nenhum mapa neste local.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border border-t border-border">
                  {x.mapas.map((m) => (
                    <li key={m.id}>
                      <Link
                        to="/admin/locais/$localId/mapas/$mapaId"
                        params={{ localId: x.id, mapaId: m.id }}
                        className="flex min-h-12 items-center justify-between gap-2 py-2 hover:bg-muted/50"
                      >
                        <span className="font-medium text-foreground">{m.nome}</span>
                        {m.status === "pronto" ? (
                          <SeloStatus tom="sucesso">Pronto</SeloStatus>
                        ) : (
                          <SeloStatus tom="aviso">Rascunho</SeloStatus>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <Dialog open={local !== null} onOpenChange={(o) => !o && setLocal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{l ? "Editar local" : "Novo local"}</DialogTitle>
          </DialogHeader>
          <form key={l?.id ?? "novo"} onSubmit={enviar((fd) => salvarLocal.mutate(fd), salvarLocal.isPending)} className="space-y-4">
            <Campo id="l-nome" name="nome" rotulo="Nome" required defaultValue={l?.nome ?? ""} />
            <Campo id="l-end" name="endereco" rotulo="Endereço" defaultValue={l?.endereco ?? ""} />
            <div className="flex min-h-11 items-center gap-3">
              <Switch id="l-ativo" name="ativo" defaultChecked={l?.ativo ?? true} />
              <Label htmlFor="l-ativo">Local ativo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setLocal(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="min-h-11" disabled={salvarLocal.isPending}>
                {salvarLocal.isPending ? "Salvando..." : "Salvar local"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={novoMapa !== null} onOpenChange={(o) => !o && setNovoMapa(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo mapa em {novoMapa?.nome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={enviar((fd) => criarMapa.mutate(fd), criarMapa.isPending)} className="space-y-4">
            <Campo id="m-nome" name="nome" rotulo="Nome do mapa" required placeholder="Ex.: Plateia" />
            <div className="grid grid-cols-2 gap-4">
              <Campo id="m-col" name="colunas" rotulo="Colunas" type="number" min={1} max={60} required defaultValue={20} />
              <Campo id="m-fil" name="filas" rotulo="Filas" type="number" min={1} max={40} required defaultValue={15} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setNovoMapa(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="min-h-11" disabled={criarMapa.isPending}>
                {criarMapa.isPending ? "Criando..." : "Criar mapa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
