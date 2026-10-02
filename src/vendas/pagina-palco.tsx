// Moldura das páginas da família e do público (modo Palco).
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Cortina } from "@/design/palco";
import { Skeleton } from "@/components/ui/skeleton";

/** Meta das páginas com código no caminho: fora de buscadores e sem enviar a URL para outros sites. */
export function metaPrivada(titulo: string, descricao: string) {
  return [
    { title: titulo },
    { name: "description", content: descricao },
    { property: "og:title", content: titulo },
    { property: "og:description", content: descricao },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ];
}

export function PaginaPalco({ chave, children }: { chave?: string | null; children: ReactNode }) {
  return (
    <div className="palco min-h-screen">
      {chave ? <Cortina chave={chave} /> : null}
      <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6">{children}</main>
    </div>
  );
}

export function RodapePalco({ slug }: { slug?: string | null }) {
  return (
    <footer className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
      {slug ? (
        <Link to="/termos/$slug" params={{ slug }} className="inline-flex min-h-11 items-center underline underline-offset-4">
          Termos de compra
        </Link>
      ) : null}
      <Link to="/privacidade" className="inline-flex min-h-11 items-center underline underline-offset-4">
        Privacidade
      </Link>
    </footer>
  );
}

export function EsqueletoPalco() {
  return (
    <div className="space-y-4" aria-label="Carregando">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export function AvisoPalco({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="superficie-palco mx-auto max-w-md p-6 text-center">
      <h1 className="titulo-palco text-2xl text-foreground">{titulo}</h1>
      {texto ? <p className="mt-3 whitespace-pre-line text-muted-foreground">{texto}</p> : null}
      {acao ? <div className="mt-6 flex flex-wrap justify-center gap-3">{acao}</div> : null}
    </div>
  );
}
