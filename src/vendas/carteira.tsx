// Carteira de ingressos com QR (família, público e confirmação).
import { QrTexto } from "./qr";

export interface IngressoCarteira {
  sessao: string;
  numero: number;
  fila: string | null;
  setor: string;
  tipo: string;
  qr: string;
  entregue_em?: string | null;
  pedido?: string;
}

const TIPO: Record<string, string> = {
  meia_todos: "Meia-entrada",
  inteira: "Inteira",
  meia: "Meia-entrada",
  cortesia: "Cortesia",
};

export function Carteira({ ingressos }: { ingressos: IngressoCarteira[] }) {
  if (ingressos.length === 0)
    return <p className="text-muted-foreground">Nenhum ingresso ainda.</p>;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {ingressos.map((i) => (
        <li
          key={i.qr}
          className="ingresso flex flex-col overflow-hidden border border-primary/30 sm:flex-row"
        >
          <div className="min-w-0 flex-1 p-5 sm:pl-7">
            <p className="titulo-palco text-xl text-foreground">{i.sessao}</p>
            <p className="mt-1 text-sm text-muted-foreground">{i.setor}</p>
            <div className="numeros mt-4 flex items-end gap-6">
              {i.fila ? (
                <div>
                  <p className="text-sm text-muted-foreground">Fila</p>
                  <p className="text-3xl font-semibold text-primary">{i.fila}</p>
                </div>
              ) : null}
              <div>
                <p className="text-sm text-muted-foreground">Poltrona</p>
                <p className="text-3xl font-semibold text-primary">{i.numero}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {TIPO[i.tipo] ?? i.tipo}
              {i.pedido ? `. Pedido ${i.pedido}` : ""}
              {i.entregue_em ? ". Retirado" : ""}
            </p>
          </div>
          <div className="flex items-center justify-center border-t border-dashed border-primary/40 p-5 sm:border-l sm:border-t-0">
            <div className="rounded-md bg-card p-3">
              <QrTexto texto={i.qr} tamanho={128} rotulo={`QR do ingresso da poltrona ${i.numero}`} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
