import { supabase } from "@/integrations/supabase/client";

export function eventoQuery(eventoId: string) {
  return {
    queryKey: ["evento", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select(
          "id, nome, slug, status, fatura_cartao, cota_por_participante, limite_por_pedido, tempo_reserva_min, parcelamento_min_ingressos, parcelas_max, meia_percentual, meia_categorias",
        )
        .eq("id", eventoId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Evento não encontrado. Volte para a lista de eventos.");
      return data;
    },
  };
}

export function sessoesQuery(eventoId: string) {
  return {
    queryKey: ["sessoes", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes")
        .select("id, nome, data_hora, abertura_portas, mapa_id, mapa_congelado_em, ativa, ordem, mapas(nome, locais(nome))")
        .eq("evento_id", eventoId)
        .order("ordem");
      if (error) throw error;
      return data;
    },
  };
}

/** Setores dos mapas usados nas sessões do evento (para preços). */
export function setoresDoEventoQuery(eventoId: string) {
  return {
    queryKey: ["setores-evento", eventoId],
    queryFn: async () => {
      const { data: sess, error } = await supabase.from("sessoes").select("mapa_id").eq("evento_id", eventoId);
      if (error) throw error;
      const mapas = Array.from(new Set((sess ?? []).map((s) => s.mapa_id).filter(Boolean))) as string[];
      if (mapas.length === 0) return [];
      const { data, error: e2 } = await supabase
        .from("setores")
        .select("id, nome, cor, ordem, mapa_id")
        .in("mapa_id", mapas)
        .order("ordem");
      if (e2) throw e2;
      return data;
    },
  };
}
