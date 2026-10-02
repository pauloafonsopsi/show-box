import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { data, hora } from "@/lib/formato";
import { EscolhaOnline } from "@/vendas/escolha-online";
import { useEventoPublico, vendaPublicaAberta } from "@/vendas/evento-publico";
import { AvisoPalco, EsqueletoPalco } from "@/vendas/pagina-palco";

export const Route = createFileRoute("/e/$slug/$sessaoId")({
  component: EscolherPublico,
});

function EscolherPublico() {
  const { slug, sessaoId } = Route.useParams();
  const navigate = useNavigate();
  const q = useEventoPublico(slug);
  if (q.isLoading) return <EsqueletoPalco />;
  const d = q.data;
  const s = d?.sessoes.find((x) => x.id === sessaoId);
  if (!d || !s) return <AvisoPalco titulo="Sessão não encontrada" />;
  if (!vendaPublicaAberta(d.evento.status, d.janelas))
    return <AvisoPalco titulo="Venda fechada" texto="A venda ao público não está aberta agora." />;
  const limite = d.evento.limite_por_pedido ?? 1;
  return (
    <div>
      <Link
        to="/e/$slug"
        params={{ slug }}
        className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4"
      >
        Voltar
      </Link>
      <h1 className="titulo-palco mt-2 text-3xl text-foreground">{s.nome}</h1>
      <p className="numeros text-muted-foreground">
        {s.data_hora ? `${data(s.data_hora)} às ${hora(s.data_hora)}` : "Data a definir"}. Até {limite} lugares por compra.
      </p>
      <div className="mt-4">
        <EscolhaOnline
          sessaoId={sessaoId}
          limite={limite}
          textoLimite={`Cada compra pode ter até ${limite} lugares.`}
          aoReservar={(acesso) => navigate({ to: "/p/$acesso", params: { acesso } })}
        />
      </div>
    </div>
  );
}
