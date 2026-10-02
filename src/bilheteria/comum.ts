// Dados compartilhados pelas telas da Bilheteria (modo Coxia).
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export interface EventoBilheteria {
  id: string;
  nome: string;
  slug: string;
  meia_categorias: string[] | null;
  parcelamento_min_ingressos: number;
  parcelas_max: number;
}

export function useEventosEmVenda() {
  return useQuery({
    queryKey: ["bilheteria-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id, nome, slug, meia_categorias, parcelamento_min_ingressos, parcelas_max")
        .in("status", ["em_venda", "publicado"])
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventoBilheteria[];
    },
  });
}

/** Evento escolhido no topo (na URL); sem escolha, o mais recente em venda. */
export function useEventoAtual(): { evento: EventoBilheteria | null; carregando: boolean; eventos: EventoBilheteria[] } {
  const busca = useSearch({ strict: false }) as { evento?: string };
  const q = useEventosEmVenda();
  const eventos = q.data ?? [];
  const evento = eventos.find((e) => e.id === busca.evento) ?? eventos[0] ?? null;
  return { evento, carregando: q.isLoading, eventos };
}

export function useSessoesEvento(eventoId: string | undefined) {
  return useQuery({
    enabled: Boolean(eventoId),
    queryKey: ["bilheteria-sessoes", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes")
        .select("id, nome, data_hora")
        .eq("evento_id", eventoId as string)
        .eq("ativa", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaldos(eventoId: string | undefined) {
  return useQuery({
    enabled: Boolean(eventoId),
    queryKey: ["bilheteria-saldos", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("saldos_do_evento", { p_evento: eventoId as string });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useJanelas(eventoId: string | undefined) {
  return useQuery({
    enabled: Boolean(eventoId),
    queryKey: ["bilheteria-janelas", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("janelas").select("tipo, inicio, fim").eq("evento_id", eventoId as string);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function janelaHoje(janelas: Array<{ tipo: string; inicio: string; fim: string | null }>, tipo: string) {
  const agora = Date.now();
  return janelas.some((j) => j.tipo === tipo && new Date(j.inicio).getTime() <= agora && (!j.fim || new Date(j.fim).getTime() > agora));
}

export function semAcento(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export const FORMA_PRESENCIAL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  cartao: "Cartão online",
  cortesia: "Cortesia",
};
