import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Proscenio } from "@/design/palco";
import { data, dataHora, dinheiro, hora } from "@/lib/formato";
import { useMapaSessao } from "@/vendas/mapa-sessao";
import { useEventoPublico, vendaPublicaAberta } from "@/vendas/evento-publico";
import { AvisoPalco, EsqueletoPalco, RodapePalco } from "@/vendas/pagina-palco";

export const Route = createFileRoute("/e/$slug/")({
  component: EventoPublico,
});

function Precos({ sessaoId }: { sessaoId: string }) {
  const { mapa } = useMapaSessao(sessaoId);
  if (!mapa) return null;
  return (
    <ul className="numeros mt-2 space-y-1 text-sm text-muted-foreground">
      {mapa.setores.map((s) => (
        <li key={s.id}>
          {s.nome}:{" "}
          {mapa.modo_preco === "unico" ? dinheiro(s.meia_todos) : `inteira ${dinheiro(s.inteira)}, meia ${dinheiro(s.meia)}`}
        </li>
      ))}
    </ul>
  );
}

function EventoPublico() {
  const { slug } = Route.useParams();
  const q = useEventoPublico(slug);
  if (q.isLoading) return <EsqueletoPalco />;
  const d = q.data;
  if (!d) return <AvisoPalco titulo="Espetáculo não encontrado" />;
  const aberta = vendaPublicaAberta(d.evento.status, d.janelas);
  const proxima = d.janelas.find((j) => new Date(j.inicio).getTime() > Date.now());

  return (
    <div>
      <Proscenio />
      <h1 className="titulo-palco mt-6 text-3xl text-foreground">{d.evento.nome}</h1>
      {!aberta ? (
        <p className="mt-3 text-foreground">
          {proxima ? `A venda ao público abre em ${dataHora(proxima.inicio)}.` : "A venda ao público não está aberta."}
        </p>
      ) : null}
      <div className="mt-6 space-y-4">
        {d.sessoes.map((s) => (
          <section key={s.id} className="superficie-palco p-4">
            <h2 className="titulo-palco text-2xl text-foreground">{s.nome}</h2>
            <p className="numeros text-sm text-muted-foreground">
              {data(s.data_hora)} às {hora(s.data_hora)}
            </p>
            <Precos sessaoId={s.id} />
            {aberta ? (
              <Button asChild className="mt-4 min-h-11">
                <Link to="/e/$slug/$sessaoId" params={{ slug, sessaoId: s.id }}>
                  Escolher lugares
                </Link>
              </Button>
            ) : null}
          </section>
        ))}
      </div>
      <RodapePalco slug={slug} />
    </div>
  );
}
