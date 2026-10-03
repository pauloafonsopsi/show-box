// Escolha de lugares online (família e público): mapa ao vivo, barra fixa e reserva atômica.
// Aceita uma ou várias sessões: a pessoa troca de sessão pelas abas e tudo vira um único pedido.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { dinheiro, mensagemDeErro } from "@/lib/formato";
import { reservarOnline } from "@/lib/vendas.functions";
import { cn } from "@/lib/utils";
import { MapaPoltronas, useMapaSessao } from "./mapa-sessao";
import { estimarTotal, tiposDisponiveis } from "./tipos";
import { EsqueletoPalco, AvisoPalco } from "./pagina-palco";

export type SessaoEscolha = {
  id: string;
  rotulo: string;
  limite: number;
  textoLimite: string;
};

export function EscolhaOnline({
  sessoes,
  sessaoInicial,
  tokenFamilia,
  aoReservar,
}: {
  sessoes: SessaoEscolha[];
  sessaoInicial?: string;
  tokenFamilia?: string;
  aoReservar: (acesso: string) => void;
}) {
  const [ativa, setAtiva] = useState(
    sessoes.find((s) => s.id === sessaoInicial)?.id ?? sessoes[0]?.id ?? "",
  );
  // A lista de sessões é fixa durante a tela, então a ordem dos hooks não muda.
  const mapas = sessoes.map((s) => ({ s, ...useMapaSessao(s.id) }));
  const reservar = useServerFn(reservarOnline);
  const [escolhidos, setEscolhidos] = useState<Record<string, Set<number>>>({});
  const [perdidos, setPerdidos] = useState<Record<string, number[]>>({});
  const [acesso, setAcesso] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  const atual = mapas.find((m) => m.s.id === ativa) ?? mapas[0];
  if (!atual) return <AvisoPalco titulo="Nenhuma sessão disponível" />;

  const doDia = (id: string) => escolhidos[id] ?? new Set<number>();
  const totalLugares = sessoes.reduce((n, s) => n + doDia(s.id).size, 0);

  let total: number | null = 0;
  for (const m of mapas) {
    const set = doDia(m.s.id);
    if (set.size === 0) continue;
    if (!m.mapa) {
      total = null;
      break;
    }
    const mapa = m.mapa;
    const tipo = tiposDisponiveis(mapa)[0] ?? "meia_todos";
    const t = estimarTotal(
      mapa.setores,
      [...set].map((n) => ({
        numero: n,
        setorId: mapa.assentos.find((a) => a.numero === n)?.setor_id ?? "",
        tipo,
      })),
    );
    if (t === null) {
      total = null;
      break;
    }
    total += t;
  }

  const alternar = (n: number) => {
    const s = atual.s;
    setEscolhidos((tudo) => {
      const novo = new Set(tudo[s.id] ?? []);
      if (novo.has(n)) novo.delete(n);
      else if (novo.size >= s.limite) {
        toast(s.textoLimite);
        return tudo;
      } else novo.add(n);
      return { ...tudo, [s.id]: novo };
    });
  };

  const continuar = async () => {
    setEnviando(true);
    let token = acesso;
    try {
      for (const s of sessoes) {
        const nums = [...doDia(s.id)];
        if (nums.length === 0) continue;
        const r = await reservar({
          data: {
            sessao: s.id,
            numeros: nums,
            ...(tokenFamilia ? { tokenFamilia } : {}),
            ...(token ? { acessoPedido: token } : {}),
          },
        });
        if (r.ok && r.acesso_token) {
          token = r.acesso_token;
          setAcesso(token);
          continue;
        }
        const tomados = r.perdidos ?? [];
        setEscolhidos((tudo) => ({
          ...tudo,
          [s.id]: new Set(nums.filter((n) => !tomados.includes(n))),
        }));
        setPerdidos((p) => ({ ...p, [s.id]: tomados }));
        setAtiva(s.id);
        toast.error(`Alguns lugares de ${s.rotulo} acabaram de ser escolhidos. Escolha outros.`);
        return;
      }
      if (token) aoReservar(token);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const resumo = sessoes
    .filter((s) => doDia(s.id).size > 0)
    .map((s) => `${s.rotulo}: ${[...doDia(s.id)].sort((a, b) => a - b).join(", ")}`)
    .join(". ");

  return (
    <>
      {sessoes.length > 1 ? (
        <div role="tablist" aria-label="Sessões" className="mb-4 grid grid-cols-2 gap-2">
          {sessoes.map((s) => {
            const sel = s.id === atual.s.id;
            const qtd = doDia(s.id).size;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={sel}
                onClick={() => setAtiva(s.id)}
                className={cn(
                  "min-h-11 rounded-xl border px-3 py-2 text-left transition-colors",
                  sel
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                <span className="block font-medium">{s.rotulo}</span>
                <span className="numeros block text-sm">
                  {qtd} de {s.limite} escolhidos
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="numeros mb-3 text-muted-foreground">{atual.s.textoLimite}</p>

      {atual.carregando ? (
        <EsqueletoPalco />
      ) : atual.erro || !atual.mapa ? (
        <AvisoPalco
          titulo="Não foi possível abrir o mapa"
          texto={atual.erro ? mensagemDeErro(atual.erro) : "Sessão não encontrada."}
        />
      ) : (
        <MapaPoltronas
          key={atual.s.id}
          mapa={atual.mapa}
          escolhidos={doDia(atual.s.id)}
          perdidos={perdidos[atual.s.id] ?? []}
          onEscolher={alternar}
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="numeros font-medium text-foreground">
              {totalLugares === 0
                ? "Toque nas poltronas livres"
                : `${totalLugares} ${totalLugares === 1 ? "lugar" : "lugares"}${total !== null ? `, a partir de ${dinheiro(total)}` : ""}`}
            </p>
            {resumo ? (
              <p className="numeros truncate text-sm text-muted-foreground">{resumo}</p>
            ) : null}
          </div>
          <Button className="min-h-11" disabled={totalLugares === 0 || enviando} onClick={continuar}>
            {enviando ? "Reservando..." : "Continuar"}
          </Button>
        </div>
      </div>
    </>
  );
}
