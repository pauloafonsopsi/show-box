import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { exigirPapel, sair } from "@/lib/sessao";
import { useEventoAtual } from "@/bilheteria/comum";

export const Route = createFileRoute("/bilheteria")({
  ssr: false,
  validateSearch: (s) => z.object({ evento: z.string().uuid().optional() }).parse(s),
  beforeLoad: ({ context }) => exigirPapel(context.queryClient, ["admin", "bilheteria"]),
  head: () => ({
    meta: [
      { title: "Bilheteria | Recepção" },
      { name: "description", content: "Venda presencial na recepção do Ballet Letícia Lobo." },
      { property: "og:title", content: "Bilheteria | Recepção" },
      {
        property: "og:description",
        content: "Venda presencial na recepção do Ballet Letícia Lobo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LayoutBilheteria,
});

const ABAS = [
  { to: "/bilheteria", rotulo: "Busca" },
  { to: "/bilheteria/avulsa", rotulo: "Venda avulsa" },
  { to: "/bilheteria/pedidos", rotulo: "Pedidos" },
  { to: "/bilheteria/retirada", rotulo: "Retirada" },
  { to: "/bilheteria/caixa", rotulo: "Caixa" },
] as const;

function LayoutBilheteria() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { papeis } = Route.useRouteContext();
  const { evento, eventos } = useEventoAtual();
  const search = evento ? { evento: evento.id } : {};
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <span className="mr-2 font-semibold text-foreground">Frente de Caixa</span>
          <nav aria-label="Seções da Bilheteria" className="flex flex-wrap gap-1">
            {ABAS.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                search={search}
                activeOptions={{ exact: a.to === "/bilheteria" }}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-muted-foreground"
                activeProps={{ className: "bg-secondary font-medium text-foreground" }}
              >
                {a.rotulo}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {eventos.length > 1 ? (
              <select
                aria-label="Evento"
                className="min-h-11 rounded-md border border-input bg-background px-3 text-[16px]"
                value={evento?.id ?? ""}
                onChange={(e) => navigate({ to: ".", search: { evento: e.target.value } as never })}
              >
                {eventos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            ) : evento ? (
              <span className="text-sm text-muted-foreground">{evento.nome}</span>
            ) : null}
            {papeis.includes("admin") ? (
              <Link
                to="/admin"
                className="inline-flex min-h-11 items-center rounded-md border border-primary/40 px-3 text-primary"
              >
                Gestão
              </Link>
            ) : null}
            <Button
              variant="outline"
              className="min-h-11"
              onClick={async () => {
                await sair(queryClient);
                navigate({ to: "/entrar", replace: true });
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
