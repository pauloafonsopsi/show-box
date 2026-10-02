import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { textoLegal } from "@/lib/vendas.functions";
import { AvisoPalco, EsqueletoPalco, PaginaPalco } from "./pagina-palco";

export function TextoLegal({ tipo, slug }: { tipo: "termos" | "privacidade"; slug?: string }) {
  const buscar = useServerFn(textoLegal);
  const q = useQuery({ queryKey: ["texto-legal", tipo, slug ?? ""], queryFn: () => buscar({ data: { tipo, ...(slug ? { slug } : {}) } }) });
  const titulo = tipo === "termos" ? "Termos de compra" : "Política de privacidade";
  return (
    <PaginaPalco>
      {q.isLoading ? (
        <EsqueletoPalco />
      ) : !q.data ? (
        <AvisoPalco titulo={titulo} texto="Texto ainda não publicado." />
      ) : (
        <article>
          <h1 className="titulo-palco text-3xl text-foreground">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {q.data.evento ? `${q.data.evento}. ` : ""}Versão {q.data.versao}
          </p>
          <div className="mt-6 whitespace-pre-wrap text-foreground">{q.data.texto}</div>
        </article>
      )}
    </PaginaPalco>
  );
}
