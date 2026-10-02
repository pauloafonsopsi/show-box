import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Cabecalho, EsqueletoLista } from "@/design/coxia";
import { useEventoAtual, useSessoesEvento } from "@/bilheteria/comum";
import { ImpressaoIngressos } from "@/bilheteria/impressao";

export const Route = createFileRoute("/bilheteria/impressao")({
  validateSearch: (s) =>
    z
      .object({
        evento: z.string().uuid().optional(),
        sessao: z.string().uuid().optional(),
        familia: z.string().uuid().optional(),
      })
      .parse(s),
  component: Impressao,
});

function Impressao() {
  const { sessao, familia } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { evento } = useEventoAtual();
  const sessoes = useSessoesEvento(evento?.id);
  if (!evento) return <EsqueletoLista />;
  return (
    <div>
      <div className="print:hidden">
        <Cabecalho
          titulo="Imprimir ingressos"
          trilha={[{ rotulo: "Bilheteria", to: "/bilheteria" }]}
        />
        <select
          aria-label="Sessão"
          className="mb-4 min-h-11 rounded-md border border-input bg-background px-3 text-[16px]"
          value={sessao ?? ""}
          onChange={(e) =>
            navigate({ search: (s) => ({ ...s, sessao: e.target.value || undefined }) })
          }
        >
          <option value="">Todas as sessões</option>
          {(sessoes.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </div>
      <ImpressaoIngressos eventoId={evento.id} sessao={sessao} familia={familia} />
    </div>
  );
}
