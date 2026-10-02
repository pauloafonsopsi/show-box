// Ajudantes de servidor: banco com chave de serviço e API da Pagar.me v5.
// Carregados só dentro dos handlers; nunca entram no pacote do navegador.
import type { Database } from "@/integrations/supabase/types";

type ErroBanco = { message?: string };

export function mensagemBanco(e: unknown): string {
  const m = (e as ErroBanco | null)?.message ?? "";
  if (m) return m;
  return "Algo deu errado no servidor. Tente de novo.";
}

/** Chama uma função do banco com a chave de serviço. O erro chega em português e é repassado. */
export async function rpcAdmin<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: T | null; error: ErroBanco | null }>)(
    nome,
    args,
  );
  if (error) throw new Error(mensagemBanco(error));
  return data as T;
}

export async function comChaveServico(): Promise<ReturnType<typeof import("@supabase/supabase-js").createClient<Database>>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ------------------------------------------------------------------ */
/* Pagar.me v5                                                         */
/* ------------------------------------------------------------------ */

const PAGARME = "https://api.pagar.me/core/v5";

async function chaves() {
  const chave = process.env["PAGARME_SECRET_KEY"];
  if (!chave) throw new Error("A chave de pagamento não está configurada. Fale com o administrador.");
  return chave;
}

export async function pagarmeGet<T>(caminho: string): Promise<T> {
  const chave = await chaves();
  const res = await fetch(`${PAGARME}${caminho}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${chave}:`).toString("base64")}` },
  });
  const corpo = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new ErroPagarme(mensagemPagarme(corpo, res.status));
  return corpo as T;
}

export async function pagarmePost<T>(caminho: string, corpo: unknown): Promise<T> {
  const chave = await chaves();
  const res = await fetch(`${PAGARME}${caminho}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${chave}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  });
  const resposta = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new ErroPagarme(mensagemPagarme(resposta, res.status));
  return resposta as T;
}

export async function pagarmeDelete<T>(caminho: string): Promise<T> {
  const chave = await chaves();
  const res = await fetch(`${PAGARME}${caminho}`, {
    method: "DELETE",
    headers: { Authorization: `Basic ${Buffer.from(`${chave}:`).toString("base64")}` },
  });
  const resposta = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new ErroPagarme(mensagemPagarme(resposta, res.status));
  return resposta as T;
}

export class ErroPagarme extends Error {}

function mensagemPagarme(corpo: unknown, status: number): string {
  const c = corpo as { message?: string; errors?: Array<{ message?: string; field?: string }> } | null;
  const primeira = c?.errors?.[0]?.message;
  return primeira ?? c?.message ?? `A operadora de pagamento respondeu com erro ${status}.`;
}
