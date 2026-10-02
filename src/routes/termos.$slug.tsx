import { createFileRoute } from "@tanstack/react-router";

import { TextoLegal } from "@/vendas/texto-legal";

export const Route = createFileRoute("/termos/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Termos de compra" },
      { name: "description", content: "Termos de compra dos ingressos do espetáculo." },
      { property: "og:title", content: "Termos de compra" },
      { property: "og:description", content: "Termos de compra dos ingressos do espetáculo." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <TextoLegal tipo="termos" slug={Route.useParams().slug} />,
});
