import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { Cabecalho, EsqueletoLista, EstadoVazio } from "@/design/coxia";
import { useEventoAtual } from "@/bilheteria/comum";
import { VendaPresencial } from "@/bilheteria/venda-presencial";

export const Route = createFileRoute("/bilheteria/avulsa")({
  validateSearch: (s) => z.object({ evento: z.string().uuid().optional(), sessao: z.string().uuid().optional() }).parse(s),
  component: Avulsa,
});

function Avulsa() {
  const { sessao } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { evento, carregando } = useEventoAtual();
  if (carregando) return <EsqueletoLista />;
  if (!evento) return <EstadoVazio titulo="Nenhum evento em venda" />;
  return (
    <div>
      <Cabecalho titulo="Venda avulsa" trilha={[{ rotulo: "Bilheteria", to: "/bilheteria" }]} descricao="Venda sem família ligada." />
      <VendaPresencial evento={evento} sessaoId={sessao} aoMudarSessao={(id) => navigate({ search: (s) => ({ ...s, sessao: id }) })} />
    </div>
  );
}
