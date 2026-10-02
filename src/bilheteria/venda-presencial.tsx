// Venda na recepção: mapa ao vivo, reserva atômica, tipos, adicionais e cobrança sem gateway.
// A cota nunca bloqueia a atendente: só avisa.
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EsqueletoLista } from "@/design/coxia";
import { SeloStatus } from "@/design/palco";
import { supabase } from "@/integrations/supabase/client";
import { centavosDeTexto, dinheiro, mensagemDeErro, preencher } from "@/lib/formato";
import {
  emitirCortesia,
  liberarReservaEquipe,
  previaPedido,
  registrarVendaPresencial,
  reservarPresencial,
} from "@/lib/vendas-equipe.functions";
import { MapaPoltronas, useMapaSessao } from "@/vendas/mapa-sessao";
import {
  EscolhaAdicionais,
  EscolhaLugares,
  type AdicionalEscolhido,
  type ProdutoVenda,
} from "@/vendas/selecao";
import { tiposDisponiveis, type LugarEscolhido } from "@/vendas/tipos";
import {
  FORMA_PRESENCIAL,
  janelaHoje,
  useJanelas,
  useSessoesEvento,
  type EventoBilheteria,
} from "./comum";

export interface FamiliaVenda {
  id: string;
  responsavel: string;
  whatsapp: string;
  saldos: Record<string, number>;
  temQuebraNozes: boolean;
}

function useProdutos(eventoId: string) {
  return useQuery({
    queryKey: ["bilheteria-produtos", eventoId],
    queryFn: async (): Promise<ProdutoVenda[]> => {
      const { data, error } = await supabase
        .from("produtos")
        .select(
          "id, nome, descricao, foto_url, preco_antecipado_centavos, preco_cheio_centavos, produto_datas(id, data, vagas, ativa)",
        )
        .eq("evento_id", eventoId)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []).map((p) => {
        const datas = (p.produto_datas ?? []).filter((d) => d.ativa);
        return {
          id: p.id,
          nome: p.nome,
          descricao: p.descricao,
          foto_url: p.foto_url,
          preco: p.preco_antecipado_centavos ?? p.preco_cheio_centavos,
          tem_datas: datas.length > 0,
          datas: datas.map((d) => ({ id: d.id, data: d.data, vagas_livres: d.vagas })),
        };
      });
    },
  });
}

