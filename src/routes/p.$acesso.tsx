import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import { contextoPedido, pedidoPublico } from "@/lib/vendas.functions";
import { ConfirmacaoPedido } from "@/vendas/confirmacao";
import {
  AvisoPalco,
  EsqueletoPalco,
  PaginaPalco,
  RodapePalco,
  metaPrivada,
} from "@/vendas/pagina-palco";
import { PagamentoOnline } from "@/vendas/pagamento";

export const Route = createFileRoute("/p/$acesso")({
  ssr: false,
  head: () => ({ meta: metaPrivada("Seu pedido", "Pagamento e ingressos do seu pedido.") }),
  component: PaginaPedido,
});

function PaginaPedido() {
  const { acesso } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const buscarCtx = useServerFn(contextoPedido);
  const buscarPedido = useServerFn(pedidoPublico);
  const ctx = useQuery({
    queryKey: ["contexto-pedido", acesso],
    queryFn: () => buscarCtx({ data: { acesso } }),
  });
  const ped = useQuery({
    queryKey: ["pedido-publico", acesso],
    queryFn: () => buscarPedido({ data: { acesso } }),
  });
  const slug = ctx.data?.evento?.slug ?? null;

  const pago = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ["pedido-publico", acesso] }),
    [queryClient, acesso],
  );
  const voltar = useCallback(() => {
    if (slug) void navigate({ to: "/e/$slug", params: { slug } });
  }, [navigate, slug]);

  let corpo;
  if (ctx.isLoading || ped.isLoading) corpo = <EsqueletoPalco />;
  else if (!ctx.data || !ped.data)
    corpo = <AvisoPalco titulo="Pedido não encontrado" texto="Confira o link do pedido." />;
  else {
    const status = (ped.data as { status?: string }).status;
    corpo =
      status === "pago" || status === "pago_sem_lugar" ? (
        <ConfirmacaoPedido
          acesso={acesso}
          conteudos={ctx.data.conteudos}
          linkDoPedido={`${window.location.origin}/p/${acesso}`}
        />
      ) : (
        <PagamentoOnline
          acesso={acesso}
          conteudos={ctx.data.conteudos}
          vaiParaPedido={pago}
          voltarAosLugares={voltar}
        />
      );
  }

  return (
    <PaginaPalco chave={slug}>
      {corpo}
      <RodapePalco slug={slug} />
    </PaginaPalco>
  );
}
