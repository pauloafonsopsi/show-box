// Painel da família: um só pedido ao servidor, compartilhado pelas telas de /f.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { painelFamilia } from "@/lib/vendas.functions";
import type { IngressoCarteira } from "./carteira";
import type { ProdutoVenda } from "./selecao";

export interface PainelFamilia {
  familia: { id: string; responsavel: string };
  evento: { id: string; nome: string; slug: string; status: string; meia_categorias: string[] | null };
  bailarinas: Array<{ nome: string; sessoes: string[] }>;
  sessoes: Array<{ id: string; nome: string; data_hora: string; saldo: number; dancam: number }>;
  janelas: Array<{ tipo: string; inicio: string; fim: string | null }>;
  pode_comprar_agora: boolean;
  ingressos: Array<IngressoCarteira & { sessao_id: string }>;
  pedidos: Array<{ codigo: string; acesso: string; status: string; valor_total_centavos: number; expira_em: string | null }>;
  produtos: Array<{
    id: string;
    nome: string;
    descricao: string | null;
    foto_url: string | null;
    preco_centavos: number | null;
    datas: Array<{ id: string; data: string | null; vagas: number }>;
  }>;
  conteudos: Record<string, string>;
  configuracoes: Record<string, string>;
}

export function usePainelFamilia(codigo: string) {
  const buscar = useServerFn(painelFamilia);
  return useQuery({
    queryKey: ["painel-familia", codigo],
    queryFn: async () => (await buscar({ data: { codigo } })) as unknown as PainelFamilia | null,
  });
}

export function produtosParaVenda(p: PainelFamilia): ProdutoVenda[] {
  return p.produtos.map((x) => ({
    id: x.id,
    nome: x.nome,
    descricao: x.descricao,
    foto_url: x.foto_url,
    preco: x.preco_centavos,
    tem_datas: x.datas.length > 0,
    datas: x.datas.map((d) => ({ id: d.id, data: d.data, vagas_livres: d.vagas })),
  }));
}

export function janelaAberta(janelas: PainelFamilia["janelas"], tipo: string): boolean {
  const agora = Date.now();
  return janelas.some((j) => j.tipo === tipo && new Date(j.inicio).getTime() <= agora && (!j.fim || new Date(j.fim).getTime() > agora));
}
