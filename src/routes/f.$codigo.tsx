import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PaginaPalco, metaPrivada } from "@/vendas/pagina-palco";
import { usePainelFamilia } from "@/vendas/familia";

export const Route = createFileRoute("/f/$codigo")({
  ssr: false,
  head: () => ({ meta: metaPrivada("Ingressos da família", "Escolha os lugares e veja os ingressos da sua família.") }),
  component: LayoutFamilia,
});

function LayoutFamilia() {
  const { codigo } = Route.useParams();
  const painel = usePainelFamilia(codigo);
  return (
    <PaginaPalco chave={painel.data?.evento.slug ?? null}>
      <Outlet />
    </PaginaPalco>
  );
}
