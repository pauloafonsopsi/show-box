import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { exigirPapel, sair } from "@/lib/sessao";

export const Route = createFileRoute("/bilheteria")({
  ssr: false,
  beforeLoad: ({ context }) => exigirPapel(context.queryClient, ["admin", "bilheteria"]),
  head: () => ({
    meta: [
      { title: "Bilheteria | Recepção" },
      { name: "description", content: "Venda presencial na recepção do Ballet Letícia Lobo." },
      { property: "og:title", content: "Bilheteria | Recepção" },
      { property: "og:description", content: "Venda presencial na recepção do Ballet Letícia Lobo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Bilheteria,
});

function Bilheteria() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Bilheteria</h1>
        <p className="mt-2 text-muted-foreground">
          A venda na recepção chega no próximo bloco. Seu acesso já está pronto.
        </p>
        <Button
          variant="outline"
          className="mt-6 min-h-11"
          onClick={async () => {
            await sair(queryClient);
            navigate({ to: "/entrar", replace: true });
          }}
        >
          Sair
        </Button>
      </div>
    </main>
  );
}
