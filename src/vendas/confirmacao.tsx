// Confirmação da compra online: ingressos com QR, detalhes e desistência em até 7 dias.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dataHora, dinheiro, mensagemDeErro } from "@/lib/formato";
import { desistirDaCompra, pedidoPublico } from "@/lib/vendas.functions";
import { Carteira, type IngressoCarteira } from "./carteira";
import { AvisoPalco, EsqueletoPalco } from "./pagina-palco";

interface PedidoPublico {
  codigo: string;
  status: string;
  valor_total_centavos: number;
  forma_pagamento: string | null;
  parcelas: number;
  pago_em: string | null;
  itens: Array<{ produto: string; quantidade: number; valor_unitario_centavos: number }>;
  ingressos: IngressoCarteira[];
  desistir_ate: string | null;
}

const FORMA: Record<string, string> = { pix: "PIX", cartao: "Cartão de crédito", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro" };

export function ConfirmacaoPedido({
  acesso,
  conteudos,
  linkDoPedido,
}: {
  acesso: string;
  conteudos: Record<string, string>;
  linkDoPedido?: string;
}) {
  const buscar = useServerFn(pedidoPublico);
  const desistir = useServerFn(desistirDaCompra);
  const queryClient = useQueryClient();
  const [detalhes, setDetalhes] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const q = useQuery({ queryKey: ["pedido-publico", acesso], queryFn: () => buscar({ data: { acesso } }) });
  if (q.isLoading) return <EsqueletoPalco />;
  const p = q.data as unknown as PedidoPublico | null;
  if (!p) return <AvisoPalco titulo="Pedido não encontrado" texto="Confira o link recebido." />;

  const podeDesistir = p.desistir_ate && new Date(p.desistir_ate) > new Date();

  return (
    <div>
      <h1 className="titulo-palco text-3xl text-foreground">Compra confirmada</h1>
      {p.status === "pago_sem_lugar" ? (
        <p className="mt-3 text-foreground">
          Seu pagamento entrou, mas os lugares não estavam mais livres. A recepção vai falar com você para resolver.
        </p>
      ) : (
        <>
          {conteudos["confirmacao"] ? <p className="mt-3 whitespace-pre-line text-foreground">{conteudos["confirmacao"]}</p> : null}
          {conteudos["lembrete_filmagem"] ? (
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{conteudos["lembrete_filmagem"]}</p>
          ) : null}
        </>
      )}

      {linkDoPedido ? (
        <section className="superficie-palco mt-6 p-4">
          <p className="text-sm text-muted-foreground">Link do pedido. Guarde para ver seus ingressos depois.</p>
          <p className="mt-1 select-all break-all text-foreground">{linkDoPedido}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                void navigator.clipboard.writeText(linkDoPedido).then(() => toast.success("Link copiado."));
              }}
            >
              Copiar link
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <a href={`https://wa.me/?text=${encodeURIComponent(linkDoPedido)}`} target="_blank" rel="noreferrer">
                Enviar para meu WhatsApp
              </a>
            </Button>
          </div>
        </section>
      ) : null}

      <h2 className="titulo-palco mt-8 text-2xl text-foreground">Seus ingressos</h2>
      <div className="mt-4">
        <Carteira ingressos={p.ingressos} />
      </div>

      <Button variant="outline" className="mt-6 min-h-11" onClick={() => setDetalhes(true)}>
        Detalhes da compra
      </Button>

      <Dialog open={detalhes} onOpenChange={setDetalhes}>
        <DialogContent className="palco">
          <DialogHeader>
            <DialogTitle>Pedido {p.codigo}</DialogTitle>
          </DialogHeader>
          <dl className="numeros grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-foreground">
            <dt className="text-muted-foreground">Ingressos</dt>
            <dd>{p.ingressos.length}</dd>
            {p.itens.map((i) => (
              <div key={i.produto} className="contents">
                <dt className="text-muted-foreground">{i.produto}</dt>
                <dd>
                  {i.quantidade} x {dinheiro(i.valor_unitario_centavos)}
                </dd>
              </div>
            ))}
            <dt className="text-muted-foreground">Total</dt>
            <dd>{dinheiro(p.valor_total_centavos)}</dd>
            <dt className="text-muted-foreground">Pagamento</dt>
            <dd>
              {FORMA[p.forma_pagamento ?? ""] ?? p.forma_pagamento}
              {p.parcelas > 1 ? ` em ${p.parcelas}x` : ""}
            </dd>
            <dt className="text-muted-foreground">Pago em</dt>
            <dd>{dataHora(p.pago_em)}</dd>
          </dl>
          {podeDesistir && conteudos["desistencia_linha"] ? (
            <button type="button" className="mt-4 min-h-11 text-left text-foreground underline underline-offset-4" onClick={() => setConfirmar(true)}>
              {conteudos["desistencia_linha"]}
            </button>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="palco">
          <DialogHeader>
            <DialogTitle>Desistir da compra</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-line text-foreground">{conteudos["desistencia_confirmar"] ?? ""}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="destructive"
              className="min-h-11"
              disabled={enviando}
              onClick={async () => {
                setEnviando(true);
                try {
                  await desistir({ data: { acesso } });
                  toast.success("Pedido de desistência enviado. A recepção vai concluir o estorno.");
                  setConfirmar(false);
                  setDetalhes(false);
                  void queryClient.invalidateQueries({ queryKey: ["pedido-publico", acesso] });
                } catch (e) {
                  toast.error(mensagemDeErro(e));
                } finally {
                  setEnviando(false);
                }
              }}
            >
              Confirmar desistência
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setConfirmar(false)}>
              Manter a compra
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
