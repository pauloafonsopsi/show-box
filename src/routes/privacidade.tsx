import { createFileRoute } from "@tanstack/react-router";

import { TextoLegal } from "@/vendas/texto-legal";

export const Route = createFileRoute("/privacidade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Política de privacidade" },
      { name: "description", content: "Como tratamos os dados de quem compra ingressos." },
      { property: "og:title", content: "Política de privacidade" },
      { property: "og:description", content: "Como tratamos os dados de quem compra ingressos." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <TextoLegal tipo="privacidade" />,
});
