// Mapa da sessão em tempo real: leitura pública + atualização pelo Realtime.
// A única leitura direta do navegador é o status dos lugares; nada pessoal chega aqui.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Proscenio, GradeDePoltronas, SeloStatus, type CelulaGrade, type EstadoPoltrona } from "@/design/palco";
import { useIsMobile } from "@/hooks/use-mobile";
import { celulasDoMapa, type MapaSessao } from "./tipos";

export function chaveMapa(sessaoId: string) {
  return ["mapa-da-sessao", sessaoId] as const;
}

/** Carrega o mapa da sessão e o mantém atualizado (consulta de 10s + Realtime nos assentos). */
export function useMapaSessao(sessaoId: string | null | undefined) {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    enabled: Boolean(sessaoId),
    queryKey: chaveMapa(sessaoId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mapa_da_sessao", { p_sessao: sessaoId as string });
      if (error) throw new Error(error.message);
      return (data ?? null) as MapaSessao | null;
    },
    refetchInterval: 10_000,
  });

  // Realtime: qualquer mudança nos assentos da sessão rebusca o mapa (com uma pequena
  // espera para agrupar rajadas de mudanças na mesma passagem).
  const esperando = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!sessaoId) return;
    const canal = supabase
      .channel(`assentos-${sessaoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assentos", filter: `sessao_id=eq.${sessaoId}` }, () => {
        if (esperando.current) return;
        esperando.current = setTimeout(() => {
          esperando.current = null;
          void queryClient.invalidateQueries({ queryKey: ["mapa-da-sessao", sessaoId] });
        }, 350);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
      if (esperando.current) clearTimeout(esperando.current);
    };
  }, [sessaoId, queryClient]);

  return { mapa: consulta.data ?? null, carregando: consulta.isLoading, erro: consulta.error as Error | null };
}

const ROTULO_ESTADO: Record<EstadoPoltrona, string> = {
  livre: "livres",
  escolhida: "escolhidos",
  ocupada: "vendidos",
  "outra-pessoa": "reservados agora",
  bloqueada: "bloqueados",
};

export function MapaPoltronas({
  mapa,
  escolhidos,
  perdidos = [],
  maxEscolhidos = 0,
  onEscolher,
  semProscenio = false,
}: {
  mapa: MapaSessao;
  /** números escolhidos por quem está na tela (só um pedido de cada vez) */
  escolhidos: Set<number>;
  /** números que acabaram de ser perdidos na reserva atômica: piscam e depois somem */
  perdidos?: number[];
  /** 0 = sem limite; usado para bloquear o clique quando o limite é atingido */
  maxEscolhidos?: number;
  onEscolher?: (numero: number) => void;
  semProscenio?: boolean;
}) {
  const pequeno = useIsMobile();
  const [vista, setVista] = useState<"tudo" | string>("tudo");
  const [piscando, setPiscando] = useState(false);

  useEffect(() => {
    if (perdidos.length === 0) return;
    setPiscando(true);
    const t = setTimeout(() => setPiscando(false), 2200);
    return () => clearTimeout(t);
  }, [perdidos]);

  const conjunto = useMemo(() => new Set(perdidos), [perdidos]);

  // Estado no banco -> estado na poltrona.
  const estadoDe = (e: string): EstadoPoltrona =>
    e === "bloqueado" ? "bloqueada" : e === "vendido" ? "ocupada" : e === "reservado" ? "outra-pessoa" : "livre";

  const contagens = useMemo(() => {
    const c: Record<EstadoPoltrona, number> = { livre: 0, escolhida: 0, ocupada: 0, "outra-pessoa": 0, bloqueada: 0 };
    for (const a of mapa.assentos) c[estadoDe(a.estado)]++;
    c.escolhida = escolhidos.size;
    if (c.livre > 0) c.livre -= escolhidos.size;
    return c;
  }, [mapa, escolhidos]);

  const celulas: CelulaGrade[] = useMemo(() => {
    return celulasDoMapa(mapa, (a) => {
      const escolhida = escolhidos.has(a.numero);
      return {
        estado: escolhida ? "escolhida" : estadoDe(a.estado),
        destaque: piscando && conjunto.has(a.numero),
      };
    }).filter((c) => {
      if (c.tipo === "assento" && vista !== "tudo")
        return mapa.assentos.some((a) => a.setor_id === vista && a.linha === c.linha && a.coluna === c.coluna);
      return true;
    });
  }, [mapa, escolhidos, vista, piscando, conjunto]);

  const nomeVista = vista === "tudo" ? null : (mapa.setores.find((s) => s.id === vista)?.nome ?? null);

  const cheio = maxEscolhidos > 0 && escolhidos.size >= maxEscolhidos;

  const aoEscolher = useCallback(
    (numero: number) => {
      if (!onEscolher || cheio) return;
      onEscolher(numero);
    },
    [onEscolher, cheio],
  );

  return (
    <div>
      {!semProscenio ? <Proscenio /> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pequeno && mapa.setores.length > 0 ? (
          <select
            aria-label="Ver um setor do mapa"
            value={vista}
            onChange={(e) => setVista(e.target.value)}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-[16px]"
          >
            <option value="tudo">Mapa inteiro</option>
            {mapa.setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {(["livre", "escolhida", "outra-pessoa", "ocupada", "bloqueada"] as const).map((e) =>
            contagens[e] > 0 || e === "livre" || e === "escolhida" ? (
              <span key={e} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={
                    e === "livre"
                      ? "inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-poltrona-livre"
                      : e === "escolhida"
                        ? "inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-poltrona-escolhida bg-poltrona-escolhida"
                        : e === "ocupada"
                          ? "inline-block h-3 w-3 rounded-[4px] bg-poltrona-ocupada"
                          : e === "outra-pessoa"
                            ? "inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-dashed border-poltrona-escolhida"
                            : "inline-block h-3 w-3 rounded-[4px] border border-border"
                  }
                />
                {contagens[e]} {ROTULO_ESTADO[e]}
              </span>
            ) : null,
          )}
        </div>
      </div>
      {piscando && perdidos.length > 0 ? (
        <div className="mt-2">
          <SeloStatus tom="aviso">
            {perdidos.length === 1
              ? `A poltrona ${perdidos[0]} acabou de ser tomada por outra pessoa. Escolha outra.`
              : "Algumas poltronas que você escolheu acabaram de ser tomadas. Veja as marcadas."}
          </SeloStatus>
        </div>
      ) : null}
      <div className="mt-4">
        <GradeDePoltronas
          colunas={mapa.colunas}
          filas={mapa.filas}
          celulas={celulas}
          onEscolher={onEscolher ?? (() => undefined)}
          tamanhoMaximo={vista === "tudo" ? (pequeno ? 22 : 30) : 44}
          className={vista === "tudo" ? undefined : "overflow-x-auto pb-2"}
        />
      </div>
      {pequeno && vista !== "tudo" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Você está vendo só o setor {nomeVista}. Volte em “Mapa inteiro” para ver todos.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
        {mapa.setores.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.cor }} />
            {s.nome}
          </span>
        ))}
      </div>
    </div>
  );
}
