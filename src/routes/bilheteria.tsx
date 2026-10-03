import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Armchair, ChevronLeft, QrCode, ReceiptText, Search, Ticket, Wallet } from "lucide-react";

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
  { to: "/bilheteria", rotulo: "Buscar família", Icone: Search },
  { to: "/bilheteria/avulsa", rotulo: "Venda avulsa", Icone: Armchair },
  { to: "/bilheteria/pedidos", rotulo: "Pedidos", Icone: ReceiptText },
  { to: "/bilheteria/retirada", rotulo: "Retirada", Icone: QrCode },
  { to: "/bilheteria/caixa", rotulo: "Caixa do dia", Icone: Wallet },
] as const;

function LayoutBilheteria() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { papeis } = Route.useRouteContext();
  const { evento, eventos } = useEventoAtual();
  const search = evento ? { evento: evento.id } : {};
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b-2 border-primary/50 bg-card print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
          {papeis.includes("admin") ? (
            <Link
              to="/admin"
              aria-label="Voltar à Gestão"
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Gestão
            </Link>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Ticket className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="font-semibold text-foreground">Frente de Caixa</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                {evento ? evento.nome : "Sem evento"}
              </p>
            </div>
          </div>
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
        <nav
          aria-label="Seções da Frente de Caixa"
          className="mx-auto grid max-w-7xl grid-cols-5 gap-1 px-2 pb-2 sm:gap-2 sm:px-4"
        >
          {ABAS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              search={search}
              activeOptions={{ exact: a.to === "/bilheteria" }}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-1 text-center text-xs text-muted-foreground sm:flex-row sm:gap-2 sm:text-sm"
              activeProps={{
                className: "border-primary bg-primary/15 font-semibold text-primary",
              }}
            >
              <a.Icone className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{a.rotulo}</span>
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
