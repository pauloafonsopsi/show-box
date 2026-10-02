// Tipos e cálculos compartilhados pelas telas de venda (Bilheteria, família, público).
import type { CelulaGrade } from "@/design/palco";
import { normalizarNome } from "@/design/grade";

export type EstadoAssento = "livre" | "reservado" | "ocupado" | "bloqueado";
export type TipoIngresso = "meia_todos" | "inteira" | "meia";
export type ModoPreco = "unico" | "inteira_meia";

export interface SetorMapa {
  id: string;
  nome: string;
  cor: string;
  meia_todos: number | null;
  inteira: number | null;
  meia: number | null;
}

export interface AssentoMapa {
  id: string;
  numero: number;
  linha: number;
  coluna: number;
  fila: string | null;
  setor_id: string;
  acessivel: boolean;
  estado: EstadoAssento;
}

export interface MapaSessao {
  sessao_id: string;
  evento_id: string;
  colunas: number;
  filas: number;
  palco: [number, number][];
  corredor: [number, number][];
  modo_preco: ModoPreco;
  setores: SetorMapa[];
  assentos: AssentoMapa[];
  meias_disponiveis: number;
}

export interface SessaoResumo {
  id: string;
  nome: string;
  data_hora: string;
  abertura_portas: string | null;
}

/* ------------------------------------------------------------------ */
/* Tipos de ingresso                                                   */
/* ------------------------------------------------------------------ */

export function rotuloTipo(tipo: TipoIngresso, categorias: string[] | null | undefined): string {
  if (tipo === "meia_todos") return "Meia-entrada (outubro)";
  if (tipo === "inteira") return "Inteira";
  const cat = categorias && categorias.length > 0 ? categorias[0] : "Meia-entrada";
  return `Meia-entrada · ${cat}`;
}

/** Tipos disponíveis para um lugar, segundo o modo de preço e o estoque de meias. */
export function tiposDisponiveis(mapa: MapaSessao): TipoIngresso[] {
  return mapa.modo_preco === "unico"
    ? ["meia_todos"]
    : mapa.meias_disponiveis > 0
      ? ["inteira", "meia"]
      : ["inteira"];
}

export function precoDe(setores: SetorMapa[], setorId: string | null, tipo: TipoIngresso): number | null {
  const s = setores.find((x) => x.id === setorId);
  if (!s) return null;
  return tipo === "meia_todos" ? s.meia_todos : tipo === "inteira" ? s.inteira : s.meia;
}

/** Se o modo de preço não tem meia hoje, todo lugar volta para o tipo único. */
export function tipoPermitido(mapa: MapaSessao, tipo: TipoIngresso): TipoIngresso {
  const tipos = tiposDisponiveis(mapa);
  return tipos.includes(tipo) ? tipo : tipos[0] ?? "meia_todos";
}

export interface LugarEscolhido {
  numero: number;
  setorId: string;
  tipo: TipoIngresso;
  categoriaMeia?: string;
}

/** Total estimado do cliente, calculado no navegador só para mostrar; o servidor decide. */
export function estimarTotal(
  setores: SetorMapa[],
  lugares: LugarEscolhido[],
  adicionais: Array<{ produtoId: string; quantidade: number }> = [],
  precosAdicionais: Record<string, number> = {},
): number | null {
  let total = 0;
  for (const l of lugares) {
    const p = precoDe(setores, l.setorId, l.tipo);
    if (p === null) return null;
    total += p;
  }
  for (const a of adicionais) {
    const p = precosAdicionais[a.produtoId];
    if (p === undefined) return null;
    total += p * a.quantidade;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* Formulário de pagamento                                             */
/* ------------------------------------------------------------------ */

export function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function celularValido(v: string): boolean {
  return /^55\d{2}9\d{8}$/.test(v.replace(/\D/g, ""));
}

export function mascaraCelular(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  if (!d.startsWith("55")) d = `55${d}`;
  d = d.slice(0, 13);
  const m = d.match(/^55(\d{0,2})(\d{0,5})(\d{0,4})$/);
  if (!m) return v;
  let s = "";
  if (m[1]) s += `(${m[1]}`;
  if (m[1]?.length === 2) s += ") ";
  if (m[2]) s += m[2];
  if (m[3]) s += `-${m[3]}`;
  return s;
}

export function cpfValido(v: string): boolean {
  const cpf = v.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (fatia: string) => {
    let soma = 0;
    for (let i = 0; i < fatia.length; i++) soma += Number(fatia[i]) * (fatia.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}

export function mascaraCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export interface EnderecoCep {
  logradouro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

/** Consulta o endereço pelo CEP (ViaCEP). Falha silenciosa: o campo de referência é opcional. */
export async function enderecoDoCep(cep: string): Promise<EnderecoCep | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return null;
    const j = (await res.json()) as EnderecoCep;
    return j.erro ? null : j;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Nomes                                                               */
/* ------------------------------------------------------------------ */

export function normalizarBusca(texto: string): string {
  return normalizarNome(texto);
}

/* ------------------------------------------------------------------ */
/* Células do mapa                                                     */
/* ------------------------------------------------------------------ */

export function celulasDoMapa(
  mapa: MapaSessao,
  estadoDe: (assento: AssentoMapa) => Pick<CelulaGrade, "estado" | "destaque"> = () => ({ estado: "livre" }),
): CelulaGrade[] {
  const palco = new Set(mapa.palco.map(([l, c]) => `${l}:${c}`));
  const corredor = new Set(mapa.corredor.map(([l, c]) => `${l}:${c}`));
  const porPosicao = new Map(mapa.assentos.map((a) => [`${a.linha}:${a.coluna}`, a] as const));
  const setorDe = new Map(mapa.setores.map((s) => [s.id, s] as const));

  const celulas: CelulaGrade[] = [];
  for (let l = 1; l <= mapa.filas; l++)
    for (let c = 1; c <= mapa.colunas; c++) {
      if (palco.has(`${l}:${c}`)) {
        celulas.push({ linha: l, coluna: c, tipo: "palco" });
        continue;
      }
      if (corredor.has(`${l}:${c}`)) {
        celulas.push({ linha: l, coluna: c, tipo: "corredor" });
        continue;
      }
      const assento = porPosicao.get(`${l}:${c}`);
      if (!assento) continue;
      const setor = setorDe.get(assento.setor_id);
      celulas.push({
        linha: l,
        coluna: c,
        tipo: "assento",
        numero: assento.numero,
        rotuloFila: assento.fila,
        setor: setor?.nome ?? null,
        corSetor: setor?.cor ?? null,
        acessivel: assento.acessivel,
        ...estadoDe(assento),
      });
    }
  return celulas;
}
