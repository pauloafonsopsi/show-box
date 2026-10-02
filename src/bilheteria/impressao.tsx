// Folhas A4 com 4 ingressos para recortar, sem cor de fundo, e lista de quem ainda não retirou.
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { EsqueletoLista, EstadoErro, EstadoVazio } from "@/design/coxia";
import { supabase } from "@/integrations/supabase/client";
import { data, hora, mensagemDeErro } from "@/lib/formato";
import { QrTexto } from "@/vendas/qr";

const TIPO: Record<string, string> = {
  meia_todos: "Meia-entrada",
  inteira: "Inteira",
  meia: "Meia-entrada",
  cortesia: "Cortesia",
};

const CSS_IMPRESSAO = `
@media print {
  @page { size: A4; margin: 10mm; }
  body * { visibility: hidden; }
  .area-impressao, .area-impressao * { visibility: visible; }
  .area-impressao { position: absolute; inset: 0; }
  .folha { break-after: page; }
  .nao-imprimir { display: none !important; }
}
`;

export function ImpressaoIngressos({
  eventoId,
  sessao,
  familia,
}: {
  eventoId: string;
  sessao?: string | undefined;
  familia?: string | undefined;
}) {
  const q = useQuery({
    queryKey: ["impressao", eventoId, sessao ?? "", familia ?? ""],
    queryFn: async () => {
      let consulta = supabase
        .from("ingressos")
        .select(
          "id, tipo, qr_token, entregue_em, sessao_id, sessoes(nome, data_hora), assentos(numero, rotulo_fila, setores(nome)), pedidos!inner(codigo, evento_id, familia_id, familias(responsavel_nome), eventos(nome))",
        )
        .eq("status", "ativo")
        .eq("pedidos.evento_id", eventoId)
        .limit(2000);
      if (sessao) consulta = consulta.eq("sessao_id", sessao);
      if (familia) consulta = consulta.eq("pedidos.familia_id", familia);
      const { data: linhas, error } = await consulta;
      if (error) throw error;
      return (linhas ?? []).sort((a, b) => (a.assentos?.numero ?? 0) - (b.assentos?.numero ?? 0));
    },
  });

  if (q.isLoading) return <EsqueletoLista />;
  if (q.error) return <EstadoErro mensagem={mensagemDeErro(q.error)} />;
  const lista = q.data ?? [];
  if (lista.length === 0) return <EstadoVazio titulo="Nenhum ingresso para imprimir" />;

  const folhas: (typeof lista)[] = [];
  for (let i = 0; i < lista.length; i += 4) folhas.push(lista.slice(i, i + 4));
  const pendentes = new Map<string, number>();
  for (const i of lista)
    if (!i.entregue_em) {
      const nome = i.pedidos?.familias?.responsavel_nome ?? `Pedido ${i.pedidos?.codigo}`;
      pendentes.set(nome, (pendentes.get(nome) ?? 0) + 1);
    }

  return (
    <div>
      <style>{CSS_IMPRESSAO}</style>
      <div className="nao-imprimir mb-4 flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground">
          {lista.length} ingressos em {folhas.length} folhas.
        </p>
        <Button className="min-h-11" onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>
      <div className="area-impressao">
        {folhas.map((f, n) => (
          <div
            key={n}
            className="folha mb-6 grid grid-cols-2 gap-0 border border-dashed border-border"
          >
            {f.map((i) => (
              <div
                key={i.id}
                className="flex min-h-[130mm] flex-col justify-between border border-dashed border-border p-4 text-foreground"
              >
                <div>
                  <div className="h-1 w-full border-t-2 border-foreground" aria-hidden="true" />
                  <p className="titulo-palco mt-3 text-xl">{i.pedidos?.eventos?.nome}</p>
                  <p className="mt-1">{i.sessoes?.nome}</p>
                  <p className="numeros">
                    {data(i.sessoes?.data_hora)} às {hora(i.sessoes?.data_hora)}
                  </p>
                  <p className="numeros mt-3 text-lg font-semibold">
                    {i.assentos?.setores?.nome}
                    {i.assentos?.rotulo_fila ? `, fila ${i.assentos.rotulo_fila}` : ""}, poltrona{" "}
                    {i.assentos?.numero}
                  </p>
                  <p className="text-sm">{TIPO[i.tipo] ?? i.tipo}</p>
                  <p className="numeros text-sm">Pedido {i.pedidos?.codigo}</p>
                </div>
                <div className="self-end">
                  <QrTexto
                    texto={i.qr_token}
                    tamanho={110}
                    rotulo={`QR da poltrona ${i.assentos?.numero}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <section className="nao-imprimir mt-8">
        <h2 className="text-lg font-semibold text-foreground">Ainda não retiraram</h2>
        {pendentes.size === 0 ? (
          <p className="text-muted-foreground">Todos retiraram.</p>
        ) : (
          <ul className="numeros mt-2 text-sm text-foreground">
            {[...pendentes.entries()].sort().map(([nome, n]) => (
              <li key={nome}>
                {nome}: {n}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
