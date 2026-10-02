// Escolha de lugares online (família e público): mapa ao vivo, barra fixa e reserva atômica.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { dinheiro, mensagemDeErro } from "@/lib/formato";
import { reservarOnline } from "@/lib/vendas.functions";
import { MapaPoltronas, useMapaSessao } from "./mapa-sessao";
import { estimarTotal, tiposDisponiveis } from "./tipos";
import { EsqueletoPalco, AvisoPalco } from "./pagina-palco";

export function EscolhaOnline({
  sessaoId,
  limite,
  tokenFamilia,
  aoReservar,
  textoLimite,
}: {
  sessaoId: string;
  limite: number;
  tokenFamilia?: string;
  aoReservar: (acesso: string) => void;
  textoLimite: string;
}) {
  const { mapa, carregando, erro } = useMapaSessao(sessaoId);
  const reservar = useServerFn(reservarOnline);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [perdidos, setPerdidos] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);

  if (carregando) return <EsqueletoPalco />;
  if (erro || !mapa)
    return (
      <AvisoPalco
        titulo="Não foi possível abrir o mapa"
        texto={erro ? mensagemDeErro(erro) : "Sessão não encontrada."}
      />
    );

  const tipo = tiposDisponiveis(mapa)[0] ?? "meia_todos";
  const lugares = [...escolhidos].map((n) => ({
    numero: n,
    setorId: mapa.assentos.find((a) => a.numero === n)?.setor_id ?? "",
    tipo,
  }));
  const total = estimarTotal(mapa.setores, lugares);

  const alternar = (n: number) => {
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(n)) novo.delete(n);
      else if (novo.size >= limite) {
        toast(textoLimite);
        return atual;
      } else novo.add(n);
      return novo;
    });
  };

  const continuar = async () => {
    setEnviando(true);
    try {
      const r = await reservar({
        data: {
          sessao: sessaoId,
          numeros: [...escolhidos],
          ...(tokenFamilia ? { tokenFamilia } : {}),
        },
      });
      if (r.ok && r.acesso_token) {
        aoReservar(r.acesso_token);
        return;
      }
      const tomados = r.perdidos ?? [];
      setEscolhidos((atual) => new Set([...atual].filter((n) => !tomados.includes(n))));
      setPerdidos(tomados);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <MapaPoltronas
        mapa={mapa}
        escolhidos={escolhidos}
        perdidos={perdidos}
        onEscolher={alternar}
      />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="numeros font-medium text-foreground">
              {escolhidos.size === 0
                ? "Toque nas poltronas livres"
                : `${escolhidos.size} de ${limite} lugares`}
            </p>
            {escolhidos.size > 0 ? (
              <p className="numeros text-sm text-muted-foreground">
                {[...escolhidos].sort((a, b) => a - b).join(", ")}
                {total !== null ? `. A partir de ${dinheiro(total)}` : ""}
              </p>
            ) : null}
          </div>
          <Button
            className="min-h-11"
            disabled={escolhidos.size === 0 || enviando}
            onClick={continuar}
          >
            {enviando ? "Reservando..." : "Continuar"}
          </Button>
        </div>
      </div>
    </>
  );
}
