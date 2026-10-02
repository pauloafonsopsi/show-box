import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/eventos/$eventoId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/admin/eventos/$eventoId/visao-geral", params, replace: true });
  },
});
