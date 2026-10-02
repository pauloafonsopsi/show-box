// Gestão da equipe. Só administradores. A chave de serviço só é carregada dentro dos handlers.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Papel = z.enum(["admin", "bilheteria", "porta"]);
const Email = z.string().trim().toLowerCase().email("E-mail inválido.").max(254);

type Ctx = { supabase: { rpc: (...a: never[]) => unknown }; userId: string };

/** Confere no servidor, com has_role e o id do usuário do token, se quem chama é admin. */
async function exigirAdmin(context: unknown) {
  const { supabase, userId } = context as Ctx & {
    supabase: { rpc: (f: "has_role", a: { _user_id: string; _role: string }) => Promise<{ data: boolean | null; error: unknown }> };
  };
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Não foi possível conferir sua permissão.");
  if (!data) throw new Error("Sem permissão.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof exigirAdmin>>;

async function todosUsuarios(admin: Admin) {
  const lista: { id: string; email?: string | undefined; last_sign_in_at?: string | undefined }[] = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw new Error("Não foi possível ler a equipe.");
    lista.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return lista;
}

async function idPorEmail(admin: Admin, email: string) {
  return (await todosUsuarios(admin)).find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
}

function erroDoBanco(e: { message?: string } | null): never {
  const m = e?.message ?? "";
  if (m.includes("último administrador")) throw new Error("Não é possível remover o último administrador.");
  throw new Error("Não foi possível salvar. Tente de novo.");
}

export const listarEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await exigirAdmin(context);
    const [usuarios, papeis] = await Promise.all([todosUsuarios(admin), admin.from("user_roles").select("user_id, role")]);
    if (papeis.error) throw new Error("Não foi possível ler a equipe.");
    const porUsuario = new Map<string, string[]>();
    for (const p of papeis.data) porUsuario.set(p.user_id, [...(porUsuario.get(p.user_id) ?? []), p.role]);
    return usuarios
      .filter((u) => porUsuario.has(u.id))
      .map((u) => ({
        email: u.email ?? "",
        papeis: (porUsuario.get(u.id) ?? []).sort(),
        ultimo_acesso: u.last_sign_in_at ?? null,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  });

export const convidarPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: Email, papel: Papel }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await exigirAdmin(context);
    let id = await idPorEmail(admin, data.email);
    let convidado = false;
    if (!id) {
      const origem = new URL(getRequest().url).origin;
      const { data: r, error } = await admin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${origem}/entrar` });
      if (error) throw new Error("Não foi possível enviar o convite para este e-mail.");
      id = r.user.id;
      convidado = true;
    }
    const { error } = await admin
      .from("user_roles")
      .upsert({ user_id: id, role: data.papel }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) erroDoBanco(error);
    return { convidado };
  });

export const trocarPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: Email, de: Papel, para: Papel }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await exigirAdmin(context);
    const id = await idPorEmail(admin, data.email);
    if (!id) throw new Error("Pessoa não encontrada.");
    if (data.de === data.para) return { ok: true };
    const r1 = await admin
      .from("user_roles")
      .upsert({ user_id: id, role: data.para }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (r1.error) erroDoBanco(r1.error);
    const r2 = await admin.from("user_roles").delete().eq("user_id", id).eq("role", data.de);
    if (r2.error) {
      await admin.from("user_roles").delete().eq("user_id", id).eq("role", data.para);
      erroDoBanco(r2.error);
    }
    return { ok: true };
  });

/** Remove o papel (ou todos os papéis). Nunca apaga o usuário. */
export const removerAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: Email, papel: Papel.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await exigirAdmin(context);
    const id = await idPorEmail(admin, data.email);
    if (!id) throw new Error("Pessoa não encontrada.");
    let q = admin.from("user_roles").delete().eq("user_id", id);
    if (data.papel) q = q.eq("role", data.papel);
    const { error } = await q;
    if (error) erroDoBanco(error);
    return { ok: true };
  });

/** E-mails de quem aparece na auditoria. Só admin. */
export const emailsDeQuem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await exigirAdmin(context);
    const nomes: Record<string, string> = {};
    await Promise.all(
      [...new Set(data.ids)].map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id);
        if (u?.user?.email) nomes[id] = u.user.email;
      }),
    );
    return nomes;
  });
