import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { dadosEventoPublico } from "@/lib/vendas.functions";

export function useEventoPublico(slug: string) {
  const buscar = useServerFn(dadosEventoPublico);
  return useQuery({
    queryKey: ["evento-publico", slug],
    queryFn: () => buscar({ data: { slug } }),
  });
}

export function vendaPublicaAberta(
  status: string,
  janelas: Array<{ inicio: string; fim: string | null }>,
) {
  const agora = Date.now();
  return (
    status === "em_venda" &&
    janelas.some(
      (j) => new Date(j.inicio).getTime() <= agora && (!j.fim || new Date(j.fim).getTime() > agora),
    )
  );
}
