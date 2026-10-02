import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { usePainelFamilia, produtosParaVenda } from "@/vendas/familia";
import { EsqueletoPalco } from "@/vendas/pagina-palco";
import { PagamentoOnline } from "@/vendas/pagamento";

export const Route = createFileRoute("/f/$codigo/pagamento/$acesso")({
  component: PagamentoFamilia,
});

function PagamentoFamilia() {
  const { codigo, acesso } = Route.useParams();
  const navigate = useNavigate();
  const q = usePainelFamilia(codigo);
  const irPedido = useCallback(
    () => navigate({ to: "/f/$codigo/pedido/$acesso", params: { codigo, acesso }, replace: true }),
    [navigate, codigo, acesso],
  );
  const voltar = useCallback(
    () => navigate({ to: "/f/$codigo", params: { codigo } }),
    [navigate, codigo],
  );
  if (q.isLoading || !q.data) return <EsqueletoPalco />;
  return (
    <PagamentoOnline
      acesso={acesso}
      conteudos={q.data.conteudos}
      produtos={produtosParaVenda(q.data)}
      sessoesEntrega={q.data.sessoes.map((s) => ({ id: s.id, nome: s.nome }))}
      vaiParaPedido={irPedido}
      voltarAosLugares={voltar}
    />
  );
}
