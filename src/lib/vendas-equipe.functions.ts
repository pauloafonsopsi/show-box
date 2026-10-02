// Server functions da equipe: Bilheteria, trocas, cortesias, caixa, retirada e estorno.
// Autenticam com o login da atendente ou do admin; o banco confere o papel por dentro.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = {
  supabase: {
    rpc: (f: "has_role", a: { _user_id: string; _role: string }) => Promise<{ data: boolean | null; error: unknown }>;
  };
  userId: string;
};

async function exigirAdmin(context: unknown) {
  const { supabase, userId } = context as Ctx;
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Não foi possível conferir sua permissão.");
  if (!data) throw new Error("Somente administradores podem aprovar estornos.");
  return true;
}

export const reservarPresencial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessao: z.string().uuid(),
        numeros: z.array(z.number().int().min(1).max(9999)).min(1).max(20),
        familia: z.string().uuid().optional(),
        pedido: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (context as unknown as Ctx).supabase.rpc("has_role", {
      _user_id: (context as unknown as Ctx).userId,
      _role: "admin",
    });
    if (error) throw new Error("Não foi possível conferir sua permissão.");
    if (!r) throw new Error("Sem permissão.");
    return chamarBanco(context, "reservar_presencial", {
      p_sessao: data.sessao,
      p_numeros: data.numeros,
      p_familia: data.familia ?? null,
      p_pedido: data.pedido ?? null,
    });
  });
