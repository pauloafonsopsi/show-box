import { createFileRoute, Link } from "@tanstack/react-router";

import { Proscenio } from "@/design/palco";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Bilheteria do Ballet Letícia Lobo" },
      {
        name: "description",
        content: "Ingressos com lugar marcado para os espetáculos do Ballet Letícia Lobo.",
      },
      { property: "og:title", content: "Bilheteria do Ballet Letícia Lobo" },
      {
        property: "og:description",
        content: "Ingressos com lugar marcado para os espetáculos do Ballet Letícia Lobo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  return (
    <main className="palco flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16">
        <Proscenio className="w-full" rotulo="Ballet Letícia Lobo" />
        <h1 className="titulo-palco mt-10 text-center text-4xl leading-tight sm:text-5xl">
          Bilheteria do Ballet Letícia Lobo
        </h1>
      </div>
      <footer className="flex justify-center pb-6">
        <Link
          to="/entrar"
          className="inline-flex min-h-11 items-center px-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Entrar
        </Link>
      </footer>
    </main>
  );
}
