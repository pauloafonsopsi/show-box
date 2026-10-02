import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ImpressaoIngressos } from "@/bilheteria/impressao";

export const Route = createFileRoute("/admin/eventos/$eventoId/impressao")({
  validateSearch: (s) =>
    z
      .object({ sessao: z.string().uuid().optional(), familia: z.string().uuid().optional() })
      .parse(s),
  component: ImpressaoAdmin,
});

function ImpressaoAdmin() {
  const { eventoId } = Route.useParams();
  const { sessao, familia } = Route.useSearch();
  return <ImpressaoIngressos eventoId={eventoId} sessao={sessao} familia={familia} />;
}
