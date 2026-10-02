import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Cabecalho,
  Campo,
  classeCampo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/design/coxia";
import { convidarPessoa, listarEquipe, removerAcesso, trocarPapel } from "@/lib/equipe.functions";
import { dataHora, mensagemDeErro } from "@/lib/formato";
import { PAPEL } from "@/lib/rotulos";

export const Route = createFileRoute("/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe | Bilheteria" }] }),
  component: Equipe,
});

type PapelT = "admin" | "bilheteria" | "porta";
const PAPEIS: PapelT[] = ["admin", "bilheteria", "porta"];

function Equipe() {
  const qc = useQueryClient();
  const listar = useServerFn(listarEquipe);
  const convidar = useServerFn(convidarPessoa);
  const trocar = useServerFn(trocarPapel);
  const remover = useServerFn(removerAcesso);
  const [convite, setConvite] = useState(false);
  const [tirar, setTirar] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["equipe"], queryFn: () => listar() });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["equipe"] });

  const mConvidar = useMutation({
    mutationFn: (v: { email: string; papel: PapelT }) => convidar({ data: v }),
    onSuccess: (r) => {
      toast.success(
        r.convidado ? "Convite enviado por e-mail." : "Papel acrescentado a quem já tinha conta.",
      );
      setConvite(false);
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });
  const mTrocar = useMutation({
    mutationFn: (v: { email: string; de: PapelT; para: PapelT }) => trocar({ data: v }),
    onSuccess: () => {
      toast.success("Papel trocado.");
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });
  const mRemover = useMutation({
    mutationFn: (email: string) => remover({ data: { email } }),
    onSuccess: () => {
      toast.success("Acesso removido. A conta continua existindo, sem papel.");
      setTirar(null);
      invalidar();
    },
    onError: (e) => {
      toast.error(mensagemDeErro(e));
      setTirar(null);
    },
  });

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!mConvidar.isPending)
      mConvidar.mutate({
        email: String(fd.get("email")),
        papel: String(fd.get("papel")) as PapelT,
      });
  }

  return (
    <>
      <Cabecalho
        titulo="Equipe"
        trilha={[{ rotulo: "Painel", to: "/admin" }]}
        acao={
          <Button className="min-h-11" onClick={() => setConvite(true)}>
            <UserPlus aria-hidden="true" />
            Convidar pessoa
          </Button>
        }
      />
      {q.isPending ? (
        <EsqueletoLista />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EstadoVazio titulo="Ninguém na equipe" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {q.data.map((p) => (
            <li
              key={p.email}
              className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium text-foreground">{p.email}</p>
                <p className="text-sm text-muted-foreground">
                  {p.ultimo_acesso
                    ? `Último acesso em ${dataHora(p.ultimo_acesso)}`
                    : "Ainda não entrou"}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {p.papeis.map((papel) => (
                  <div key={papel} className="space-y-1">
                    <Label htmlFor={`pp-${p.email}-${papel}`} className="sr-only">
                      Papel de {p.email}
                    </Label>
                    <select
                      id={`pp-${p.email}-${papel}`}
                      className={classeCampo + " w-40"}
                      value={papel}
                      disabled={mTrocar.isPending}
                      onChange={(e) =>
                        mTrocar.mutate({
                          email: p.email,
                          de: papel as PapelT,
                          para: e.target.value as PapelT,
                        })
                      }
                    >
                      {PAPEIS.map((x) => (
                        <option key={x} value={x} disabled={x !== papel && p.papeis.includes(x)}>
                          {PAPEL[x]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <Button variant="outline" className="min-h-11" onClick={() => setTirar(p.email)}>
                  Remover acesso
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={convite} onOpenChange={setConvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar pessoa</DialogTitle>
          </DialogHeader>
          <form onSubmit={enviar} className="space-y-4">
            <Campo
              id="c-email"
              name="email"
              type="email"
              rotulo="E-mail"
              autoComplete="off"
              required
            />
            <div className="space-y-1.5">
              <Label htmlFor="c-papel">Papel</Label>
              <select id="c-papel" name="papel" className={classeCampo} defaultValue="bilheteria">
                {PAPEIS.map((x) => (
                  <option key={x} value={x}>
                    {PAPEL[x]}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setConvite(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="min-h-11" disabled={mConvidar.isPending}>
                {mConvidar.isPending ? "Convidando..." : "Convidar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={tirar !== null} onOpenChange={(o) => !o && setTirar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o acesso de {tirar}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa perde todos os papéis e não entra mais no painel nem na bilheteria. A conta
              não é apagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={mRemover.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (tirar) mRemover.mutate(tirar);
              }}
            >
              {mRemover.isPending ? "Removendo..." : "Remover acesso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
