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
    <ul className="grid gap-4 sm:grid-cols-2">
      {ingressos.map((i) => (
        <li key={i.qr} className="ingresso flex items-center gap-4 p-4 pl-6">
          <div className="min-w-0 flex-1">
            <p className="titulo-palco text-xl text-foreground">{i.sessao}</p>
            <p className="numeros mt-1 text-foreground">
              {i.setor}
              {i.fila ? `, fila ${i.fila}` : ""}, poltrona {i.numero}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {TIPO[i.tipo] ?? i.tipo}
              {i.pedido ? `. Pedido ${i.pedido}` : ""}
              {i.entregue_em ? ". Retirado" : ""}
            </p>
          </div>
          <div className="rounded-sm bg-card p-1">
            <QrTexto texto={i.qr} tamanho={96} rotulo={`QR do ingresso da poltrona ${i.numero}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
