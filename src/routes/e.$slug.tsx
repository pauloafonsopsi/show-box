import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PaginaPalco, metaPrivada } from "@/vendas/pagina-palco";

export const Route = createFileRoute("/e/$slug")({
  ssr: false,
  head: () => ({ meta: metaPrivada("Ingressos do espetáculo", "Escolha seus lugares e compre os ingressos do espetáculo.") }),
  component: () => {
    const { slug } = Route.useParams();
    return (
      <PaginaPalco chave={slug}>
        <Outlet />
      </PaginaPalco>
    );
  },
});
