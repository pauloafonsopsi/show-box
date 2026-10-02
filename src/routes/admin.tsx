import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  History,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Settings,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { exigirPapel, sair } from "@/lib/sessao";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: ({ context }) => exigirPapel(context.queryClient, ["admin"]),
  head: () => ({
    meta: [
      { title: "Painel | Bilheteria" },
      { name: "description", content: "Administração da Bilheteria do Ballet Letícia Lobo." },
      { property: "og:title", content: "Painel | Bilheteria" },
      {
        property: "og:description",
        content: "Administração da Bilheteria do Ballet Letícia Lobo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const MENU = [
  { to: "/admin", rotulo: "Painel", Icone: LayoutDashboard, exato: true },
  { to: "/admin/eventos", rotulo: "Eventos", Icone: CalendarDays },
  { to: "/admin/locais", rotulo: "Locais e mapas", Icone: MapPinned },
  { to: "/admin/equipe", rotulo: "Equipe", Icone: Users },
  { to: "/admin/configuracoes", rotulo: "Configurações", Icone: Settings },
  { to: "/admin/auditoria", rotulo: "Auditoria", Icone: History },
] as const;

function AdminLayout() {
  const { user } = Route.useRouteContext();
  return (
    <SidebarProvider>
      <Menu email={user.email ?? ""} />
      <SidebarInset>
        <div className="flex min-h-14 items-center gap-2 border-b border-border px-3 md:hidden">
          <SidebarTrigger className="h-11 w-11" aria-label="Abrir menu" />
          <span className="font-medium text-foreground">Bilheteria</span>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function Menu({ email }: { email: string }) {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5 font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          Bilheteria
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MENU.map((m) => {
                const ativo =
                  "exato" in m
                    ? caminho === m.to || caminho === `${m.to}/`
                    : caminho.startsWith(m.to);
                return (
                  <SidebarMenuItem key={m.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={ativo}
                      tooltip={m.rotulo}
                      className="min-h-11"
                    >
                      <Link to={m.to} onClick={() => setOpenMobile(false)}>
                        <m.Icone aria-hidden="true" />
                        <span>{m.rotulo}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="truncate px-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
          {email}
        </p>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              className="min-h-11"
              onClick={async () => {
                await sair(queryClient);
                navigate({ to: "/entrar", replace: true });
              }}
            >
              <LogOut aria-hidden="true" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="hidden md:block">
          <SidebarTrigger className="h-11 w-11" aria-label="Recolher menu" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
