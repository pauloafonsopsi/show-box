// Escolha de ingressos e adicionais: usada pela página da família, pelo público e pela Bilheteria.
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeloStatus } from "@/design/palco";
import { mascaraCep, mascaraCelular, celularValido, cpfValido, enderecoDoCep, precoDe, tiposDisponiveis, rotuloTipo, type LugarEscolhido, type MapaSessao, type TipoIngresso } from "./tipos";
import { dinheiro } from "@/lib/formato";

/* ------------------------------------------------------------------ */
/* Tipos de ingresso, lugar por lugar                                  */
/* ------------------------------------------------------------------ */

export interface EscolhaLugaresProps {
  mapa: MapaSessao;
  lugares: LugarEscolhido[];
  aoMudar: (lugares: LugarEscolhido[]) => void;
  /** Bilheteria: a atendente não precisa declarar o direito à meia. */
  exigirDeclaracaoMeia?: boolean;
  /** Nomes das categorias de meia-entrada do evento. */
  categorias: string[];
  /** Lugares adicionais escolhidos agora que não estão na lista (para o aviso de declaração). */
  nomesDosLugares?: Record<number, string>;
}

export function EscolhaLugares({ mapa, lugares, aoMudar, exigirDeclaracaoMeia = true, categorias, nomesDosLugares = {} }: EscolhaLugaresProps) {
  const tipos = tiposDisponiveis(mapa);

  const definir = (numero: number, mudanca: Partial<LugarEscolhido>) =>
    aoMudar(lugares.map((l) => (l.numero === numero ? { ...l, ...mudanca } : l)));

  if (lugares.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhum lugar reservado neste pedido.</p>;

  return (
    <div>
      <ul className="divide-y divide-border">
        {lugares.map((l) => {
          const setor = mapa.setores.find((s) => s.id === l.setorId);
          const preco = precoDe(mapa.setores, l.setorId, l.tipo);
          return (
            <li key={l.numero} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="numeros font-medium text-foreground">
                  {nomesDosLugares[l.numero] ? `${nomesDosLugares[l.numero]} · ` : ""}Poltrona {l.numero}
                </p>
                <p className="text-sm text-muted-foreground">
                  {setor?.nome ?? "Setor"}
                  {tipos.length > 1 ? (
                    <>
                      {" · "}
                      <Select
                        value={l.tipo}
                        onValueChange={(v) => definir(l.numero, v === "meia" && l.categoriaMeia ? { tipo: v as TipoIngresso, categoriaMeia: l.categoriaMeia } : { tipo: v as TipoIngresso })}
                      >
                        <SelectTrigger className="h-8 w-auto min-w-44 border-0 p-0 shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tipos.map((t) => (
                            <SelectItem key={t} value={t}>
                              {rotuloTipo(t, categorias)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    ` · ${rotuloTipo(tipos[0] ?? "meia_todos", categorias)}`
                  )}
                </p>
                {l.tipo === "meia" && exigirDeclaracaoMeia ? (
                  <label className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={Boolean(l.categoriaMeia)}
                      onCheckedChange={(v) => definir(l.numero, v ? { categoriaMeia: categorias[0] ?? "Meia-entrada" } : { categoriaMeia: undefined })}
                      aria-label="Declaro ter direito à meia-entrada"
                      className="mt-0.5"
                    />
                    Declaro ter o direito à meia-entrada deste lugar.
                  </label>
                ) : null}
              </div>
              <p className="numeros text-right font-medium text-foreground">{preco === null ? "Sem preço" : dinheiro(preco)}</p>
            </li>
          );
        })}
      </ul>
      {mapa.modo_preco === "inteira_meia" && mapa.meias_disponiveis > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Restam {mapa.meias_disponiveis} ingressos de meia-entrada nesta sessão.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Adicionais                                                          */
/* ------------------------------------------------------------------ */

export interface ProdutoVenda {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  preco: number | null;
  /** quantidade de dias de ensaio cadastrados (mostra escolha de dia) */
  tem_datas: boolean;
  datas: Array<{ id: string; data: string | null; vagas_livres: number }>;
}

export interface AdicionalEscolhido {
  produtoId: string;
  quantidade: number;
  sessaoEntregaId?: string;
  produtoDataId?: string;
}

export function EscolhaAdicionais({
  produtos,
  escolhas,
  aoMudar,
  sessoes = [],
  mostrarEntrega = true,
  diasTela = [],
}: {
  produtos: ProdutoVenda[];
  escolhas: AdicionalEscolhido[];
  aoMudar: (escolhas: AdicionalEscolhido[]) => void;
  /** sessões disponíveis para entrega na sessão */
  sessoes?: Array<{ id: string; nome: string }>;
  /** Bilheteria também vende entregas agendadas; ocultar quando não se aplica */
  mostrarEntrega?: boolean;
  diasTela?: string[];
}) {
  const definir = (produtoId: string, mudanca: Partial<AdicionalEscolhido>) =>
    aoMudar(
      escolhas.some((e) => e.produtoId === produtoId)
        ? escolhas.map((e) => (e.produtoId === produtoId ? { ...e, ...mudanca } : e))
        : [...escolhas, { produtoId, quantidade: 1, ...mudanca }],
    );

  if (produtos.length === 0) return null;

  return (
    <ul className="divide-y divide-border">
      {produtos.map((p) => {
        const escolha = escolhas.find((e) => e.produtoId === p.id);
        return (
          <li key={p.id} className="grid gap-3 py-4 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
            {p.foto_url ? (
              <img src={p.foto_url} alt={`Foto de ${p.nome}`} width={72} height={72} loading="lazy" decoding="async" className="h-18 w-18 rounded-md object-cover" />
            ) : null}
            <div className="min-w-0">
              <p className="font-medium text-foreground">{p.nome}</p>
              {p.descricao ? <p className="text-sm text-muted-foreground">{p.descricao}</p> : null}
              {escolha && mostrarEntrega && sessoes.length > 0 ? (
                <label className="mt-2 block text-sm text-muted-foreground">
                  Entrega
                  <Select
                    value={escolha.sessaoEntregaId ?? ""}
                    onValueChange={(v) => definir(p.id, v ? { sessaoEntregaId: v } : { sessaoEntregaId: undefined })}
                  >
                    <SelectTrigger className="mt-1 h-9 w-full max-w-64 text-[16px]">
                      <SelectValue placeholder="Na sessão de..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sessoes.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
              {escolha && p.tem_datas ? (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Dia do ensaio</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {p.datas
                      .filter((d) => d.vagas_livres > 0)
                      .map((d) => (
                        <label key={d.id} className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
                          <input
                            type="radio"
                            name={`dia-${p.id}`}
                            checked={escolha?.produtoDataId === d.id}
                            onChange={() => definir(p.id, { produtoDataId: d.id })}
                          />
                          <span className="numeros">{d.data ? d.data : "A combinar"}</span>
                          <span className="text-muted-foreground">{d.vagas_livres} vagas</span>
                        </label>
                      ))}
                    {p.datas.every((d) => d.vagas_livres <= 0) ? (
                      <SeloStatus tom="aviso">Nenhum dia tem vagas livres agora. Fale com a recepção.</SeloStatus>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <p className="numeros text-sm text-muted-foreground">{p.preco === null ? "Sem preço" : dinheiro(p.preco)}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Menos um ${p.nome}`}
                  className="min-h-9 min-w-9 rounded-md border border-input px-2"
                  disabled={!escolha}
                  onClick={() => {
                    const q = (escolha?.quantidade ?? 1) - 1;
                    if (q <= 0) aoMudar(escolhas.filter((e) => e.produtoId !== p.id));
                    else definir(p.id, { quantidade: q });
                  }}
                >
                  −
                </button>
                <span className="numeros w-6 text-center">{escolha?.quantidade ?? 0}</span>
                <button
                  type="button"
                  aria-label={`Mais um ${p.nome}`}
                  className="min-h-9 min-w-9 rounded-md border border-input px-2"
                  onClick={() => definir(p.id, { quantidade: (escolha?.quantidade ?? 0) + 1 })}
                >
                  +
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Pagador                                                             */
/* ------------------------------------------------------------------ */

export interface Pagador {
  nome: string;
  cpf: string;
  email: string;
  celular: string;
  cep: string;
  numero: string;
  referencia: string;
  cidade: string;
  estado: string;
}

export const pagadorVazio: Pagador = { nome: "", cpf: "", email: "", celular: "", cep: "", numero: "", referencia: "", cidade: "", estado: "" };

export function pagadorValido(p: Pagador): string | null {
  if (p.nome.trim().length < 2) return "Escreva o nome completo de quem paga.";
  if (!cpfValido(p.cpf)) return "Confira o CPF de quem paga.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim())) return "Confira o e-mail: é por ele que o comprovante chega.";
  if (!celularValido(p.celular)) return "Confira o celular com DDD.";
  return null;
}

/** Campos do pagador, com busca de endereço pelo CEP. */
export function CamposPagador({ pagador, aoMudar }: { pagador: Pagador; aoMudar: (p: Pagador) => void }) {
  const [buscando, setBuscando] = useState(false);

  const campo = (mudanca: Partial<Pagador>) => aoMudar({ ...pagador, ...mudanca });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm text-muted-foreground sm:col-span-2">
        Nome de quem paga
        <Input className="mt-1 text-[16px]" value={pagador.nome} onChange={(e) => campo({ nome: e.target.value })} autoComplete="name" />
      </label>
      <label className="block text-sm text-muted-foreground">
        CPF
        <Input className="mt-1 text-[16px]" inputMode="numeric" value={pagador.cpf} onChange={(e) => campo({ cpf: mascaraCpf(e.target.value) })} placeholder="000.000.000-00" autoComplete="off" />
      </label>
      <label className="block text-sm text-muted-foreground">
        Celular
        <Input className="mt-1 text-[16px]" inputMode="numeric" value={pagador.celular} onChange={(e) => campo({ celular: mascaraCelular(e.target.value) })} placeholder="(93) 90000-0000" autoComplete="off" />
      </label>
      <label className="block text-sm text-muted-foreground sm:col-span-2">
        E-mail
        <Input className="mt-1 text-[16px]" inputMode="email" value={pagador.email} onChange={(e) => campo({ email: e.target.value })} autoComplete="email" />
      </label>
      <label className="block text-sm text-muted-foreground">
        CEP
        <Input
          className="mt-1 text-[16px]"
          inputMode="numeric"
          value={pagador.cep}
          onChange={async (e) => {
            const cep = mascaraCep(e.target.value);
            campo({ cep });
            if (cep.length === 9) {
              setBuscando(true);
              const end = await enderecoDoCep(cep);
              if (end) campo({ referencia: end.logradouro ?? pagador.referencia, cidade: end.localidade ?? pagador.cidade, estado: end.uf ?? pagador.estado });
              setBuscando(false);
            }
          }}
          placeholder="68000-000"
        />
      </label>
      <label className="block text-sm text-muted-foreground">
        Número
        <Input className="mt-1 text-[16px]" value={pagador.numero} onChange={(e) => campo({ numero: e.target.value })} />
      </label>
      <label className="block text-sm text-muted-foreground sm:col-span-2">
        Endereço
        <Input className="mt-1 text-[16px]" value={pagador.referencia} onChange={(e) => campo({ referencia: e.target.value })} placeholder="Rua, avenida..." />
        {buscando ? <span className="mt-1 block text-sm">Procurando o endereço...</span> : null}
      </label>
      <label className="block text-sm text-muted-foreground">
        Cidade
        <Input className="mt-1 text-[16px]" value={pagador.cidade} onChange={(e) => campo({ cidade: e.target.value })} />
      </label>
      <label className="block text-sm text-muted-foreground">
        Estado
        <Input className="mt-1 text-[16px]" value={pagador.estado} onChange={(e) => campo({ estado: e.target.value.toUpperCase().slice(0, 2) })} placeholder="PA" />
      </label>
    </div>
  );
}

