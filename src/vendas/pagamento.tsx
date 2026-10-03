// Tela de pagamento online (família e público): reserva aberta, PIX ou cartão,
// parcelamento, termos e atualização automática quando o pagamento entra.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeloStatus } from "@/design/palco";
import { mensagemDeErro, dinheiro, preencher } from "@/lib/formato";
import { useRascunho } from "@/lib/rascunho";
import { QrTexto } from "./qr";
import {
  CamposPagador,
  EscolhaAdicionais,
  EscolhaLugares,
  pagadorVazio,
  pagadorValido,
  type AdicionalEscolhido,
  type Pagador,
  type ProdutoVenda,
} from "./selecao";
import { tipoPermitido, type LugarEscolhido, type MapaSessao, type TipoIngresso } from "./tipos";
import {
  estadoPagamento,
  iniciarPagamento,
  liberarReservaOnline,
  statusPagamento,
  chavePublicaPagarme,
} from "@/lib/vendas.functions";

export interface CartaoTela {
  numero: string;
  nome: string;
  validade: string;
  cvv: string;
}

const cartaoVazio: CartaoTela = { numero: "", nome: "", validade: "", cvv: "" };

interface Rascunho {
  tipos: Record<string, { tipo: TipoIngresso; categoriaMeia?: string }>;
  adicionais: AdicionalEscolhido[];
  pagador: Pagador;
  forma: "pix" | "cartao";
  parcelas: number;
  termos: boolean;
}

export function PagamentoOnline({
  acesso,
  conteudos,
  produtos = [],
  sessoesEntrega = [],
  vaiParaPedido,
  voltarAosLugares,
  rotuloVoltar = "Escolher de novo",
}: {
  acesso: string;
  conteudos: Record<string, string>;
  produtos?: ProdutoVenda[];
  sessoesEntrega?: Array<{ id: string; nome: string }>;
  vaiParaPedido: () => void;
  voltarAosLugares: () => void;
  rotuloVoltar?: string;
}) {
  const buscarEstado = useServerFn(estadoPagamento);
  const buscarStatus = useServerFn(statusPagamento);
  const pagar = useServerFn(iniciarPagamento);
  const liberar = useServerFn(liberarReservaOnline);
  const buscarChave = useServerFn(chavePublicaPagarme);

  const consulta = useQuery({
    queryKey: ["estado-pagamento", acesso],
    queryFn: () => buscarEstado({ data: { acesso } }),
  });

  // Depois de escolhida a forma, consulta o pagamento a cada poucos segundos.
  const [modoPos, setModoPos] = useState<null | "pix" | "esperando">(null);
  const [pix, setPix] = useState<{ qr: string; copia: string } | null>(null);

  // Pago ou encerrado por outro caminho (webhook): segue direto para o pedido.
  const st = (consulta.data?.pedido as { status: string } | null)?.status;

  const status = useQuery({
    enabled: Boolean(modoPos) || st === "aguardando_pagamento",
    queryKey: ["status-pagamento", acesso],
    queryFn: async () => {
      const r = await buscarStatus({ data: { acesso } });
      return r as { status: string; pix_qr_code?: string | null } | null;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (status.data && (status.data.status === "pago" || status.data.status === "pago_sem_lugar"))
      vaiParaPedido();
  }, [status.data, vaiParaPedido]);

  useEffect(() => {
    if (st === "pago" || st === "pago_sem_lugar") vaiParaPedido();
  }, [st, vaiParaPedido]);

  if (consulta.isLoading) return <Esqueleto />;
  if (consulta.error)
    return (
      <Falha
        mensagem={mensagemDeErro(consulta.error)}
        voltar={voltarAosLugares}
        rotuloVoltar={rotuloVoltar}
      />
    );
  const estado = consulta.data as Estado | null;
  if (!estado || !estado.pedido)
    return (
      <Falha
        mensagem="Este pedido não existe mais. Escolha os lugares de novo."
        voltar={voltarAosLugares}
        rotuloVoltar={rotuloVoltar}
      />
    );
  if (st === "expirado")
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-lg font-medium text-foreground">
          {conteudos["reserva_expirou"] ?? "O tempo da reserva acabou."}
        </p>
        <Button className="mt-6 min-h-11" onClick={voltarAosLugares}>
          {rotuloVoltar}
        </Button>
      </div>
    );
  if (st === "cancelado" || st === "estornado")
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-lg font-medium text-foreground">
          Esta compra foi cancelada. Fale com a recepção para resolver.
        </p>
        <Button variant="outline" className="mt-6 min-h-11" onClick={voltarAosLugares}>
          {rotuloVoltar}
        </Button>
      </div>
    );

  if (modoPos || st === "aguardando_pagamento")
    return (
      <AposEnviar
        modo={modoPos ?? (status.data?.pix_qr_code ? "pix" : "esperando")}
        pix={pix ?? (status.data?.pix_qr_code ? { qr: "", copia: status.data.pix_qr_code } : null)}
        conteudos={conteudos}
        voltar={voltarAosLugares}
      />
    );

  return (
    <FormularioDePagamento
      acesso={acesso}
      estado={estado}
      conteudos={conteudos}
      produtos={produtos}
      sessoesEntrega={sessoesEntrega}
      onPix={(p) => {
        setPix(p);
        setModoPos("pix");
      }}
      onCartao={() => setModoPos("esperando")}
      liberar={async () => {
        await liberar({ data: { acesso } });
        toast("Reserva liberada. Os lugares voltaram para o mapa.");
        voltarAosLugares();
      }}
      rotuloVoltar={rotuloVoltar}
    />
  );
}

