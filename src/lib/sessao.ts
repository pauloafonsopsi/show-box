import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export type Papel = "admin" | "bilheteria" | "porta";

export function papeisQuery(userId: string) {
  return {
    queryKey: ["papeis", userId],
    staleTime: 60_000,
    queryFn: async (): Promise<Papel[]> => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as Papel);
    },
  };
}

/** Confere no carregamento da rota se a pessoa tem um dos papéis. Senão, manda para /entrar. */
export async function exigirPapel(queryClient: QueryClient, aceitos: Papel[]) {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw redirect({ to: "/entrar" });
  const papeis = await queryClient.fetchQuery(papeisQuery(user.id));
  if (!papeis.some((p) => aceitos.includes(p))) throw redirect({ to: "/entrar" });
  return { user, papeis };
}

export async function sair(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
}
