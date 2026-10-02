import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Cabecalho, EsqueletoLista, EstadoErro } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { eventoQuery } from "@/lib/consultas";
import { mensagemDeErro } from "@/lib/formato";
import { STATUS_EVENTO } from "@/lib/rotulos";

export const Route = createFileRoute("/admin/eventos/$eventoId")({
  component: EventoLayout,
});

const ABAS = [
  { to: "/admin/eventos/$eventoId/visao-geral", rotulo: "Visão geral" },
  { to: "/admin/eventos/$eventoId/sessoes", rotulo: "Sessões" },
  { to: "/admin/eventos/$eventoId/precos", rotulo: "Preços e calendário" },
  { to: "/admin/eventos/$eventoId/elenco", rotulo: "Elenco e famílias" },
  { to: "/admin/eventos/$eventoId/envio", rotulo: "Envio de links" },
  { to: "/admin/eventos/$eventoId/adicionais", rotulo: "Adicionais" },
  { to: "/admin/eventos/$eventoId/pedidos", rotulo: "Pedidos" },
  { to: "/admin/eventos/$eventoId/conteudos", rotulo: "Conteúdos" },
] as const;

function EventoLayout() {
  const { eventoId } = Route.useParams();
  const q = useQuery(eventoQuery(eventoId));

  return (
    <>
      {q.isPending ? (
        <EsqueletoLista linhas={1} altura="h-16" />
      ) : q.isError ? (
        <EstadoErro mensagem={mensagemDeErro(q.error)} onTentar={() => q.refetch()} />
      ) : (
        <Cabecalho
          titulo={q.data.nome}
          trilha={[
            { rotulo: "Painel", to: "/admin" },
            { rotulo: "Eventos", to: "/admin/eventos" },
          ]}
          acao={
            <SeloStatus tom={(STATUS_EVENTO[q.data.status] ?? STATUS_EVENTO["rascunho"]!).tom}>
              {(STATUS_EVENTO[q.data.status] ?? STATUS_EVENTO["rascunho"]!).texto}
            </SeloStatus>
          }
        />
      )}
      <nav aria-label="Seções do evento" className="-mx-4 mb-6 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-1">
          {ABAS.map((a) => (
            <li key={a.to}>
              <Link
                to={a.to}
                params={{ eventoId }}
                className="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-muted-foreground hover:text-foreground"
                activeProps={{ className: "border-primary font-medium text-foreground" }}
              >
                {a.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </>
  );
}