/* ------------------------------------------------------------------ */

type Estado = {
  pedido: {
    codigo: string;
    status: string;
    canal: string;
    valor_total_centavos: number;
    forma_pagamento: string | null;
    parcelas: number | null;
    expira_em: string;
    previstos: Array<{
      sessao_id: string;
      numero: number;
      tipo: string;
      categoria_meia: string | null;
    }>;
    itens: Array<{ produto: string; quantidade: number; valor_unitario_centavos: number }>;
  } | null;
  evento: {
    meia_categorias: string[];
    parcelamento_min_ingressos: number;
    parcelas_max: number;
  } | null;
  termos: { id: string; versao: number; texto: string } | null;
  lugares: Array<{
    numero: number;
    setor_id: string;
    sessao_id: string;
    rotulo_fila: string | null;
    setores: { nome: string } | null;
  }>;
  sessoes_mapas: Array<{ sessao_id: string; mapa: MapaSessao | null }>;
};

function Esqueleto() {
  return (
    <div className="mx-auto max-w-xl animate-pulse space-y-4 py-10" aria-hidden="true">
      <div className="h-8 w-2/3 rounded bg-muted" />
      <div className="h-32 rounded bg-muted" />
      <div className="h-40 rounded bg-muted" />
    </div>
  );
}

function Falha({
  mensagem,
  voltar,
  rotuloVoltar,
}: {
  mensagem: string;
  voltar: () => void;
  rotuloVoltar: string;
}) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <SeloStatus tom="erro">{mensagem}</SeloStatus>
      <Button variant="outline" className="mt-6 min-h-11" onClick={voltar}>
        {rotuloVoltar}
      </Button>
    </div>
  );
}

