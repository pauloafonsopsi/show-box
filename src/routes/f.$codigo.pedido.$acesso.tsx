import { createFileRoute, Link } from "@tanstack/react-router";

import { usePainelFamilia } from "@/vendas/familia";
import { ConfirmacaoPedido } from "@/vendas/confirmacao";
import { EsqueletoPalco, RodapePalco } from "@/vendas/pagina-palco";

export const Route = createFileRoute("/f/$codigo/pedido/$acesso")({
  component: PedidoFamilia,
});

function PedidoFamilia() {
  const { codigo, acesso } = Route.useParams();
  const q = usePainelFamilia(codigo);
  if (q.isLoading) return <EsqueletoPalco />;
  return (
    <div>
      <Link
        to="/f/$codigo"
        params={{ codigo }}
        className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4"
      >
        Voltar para a página da família
      </Link>
      <div className="mt-4">
        <ConfirmacaoPedido acesso={acesso} conteudos={q.data?.conteudos ?? {}} />
      </div>
      <RodapePalco slug={q.data?.evento.slug ?? null} />
    </div>
  );
}
