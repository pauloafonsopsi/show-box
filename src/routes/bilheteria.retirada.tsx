import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Cabecalho, EstadoVazio } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { mensagemDeErro } from "@/lib/formato";
import { buscarParaRetirada, marcarEntregues } from "@/lib/vendas-equipe.functions";
import { useEventoAtual } from "@/bilheteria/comum";

export const Route = createFileRoute("/bilheteria/retirada")({
  component: Retirada,
});

interface Resultado {
  familia_id: string | null;
  responsavel: string | null;
  ingressos: Array<{ id: string; sessao: string; numero: number; fila: string | null; setor: string; tipo: string; pedido: string; entregue_em: string | null }>;
}

function Leitor({ aoLer }: { aoLer: (t: string) => void }) {
  const ativo = useRef<{ stop: () => Promise<void> } | null>(null);
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    if (!ligado) return;
    let cancelado = false;
    void import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelado) return;
      const leitor = new Html5Qrcode("leitor-qr");
      ativo.current = leitor;
      leitor
        .start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, (texto) => {
          aoLer(texto);
          setLigado(false);
        }, () => undefined)
        .catch(() => {
          toast.error("Não foi possível abrir a câmera. Digite o código.");
          setLigado(false);
        });
    });
    return () => {
      cancelado = true;
      void ativo.current?.stop().catch(() => undefined);
      ativo.current = null;
    };
  }, [ligado, aoLer]);
  return (
    <div>
      <Button variant="outline" className="min-h-11" onClick={() => setLigado((l) => !l)}>
        {ligado ? "Fechar câmera" : "Ler QR pela câmera"}
      </Button>
      {ligado ? <div id="leitor-qr" className="mt-3 max-w-sm overflow-hidden rounded-md border border-border" /> : null}
    </div>
  );
}

function Retirada() {
  const { evento } = useEventoAtual();
  const buscar = useServerFn(buscarParaRetirada);
  const marcar = useServerFn(marcarEntregues);
  const [codigo, setCodigo] = useState("");
  const [res, setRes] = useState<Resultado | null | undefined>(undefined);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  const procurar = async (c: string) => {
    if (c.trim().length < 4) return;
    setEnviando(true);
    try {
      const r = (await buscar({ data: { codigo: c.trim() } })) as unknown as Resultado | null;
      setRes(r);
      setMarcados(new Set((r?.ingressos ?? []).filter((i) => !i.entregue_em).map((i) => i.id)));
      setCodigo("");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const entregar = async () => {
    setEnviando(true);
    try {
      const n = await marcar({ data: { ingressos: [...marcados], entregue: true } });
      toast.success(`${n} ingressos marcados como entregues.`);
      setRes(undefined);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho titulo="Retirada de ingressos" trilha={[{ rotulo: "Bilheteria", to: "/bilheteria" }]} />
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void procurar(codigo);
        }}
      >
        <Input autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código do QR ou do pedido" aria-label="Código" className="h-12 flex-1 text-[16px]" />
        <Button type="submit" className="min-h-11" disabled={enviando}>
          Buscar
        </Button>
      </form>
      <p className="mt-2 text-sm text-muted-foreground">
        Para buscar pelo nome, use a{" "}
        <Link to="/bilheteria" search={evento ? { evento: evento.id } : {}} className="underline underline-offset-4">
          busca de famílias
        </Link>
        .
      </p>
      <div className="mt-4">
        <Leitor aoLer={(t) => void procurar(t)} />
      </div>

      {res === null ? <div className="mt-6"><EstadoVazio titulo="Nada encontrado com este código" /></div> : null}
      {res ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">{res.responsavel ?? "Pedido avulso"}</h2>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {res.ingressos.map((i) => (
              <li key={i.id} className="flex min-h-11 items-center gap-3 px-3 py-2">
                <Checkbox
                  id={`r-${i.id}`}
                  checked={marcados.has(i.id)}
                  disabled={Boolean(i.entregue_em)}
                  onCheckedChange={(v) =>
                    setMarcados((m) => {
                      const n = new Set(m);
                      if (v) n.add(i.id);
                      else n.delete(i.id);
                      return n;
                    })
                  }
                />
                <label htmlFor={`r-${i.id}`} className="numeros flex-1 text-sm text-foreground">
                  {i.sessao}, {i.setor}
                  {i.fila ? `, fila ${i.fila}` : ""}, poltrona {i.numero}. Pedido {i.pedido}
                </label>
                {i.entregue_em ? <SeloStatus tom="neutro">Entregue</SeloStatus> : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={marcados.size === 0 || enviando} onClick={entregar}>
              Marcar {marcados.size} como entregues
            </Button>
            {res.familia_id && evento ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/bilheteria/impressao" search={{ evento: evento.id, familia: res.familia_id }}>
                  Imprimir ingressos da família
                </Link>
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
