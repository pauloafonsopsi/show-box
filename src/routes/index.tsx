import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Bilheteria de espetáculos" },
      {
        name: "description",
        content: "Bilheteria de espetáculos — em construção",
      },
      { property: "og:title", content: "Bilheteria de espetáculos" },
      {
        property: "og:description",
        content: "Bilheteria de espetáculos — em construção",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-2xl font-semibold tracking-tight text-foreground">
        Em construção
      </p>
    </div>
  );
}