export function VendaPresencial({
  evento,
  sessaoId,
  aoMudarSessao,
  familia,
}: {
  evento: EventoBilheteria;
  sessaoId: string | undefined;
  aoMudarSessao: (id: string) => void;
  familia?: FamiliaVenda;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessoes = useSessoesEvento(evento.id);
  const janelas = useJanelas(evento.id);
  const produtos = useProdutos(evento.id);
  const sessao = sessaoId ?? sessoes.data?.[0]?.id;
  const { mapa } = useMapaSessao(sessao);

  const reservar = useServerFn(reservarPresencial);
  const cortesia = useServerFn(emitirCortesia);
  const previa = useServerFn(previaPedido);
  const registrar = useServerFn(registrarVendaPresencial);
  const liberar = useServerFn(liberarReservaEquipe);

  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [perdidos, setPerdidos] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState<{ id: string; codigo: string } | null>(null);
  const [lugares, setLugares] = useState<LugarEscolhido[]>([]);
  const [adicionais, setAdicionais] = useState<AdicionalEscolhido[]>([]);
  const [forma, setForma] = useState<"dinheiro" | "pix" | "debito" | "credito">("dinheiro");
  const [parcelas, setParcelas] = useState(1);
  const [recebido, setRecebido] = useState("");
  const [feito, setFeito] = useState<{
    total: number;
    troco: number | null;
    numeros: number[];
  } | null>(null);
  const [abrirCortesia, setAbrirCortesia] = useState(false);
  const [motivo, setMotivo] = useState("");

  const saldo = familia && sessao ? (familia.saldos[sessao] ?? 0) : null;
  const livreDeCota =
    janelaHoje(janelas.data ?? [], "quebra_nozes") || janelaHoje(janelas.data ?? [], "presencial");
  const excedente = saldo !== null && !livreDeCota ? Math.max(0, escolhidos.size - saldo) : 0;
  const avisoPacote =
    familia && janelaHoje(janelas.data ?? [], "quebra_nozes") && !familia.temQuebraNozes;

  const ingressosPayload = lugares.map((l) => ({
    numero: l.numero,
    sessao_id: sessao as string,
    tipo: l.tipo,
    ...(l.tipo === "meia" && l.categoriaMeia ? { categoria_meia: l.categoriaMeia } : {}),
  }));
  const adicionaisPayload = adicionais
    .filter((a) => a.quantidade > 0)
    .map((a) => ({
      produto_id: a.produtoId,
      quantidade: a.quantidade,
      ...(a.sessaoEntregaId ? { sessao_entrega_id: a.sessaoEntregaId } : {}),
      ...(a.produtoDataId ? { produto_data_id: a.produtoDataId } : {}),
    }));

  const calc = useQuery({
    enabled: Boolean(pedido) && lugares.length > 0,
    queryKey: [
      "previa",
      pedido?.id,
      JSON.stringify(ingressosPayload),
      JSON.stringify(adicionaisPayload),
    ],
    queryFn: () =>
      previa({
        data: { pedido: pedido!.id, ingressos: ingressosPayload, adicionais: adicionaisPayload },
      }),
    retry: false,
  });
  const total = (calc.data?.["valor_total_centavos"] as number | undefined) ?? null;
  const recebidoCent = centavosDeTexto(recebido);
  const troco =
    forma === "dinheiro" && recebidoCent !== null && total !== null ? recebidoCent - total : null;
  const podeParcelar = forma === "credito" && lugares.length >= evento.parcelamento_min_ingressos;

  const nomesSessoes = useMemo(
    () => (sessoes.data ?? []).map((s) => ({ id: s.id, nome: s.nome })),
    [sessoes.data],
  );

  const alternar = (n: number) =>
    setEscolhidos((a) => {
      const novo = new Set(a);
      if (novo.has(n)) novo.delete(n);
      else novo.add(n);
      return novo;
    });

  const tirarPerdidos = (tomados: number[]) => {
    setEscolhidos((a) => new Set([...a].filter((n) => !tomados.includes(n))));
    setPerdidos(tomados);
    toast.warning(`Lugares tomados agora: ${tomados.join(", ")}. Os demais continuam escolhidos.`);
  };

  const reservarECobrar = async () => {
    if (!sessao || !mapa) return;
    setEnviando(true);
    try {
      const r = await reservar({
        data: { sessao, numeros: [...escolhidos], ...(familia ? { familia: familia.id } : {}) },
      });
      if (!r.ok || !r.pedido_id) return tirarPerdidos(r.perdidos ?? []);
      const tipo = tiposDisponiveis(mapa)[0] ?? "meia_todos";
      setLugares(
        [...escolhidos].map((n) => ({
          numero: n,
          setorId: mapa.assentos.find((a) => a.numero === n)?.setor_id ?? "",
          tipo,
        })),
      );
      setAdicionais([]);
      setPedido({ id: r.pedido_id, codigo: r.codigo ?? "" });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const desistir = async () => {
    if (!pedido) return;
    try {
      await liberar({ data: { pedido: pedido.id } });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
    setPedido(null);
  };

  const registrarVenda = async () => {
    if (!pedido) return;
    setEnviando(true);
    try {
      const r = await registrar({
        data: {
          pedido: pedido.id,
          ingressos: ingressosPayload,
          adicionais: adicionaisPayload,
          forma,
          parcelas: podeParcelar ? parcelas : 1,
          ...(forma === "dinheiro" && recebidoCent !== null
            ? { valorRecebidoCentavos: recebidoCent }
            : {}),
        },
      });
      setFeito({
        total: Number(r["valor_total_centavos"] ?? 0),
        troco: (r["troco_centavos"] as number | null) ?? null,
        numeros: lugares.map((l) => l.numero),
      });
      setPedido(null);
      setEscolhidos(new Set());
      void queryClient.invalidateQueries({ queryKey: ["bilheteria-saldos"] });
      void queryClient.invalidateQueries({ queryKey: ["bilheteria-familia"] });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const emitir = async () => {
    if (!sessao) return;
    setEnviando(true);
    try {
      const r = await cortesia({
        data: {
          sessao,
          numeros: [...escolhidos],
          motivo,
          ...(familia ? { familia: familia.id } : {}),
        },
      });
      if (!r.ok) return tirarPerdidos(r.perdidos ?? []);
      toast.success("Cortesia emitida.");
      setAbrirCortesia(false);
      setMotivo("");
      setEscolhidos(new Set());
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  if (feito) {
    const modelo = "comprovante_presencial";
    return (
      <ComprovanteVenda
        modelo={modelo}
        eventoId={evento.id}
        familia={familia}
        total={feito.total}
        troco={feito.troco}
        numeros={feito.numeros}
        sessaoNome={nomesSessoes.find((s) => s.id === sessao)?.nome ?? ""}
        proxima={() => navigate({ to: "/bilheteria", search: { evento: evento.id } })}
      />
    );
  }

  return (
    <div className="pb-24">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sessão">
        {(sessoes.data ?? []).map((s) => (
          <Button
            key={s.id}
            variant={s.id === sessao ? "default" : "outline"}
            className="min-h-11"
            onClick={() => {
              setEscolhidos(new Set());
              aoMudarSessao(s.id);
            }}
          >
            {s.nome}
            {familia ? ` (saldo ${familia.saldos[s.id] ?? 0})` : ""}
          </Button>
        ))}
      </div>
      {avisoPacote ? (
        <div className="mt-3">
          <SeloStatus tom="aviso">
            Hoje é o dia do pacote Quebra-Nozes e esta família não tem o pacote.
          </SeloStatus>
        </div>
      ) : null}
      {excedente > 0 ? (
        <div className="mt-3">
          <SeloStatus tom="aviso">
            Passa do saldo em {excedente} {excedente === 1 ? "lugar" : "lugares"}. A venda pode
            seguir.
          </SeloStatus>
        </div>
      ) : null}
      <div className="mt-4">
        {!mapa ? (
          <EsqueletoLista linhas={4} altura="h-20" />
        ) : (
          <MapaPoltronas
            mapa={mapa}
            escolhidos={escolhidos}
            perdidos={perdidos}
            onEscolher={alternar}
          />
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <p className="numeros flex-1 text-foreground">
            {escolhidos.size === 0
              ? "Clique nas poltronas livres"
              : `${escolhidos.size} lugares: ${[...escolhidos].sort((a, b) => a - b).join(", ")}`}
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={escolhidos.size === 0 || enviando}
            onClick={() => setAbrirCortesia(true)}
          >
            Emitir cortesia
          </Button>
          <Button
            className="min-h-11"
            disabled={escolhidos.size === 0 || enviando}
            onClick={reservarECobrar}
          >
            {enviando ? "Reservando..." : "Reservar e cobrar"}
          </Button>
        </div>
      </div>

      <Dialog open={abrirCortesia} onOpenChange={setAbrirCortesia}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir cortesia</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Lugares {[...escolhidos].join(", ")}. Ingresso de R$ 0, fora da cota.
          </p>
          <Label htmlFor="motivo-cortesia">Para quem é a cortesia</Label>
          <Input
            id="motivo-cortesia"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="text-[16px]"
          />
          <Button className="min-h-11" disabled={!motivo.trim() || enviando} onClick={emitir}>
            Emitir
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pedido)} onOpenChange={(a) => (!a ? void desistir() : undefined)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cobrar pedido {pedido?.codigo}</DialogTitle>
          </DialogHeader>
          {mapa ? (
            <EscolhaLugares
              mapa={mapa}
              lugares={lugares}
              aoMudar={setLugares}
              exigirDeclaracaoMeia={false}
              categorias={evento.meia_categorias ?? []}
            />
          ) : null}
          {(produtos.data ?? []).length > 0 ? (
            <div className="mt-2">
              <h3 className="font-medium text-foreground">Adicionais</h3>
              <EscolhaAdicionais
                produtos={produtos.data ?? []}
                escolhas={adicionais}
                aoMudar={setAdicionais}
                sessoes={nomesSessoes}
              />
            </div>
          ) : null}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Forma de pagamento</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(["dinheiro", "pix", "debito", "credito"] as const).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant={forma === f ? "default" : "outline"}
                    className="min-h-11"
                    onClick={() => setForma(f)}
                  >
                    {FORMA_PRESENCIAL[f]}
                  </Button>
                ))}
              </div>
            </div>
            {podeParcelar ? (
              <div>
                <Label htmlFor="parcelas">Parcelas</Label>
                <select
                  id="parcelas"
                  className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[16px]"
                  value={parcelas}
                  onChange={(e) => setParcelas(Number(e.target.value))}
                >
                  {Array.from({ length: evento.parcelas_max }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {forma === "dinheiro" ? (
              <div>
                <Label htmlFor="recebido">Valor recebido</Label>
                <Input
                  id="recebido"
                  inputMode="decimal"
                  value={recebido}
                  onChange={(e) => setRecebido(e.target.value)}
                  className="mt-1 text-[16px]"
                  placeholder="0,00"
                />
              </div>
            ) : null}
          </div>
          <div className="numeros mt-3 rounded-md border border-border p-3 text-foreground">
            <p className="text-lg font-semibold">
              Total:{" "}
              {calc.isLoading ? "calculando..." : total !== null ? dinheiro(total) : "sem preço"}
            </p>
            {calc.error ? (
              <p className="text-sm text-destructive">{mensagemDeErro(calc.error)}</p>
            ) : null}
            {troco !== null ? (
              <p className={troco < 0 ? "text-destructive" : ""}>
                Troco: {dinheiro(Math.max(0, troco))}
                {troco < 0 ? " (falta dinheiro)" : ""}
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              disabled={enviando || total === null || (troco !== null && troco < 0)}
              onClick={registrarVenda}
            >
              {enviando ? "Registrando..." : "Registrar venda"}
            </Button>
            <Button variant="outline" className="min-h-11" disabled={enviando} onClick={desistir}>
              Desistir e liberar lugares
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComprovanteVenda({
  modelo,
  eventoId,
  familia,
  total,
  troco,
  numeros,
  sessaoNome,
  proxima,
}: {
  modelo: string;
  eventoId: string;
  familia: FamiliaVenda | undefined;
  total: number;
  troco: number | null;
  numeros: number[];
  sessaoNome: string;
  proxima: () => void;
}) {
  const texto = useQuery({
    queryKey: ["conteudo", eventoId, modelo],
    queryFn: async () => {
      const { data } = await supabase
        .from("conteudos")
        .select("texto")
        .eq("evento_id", eventoId)
        .eq("chave", modelo)
        .maybeSingle();
      return data?.texto ?? "";
    },
  });
  const zap = (familia?.whatsapp ?? "").replace(/\D/g, "");
  const msg = preencher(texto.data ?? "", {
    responsavel: familia?.responsavel.split(" ")[0] ?? "",
    lista_ingressos: `${sessaoNome}: poltronas ${numeros.join(", ")}`,
    valor: dinheiro(total),
  });
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <SeloStatus tom="sucesso">Venda registrada</SeloStatus>
      <p className="numeros mt-4 text-2xl font-semibold text-foreground">{dinheiro(total)}</p>
      {troco !== null ? (
        <p className="numeros mt-1 text-lg text-foreground">Troco: {dinheiro(troco)}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {zap && msg ? (
          <Button asChild variant="outline" className="min-h-11">
            <a
              href={`https://wa.me/${zap}?text=${encodeURIComponent(msg)}`}
              target="_blank"
              rel="noreferrer"
            >
              Enviar comprovante no WhatsApp
            </a>
          </Button>
        ) : null}
        <Button className="min-h-11" onClick={proxima} autoFocus>
          Próxima família
        </Button>
      </div>
    </div>
  );
}