function FormularioDePagamento({
  acesso,
  estado,
  conteudos,
  produtos,
  sessoesEntrega,
  onPix,
  onCartao,
  liberar,
  rotuloVoltar,
}: {
  acesso: string;
  estado: Estado;
  conteudos: Record<string, string>;
  produtos: ProdutoVenda[];
  sessoesEntrega: Array<{ id: string; nome: string }>;
  onPix: (p: { qr: string; copia: string }) => void;
  onCartao: () => void;
  liberar: () => Promise<void>;
  rotuloVoltar: string;
}) {
  const pagar = useServerFn(iniciarPagamento);
  const buscarChave = useServerFn(chavePublicaPagarme);
  const pedido = estado.pedido!;
  const evento = estado.evento!;
  const categorias = evento?.meia_categorias ?? [];

  // Lugares agrupados por sessão, cada um com o seu mapa (preços por setor).
  const porSessao = useMemo(() => {
    const grupos = new Map<string, { mapa: MapaSessao | null; numeros: number[] }>();
    for (const l of estado.lugares) {
      const g = grupos.get(l.sessao_id) ?? { mapa: null, numeros: [] };
      g.numeros.push(l.numero);
      grupos.set(l.sessao_id, g);
    }
    for (const sm of estado.sessoes_mapas) {
      const g = grupos.get(sm.sessao_id);
      if (g) g.mapa = sm.mapa;
    }
    return [...grupos.entries()];
  }, [estado]);

  const rascunho = useRascunho<Rascunho>("pagamento", {
    tipos: {},
    adicionais: [],
    pagador: pagadorVazio,
    forma: "pix",
    parcelas: 1,
    termos: false,
  });
  const [cartao, setCartao] = useState<CartaoTela>(cartaoVazio);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [tipos, setTipos] = useState<Rascunho["tipos"]>(rascunho.valor?.tipos ?? {});

  const chaveDe = (sessaoId: string, numero: number) => `${sessaoId}:${numero}`;
  useEffect(() => {
    if (tipos && Object.keys(tipos).length > 0) return;
    const t: Rascunho["tipos"] = {};
    for (const l of estado.lugares) {
      const mapa = estado.sessoes_mapas.find((s) => s.sessao_id === l.sessao_id)?.mapa;
      if (!mapa) continue;
      const prev = pedido.previstos.find(
        (p) => p.numero === l.numero && p.sessao_id === l.sessao_id,
      );
      const tipo = tipoPermitido(
        mapa,
        (prev?.tipo as TipoIngresso) ?? (mapa.modo_preco === "unico" ? "meia_todos" : "inteira"),
      );
      t[chaveDe(l.sessao_id, l.numero)] = prev?.categoria_meia
        ? { tipo, categoriaMeia: prev.categoria_meia }
        : { tipo };
    }
    setTipos(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, pedido]);

  const lugaresEscolhidos: LugarEscolhido[] = estado.lugares.map((l) => {
    const escolha = tipos[chaveDe(l.sessao_id, l.numero)];
    return escolha?.categoriaMeia
      ? {
          numero: l.numero,
          setorId: l.setor_id,
          tipo: escolha.tipo,
          categoriaMeia: escolha.categoriaMeia,
        }
      : { numero: l.numero, setorId: l.setor_id, tipo: escolha?.tipo ?? "meia_todos" };
  });

  const minutos = Math.max(
    0,
    Math.ceil((new Date(pedido.expira_em).getTime() - Date.now()) / 60000),
  );

  async function enviar(forma: "pix" | "cartao") {
    if (!rascunho.valor) return;
    const dados: Rascunho = { ...rascunho.valor, forma, tipos };
    if (!dados.termos) {
      setErro("Para continuar, aceite os termos de compra.");
      return;
    }
    const falhaPagador = pagadorValido(dados.pagador);
    if (falhaPagador) {
      setErro(falhaPagador);
      return;
    }
    if (
      forma === "cartao" &&
      (cartao.numero.replace(/\D/g, "").length < 13 ||
        !/^\d{2}\/\d{2}$/.test(cartao.validade) ||
        cartao.cvv.length < 3)
    ) {
      setErro("Confira os dados do cartão.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      let cartaoToken: string | undefined;
      if (forma === "cartao") {
        const pk = await buscarChave({});
        cartaoToken = await tokenizarCartao(pk, cartao);
      }
      const resposta = await pagar({
        data: {
          acesso,
          ingressos: estado.lugares.map((x) => {
            const escolha = tipos[chaveDe(x.sessao_id, x.numero)];
            return escolha?.categoriaMeia
              ? {
                  numero: x.numero,
                  sessao_id: x.sessao_id,
                  tipo: escolha.tipo,
                  categoria_meia: escolha.categoriaMeia,
                }
              : {
                  numero: x.numero,
                  sessao_id: x.sessao_id,
                  tipo: escolha?.tipo ?? ("meia_todos" as const),
                };
          }),
          adicionais: dados.adicionais.map((a) => ({
            produto_id: a.produtoId,
            quantidade: a.quantidade,
            sessao_entrega_id: a.sessaoEntregaId,
            produto_data_id: a.produtoDataId,
          })),
          pagador: {
            nome: dados.pagador.nome,
            cpf: dados.pagador.cpf,
            email: dados.pagador.email,
            celular: dados.pagador.celular,
          },
          forma,
          parcelas: dados.parcelas,
          termosVersao: estado.termos?.id ?? "",
          cartaoToken,
          cep: dados.pagador.cep,
          numero: dados.pagador.numero,
          referencia: dados.pagador.referencia,
          cidade: dados.pagador.cidade,
          estado: dados.pagador.estado,
        },
      });
      rascunho.setValor(dados);
      if (forma === "pix" && resposta?.pix_qr_code) {
        onPix({ qr: resposta.pix_qr_code, copia: resposta.pix_qr_code });
        toast("PIX gerado. Pague no seu app: esta página atualiza sozinha.");
      } else if (forma === "cartao") {
        onCartao();
        toast("A operadora está confirmando o pagamento.");
      }
    } catch (e) {
      const msg = mensagemDeErro(e);
      setErro(msg);
      if (/cart|recus|operadora|pagamento/i.test(msg)) setErro(conteudos["cartao_recusado"] ?? msg);
    } finally {
      setEnviando(false);
    }
  }

  const podeParcelar = (pedido.previstos?.length ?? 0) >= (evento?.parcelamento_min_ingressos ?? 0);
  const parcelasMax = Math.max(1, Math.min(evento?.parcelas_max ?? 1, 12));

  // Total só para mostrar; o valor cobrado é sempre recalculado no servidor.
  const precosAdicionais: Record<string, number> = {};
  for (const p of produtos) if (p.preco !== null) precosAdicionais[p.id] = p.preco;
  let totalTela: number | null = 0;
  for (const [sessaoId, g] of porSessao) {
    if (!g.mapa || totalTela === null) continue;
    const doGrupo = lugaresEscolhidos.filter((l) =>
      estado.lugares.some((x) => x.numero === l.numero && x.sessao_id === sessaoId),
    );
    const parcial = estimarTotal(g.mapa.setores, doGrupo);
    totalTela = parcial === null ? null : totalTela + parcial;
  }
  if (totalTela !== null) {
    const adic = estimarTotal(
      [],
      [],
      (rascunho.valor?.adicionais ?? []).map((a) => ({ produtoId: a.produtoId, quantidade: a.quantidade })),
      precosAdicionais,
    );
    totalTela = adic === null ? null : totalTela + adic;
  }
  const totalMostrado =
    pedido.valor_total_centavos > 0 ? pedido.valor_total_centavos : (totalTela ?? 0);

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">Pedido {pedido.codigo}</p>
        <h1 className="titulo-palco mt-1 text-2xl font-semibold text-foreground">Pagamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {preencher(
            conteudos["reserva_tempo"] ?? "Seus lugares ficam guardados por {{minutos}} minutos.",
            { minutos: String(minutos) },
          )}
        </p>
      </header>

      {porSessao.map(([sessaoId, g]) =>
        g.mapa ? (
          <section key={sessaoId} className="mb-6 rounded-xl border border-border bg-card p-4">
            <h2 className="font-medium text-foreground">Ingressos</h2>
            <EscolhaLugares
              mapa={g.mapa}
              lugares={lugaresEscolhidos.filter((l) =>
                estado.lugares.find((x) => x.numero === l.numero && x.sessao_id === sessaoId),
              )}
              aoMudar={(novos) => {
                for (const l of novos)
                  setTipos((t) => ({
                    ...t,
                    [chaveDe(sessaoId, l.numero)]: l.categoriaMeia
                      ? { tipo: l.tipo, categoriaMeia: l.categoriaMeia }
                      : { tipo: l.tipo },
                  }));
              }}
              exigirDeclaracaoMeia
              categorias={categorias}
            />
          </section>
        ) : null,
      )}

      {produtos.length > 0 ? (
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium text-foreground">Adicionais</h2>
          <EscolhaAdicionais
            produtos={produtos}
            escolhas={rascunho.valor?.adicionais ?? []}
            aoMudar={(a) =>
              rascunho.setValor({
                ...(rascunho.valor ?? {
                  tipos: {},
                  pagador: pagadorVazio,
                  forma: "pix",
                  parcelas: 1,
                  termos: false,
                }),
                adicionais: a,
              })
            }
            sessoes={sessoesEntrega}
          />
        </section>
      ) : null}

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium text-foreground">Quem paga</h2>
        <div className="mt-3">
          <CamposPagador
            pagador={rascunho.valor?.pagador ?? pagadorVazio}
            aoMudar={(p) =>
              rascunho.setValor({
                ...(rascunho.valor ?? {
                  tipos: {},
                  adicionais: [],
                  forma: "pix",
                  parcelas: 1,
                  termos: false,
                }),
                pagador: p,
              })
            }
          />
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium text-foreground">Como pagar</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <BotaoForma
            ativo={(rascunho.valor?.forma ?? "pix") === "pix"}
            onClick={() =>
              rascunho.setValor({
                ...(rascunho.valor ?? {
                  tipos: {},
                  adicionais: [],
                  pagador: pagadorVazio,
                  parcelas: 1,
                  termos: false,
                }),
                forma: "pix",
              })
            }
          >
            <span className="inline-flex items-center gap-2">
              <PixIcone /> PIX
            </span>
          </BotaoForma>
          <BotaoForma
            ativo={(rascunho.valor?.forma ?? "pix") === "cartao"}
            onClick={() =>
              rascunho.setValor({
                ...(rascunho.valor ?? {
                  tipos: {},
                  adicionais: [],
                  pagador: pagadorVazio,
                  parcelas: 1,
                  termos: false,
                }),
                forma: "cartao",
              })
            }
          >
            <span className="inline-flex items-center gap-2">
              <Cartoes /> Cartão
            </span>
          </BotaoForma>
        </div>
        {(rascunho.valor?.forma ?? "pix") === "cartao" ? (
          <div className="mt-4 grid gap-3">
            <label className="block text-sm text-muted-foreground">
              Número do cartão
              <Input
                className="mt-1 text-[16px]"
                inputMode="numeric"
                value={cartao.numero}
                onChange={(e) => setCartao({ ...cartao, numero: mascaraCartao(e.target.value) })}
                placeholder="0000 0000 0000 0000"
                autoComplete="off"
              />
            </label>
            <label className="block text-sm text-muted-foreground">
              Nome impresso no cartão
              <Input
                className="mt-1 text-[16px]"
                value={cartao.nome}
                onChange={(e) => setCartao({ ...cartao, nome: e.target.value })}
                autoComplete="off"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-muted-foreground">
                Validade
                <Input
                  className="mt-1 text-[16px]"
                  inputMode="numeric"
                  value={cartao.validade}
                  onChange={(e) =>
                    setCartao({ ...cartao, validade: mascaraValidade(e.target.value) })
                  }
                  placeholder="MM/AA"
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm text-muted-foreground">
                Código de segurança
                <Input
                  className="mt-1 text-[16px]"
                  inputMode="numeric"
                  value={cartao.cvv}
                  onChange={(e) =>
                    setCartao({ ...cartao, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })
                  }
                  placeholder="000"
                  autoComplete="off"
                />
              </label>
            </div>
            <label className="block text-sm text-muted-foreground">
              Parcelas
              <Select
                value={String(rascunho.valor?.parcelas ?? 1)}
                onValueChange={(v) =>
                  rascunho.setValor({
                    ...(rascunho.valor ?? {
                      tipos: {},
                      adicionais: [],
                      pagador: pagadorVazio,
                      forma: "cartao",
                      termos: false,
                    }),
                    parcelas: Number(v),
                  })
                }
              >
                <SelectTrigger className="mt-1 text-[16px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: podeParcelar ? parcelasMax : 1 }, (_, i) => i + 1).map(
                    (n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? "À vista" : `${n}x sem juros`}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </label>
          </div>
        ) : null}
      </section>

      {estado.termos ? (
        <section className="mb-6">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <Checkbox
              className="mt-0.5"
              checked={Boolean(rascunho.valor?.termos)}
              onCheckedChange={(v) =>
                rascunho.setValor({
                  ...(rascunho.valor ?? {
                    tipos: {},
                    adicionais: [],
                    pagador: pagadorVazio,
                    forma: "pix",
                    parcelas: 1,
                  }),
                  termos: Boolean(v),
                })
              }
            />
            <span>
              Aceito os{" "}
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" className="underline underline-offset-2">
                    termos de compra (versão {estado.termos.versao})
                  </button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Termos de compra</DialogTitle>
                  </DialogHeader>
                  <div className="whitespace-pre-wrap text-sm text-foreground">
                    {estado.termos.texto}
                  </div>
                </DialogContent>
              </Dialog>{" "}
              ao fazer o pagamento.
            </span>
          </label>
        </section>
      ) : null}

      {erro ? (
        <p
          className="mb-4 rounded-md border border-erro/40 bg-erro/5 px-3 py-2 text-sm text-erro"
          role="alert"
        >
          {erro}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void liberar()}
            className="min-h-11 px-2 text-sm text-muted-foreground underline underline-offset-2"
          >
            Desistir desta reserva
          </button>
          <div className="flex items-center gap-3">
            <span className="numeros text-lg font-semibold text-foreground">
              {dinheiro(pedido.valor_total_centavos)}
            </span>
            <Button
              className="min-h-11"
              disabled={enviando}
              onClick={() => void enviar(rascunho.valor?.forma ?? "pix")}
            >
              {enviando
                ? "Perguntando ao banco..."
                : rascunho.valor?.forma === "cartao"
                  ? "Pagar com o cartão"
                  : "Pagar com PIX"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BotaoForma({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`min-h-11 rounded-md border px-4 py-2 text-[16px] font-medium ${ativo ? "border-ouro bg-ouro/10 text-foreground" : "border-border text-foreground"}`}
    >
      {children}
    </button>
  );
}

function Cartoes() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function PixIcone() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M12 2 4 10l8 8 8-8Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 2v20" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function mascaraCartao(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}
function mascaraValidade(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

async function tokenizarCartao(pk: string, cartao: CartaoTela): Promise<string> {
  const [mm, aa] = cartao.validade.split("/");
  const res = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(pk)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "card",
      card: {
        number: cartao.numero.replace(/\s/g, ""),
        holder_name: cartao.nome.trim(),
        exp_month: Number(mm ?? 0),
        exp_year: Number(`20${aa ?? "00"}`),
        cvv: cartao.cvv,
      },
    }),
  });
  const j = (await res.json().catch(() => null)) as {
    id?: string;
    message?: string;
    errors?: Array<{ message?: string }>;
  } | null;
  if (!res.ok || !j?.id)
    throw new Error(
      j?.errors?.[0]?.message ??
        j?.message ??
        "Não foi possível validar o cartão. Confira os dados.",
    );
  return j.id;
}

/* ------------------------------------------------------------------ */
/* Depois de enviar: PIX ou confirmação do cartão                      */
/* ------------------------------------------------------------------ */

function AposEnviar({
  modo,
  pix,
  conteudos,
  voltar,
}: {
  modo: "pix" | "esperando";
  pix: { qr: string; copia: string } | null;
  conteudos: Record<string, string>;
  voltar: () => void;
}) {
  if (modo === "pix") {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <h1 className="titulo-palco text-2xl font-semibold text-foreground">Pagar com PIX</h1>
        {pix ? (
          <>
            <div className="mt-4 flex justify-center">
              <QrTexto texto={pix.copia} tamanho={180} rotulo="PIX copia e cola" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Input
                readOnly
                value={pix.copia}
                className="numeros flex-1 text-[13px]"
                aria-label="Código PIX copia e cola"
              />
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  void navigator.clipboard.writeText(pix.copia).then(() => toast("Código copiado."))
                }
              >
                <Copiar /> Copiar
              </Button>
            </div>
          </>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">{conteudos["pix_instrucao"] ?? ""}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta página atualiza sozinha quando o pagamento chegar.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <SeloStatus tom="neutro">A operadora está confirmando o pagamento.</SeloStatus>
      <p className="mt-3 text-sm text-muted-foreground">
        Não feche esta página: ela atualiza sozinha.
      </p>
    </div>
  );
}

export function Copiar() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}
