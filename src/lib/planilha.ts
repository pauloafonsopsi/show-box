/** Leitura da planilha de elenco no navegador (xlsx ou csv). */

export type Celula = string | number | boolean | Date | null;

export interface PlanilhaLida {
  aba: string;
  linhaCabecalho: number; // 1-based na planilha
  cabecalhos: string[];
  colunas: Record<Campo, number>; // -1 quando não achou

  dancas: { indice: number; titulo: string }[];
  linhas: { numero: number; celulas: Celula[] }[];
}

export function normalizar(t: unknown): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type Campo = "nome" | "turma" | "pacote" | "responsavel" | "whatsapp";

export const CAMPOS: { id: Campo; nome: string }[] = [
  { id: "nome", nome: "Nome da bailarina" },
  { id: "turma", nome: "Turma" },
  { id: "pacote", nome: "Pacote" },
  { id: "responsavel", nome: "Responsável (primeiro nome)" },
  { id: "whatsapp", nome: "WhatsApp do responsável" },
];

/** Sinônimos aceitos em cada coluna, já normalizados. O primeiro é o nome oficial. */
const SINONIMOS: Record<Campo, string[]> = {
  nome: [
    "nome completo da bailarina", "nome da bailarina", "bailarina", "nome completo da aluna",
    "nome da aluna", "aluna", "aluno", "estudante", "crianca", "nome completo", "nome",
  ],
  turma: ["turma", "classe", "nivel", "sala", "horario", "grupo"],
  pacote: ["pacote", "plano", "cota", "categoria", "pacote de ingressos"],
  responsavel: [
    "responsavel (primeiro nome)", "responsavel", "nome do responsavel", "primeiro nome do responsavel",
    "mae", "pai", "nome da mae", "nome do pai", "mae/pai", "mae ou pai",
  ],
  whatsapp: [
    "whatsapp do responsavel", "whatsapp", "whats", "zap", "celular", "telefone", "tel",
    "fone", "contato", "celular do responsavel", "telefone do responsavel", "whatsapp da mae",
  ],
};

const PREFIXOS_DANCA = ["danca", "apresentacao", "apresenta", "sessao", "dia "];

export function pareceDanca(cabecalhoNormalizado: string): boolean {
  return PREFIXOS_DANCA.some((p) => cabecalhoNormalizado.startsWith(p));
}

/** Acha a coluna de cada campo: primeiro nome exato, depois começo do texto. */
export function sugerirColunas(cab: string[]): Record<Campo, number> {
  const usados = new Set<number>();
  const r = {} as Record<Campo, number>;
  for (const { id } of CAMPOS) {
    let achado = -1;
    for (const sin of SINONIMOS[id]) {
      achado = cab.findIndex((c, i) => !usados.has(i) && c === sin);
      if (achado >= 0) break;
    }
    if (achado < 0)
      for (const sin of SINONIMOS[id]) {
        if (sin.length < 4) continue;
        achado = cab.findIndex((c, i) => !usados.has(i) && !pareceDanca(c) && c.startsWith(sin));
        if (achado >= 0) break;
      }
    if (achado >= 0) usados.add(achado);
    r[id] = achado;
  }
  return r;
}

/** Linha de cabeçalho: entre as 10 primeiras, a que reconhece mais campos (pelo menos 2). */
function acharCabecalho(dados: Celula[][]): number {
  let melhor = -1;
  let pontos = 1;
  for (let i = 0; i < Math.min(10, dados.length); i++) {
    const cab = (dados[i] ?? []).map(normalizar);
    const s = sugerirColunas(cab);
    const p = Object.values(s).filter((x) => x >= 0).length + (cab.some(pareceDanca) ? 1 : 0);
    if (p > pontos) {
      pontos = p;
      melhor = i;
    }
  }
  return melhor;
}

/** CSV com vírgula ou ponto e vírgula, aspas duplas e quebras de linha dentro de aspas. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

export async function lerPlanilha(arquivo: File): Promise<PlanilhaLida> {
  let aba = "";
  let dados: Celula[][] = [];

  if (/\.csv$/i.test(arquivo.name)) {
    aba = arquivo.name;
    dados = lerCsv(await arquivo.text());
  } else if (/\.xlsx$/i.test(arquivo.name)) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const abas = await readXlsxFile(arquivo);
    const escolhida =
      abas.find((a) => normalizar(a.sheet) === "bailarinas") ??
      abas.find((a) => acharCabecalho(a.data as Celula[][]) >= 0) ??
      abas[0];
    if (!escolhida) throw new Error("A planilha está vazia.");
    aba = escolhida.sheet;
    dados = escolhida.data as Celula[][];
  } else {
    throw new Error("Envie um arquivo .xlsx ou .csv.");
  }

  let ic = acharCabecalho(dados);
  if (ic < 0) ic = dados.findIndex((l) => (l ?? []).some((c) => textoCelula(c)));
  if (ic < 0) throw new Error(`A aba "${aba}" está vazia.`);
  const cabecalhos = (dados[ic] ?? []).map((c, i) => textoCelula(c) || `Coluna ${i + 1}`);
  const cab = cabecalhos.map(normalizar);
  const dancas = cab
    .map((c, i) => ({ indice: i, titulo: cabecalhos[i] as string, norm: c }))
    .filter((c) => pareceDanca(c.norm))
    .map(({ indice, titulo }) => ({ indice, titulo }));

  return {
    aba,
    linhaCabecalho: ic + 1,
    cabecalhos,
    colunas: sugerirColunas(cab),
    dancas,
    linhas: dados.slice(ic + 1).map((celulas, i) => ({ numero: ic + 2 + i, celulas })),
  };
}

/** Campos que ainda não têm coluna escolhida. */
export function camposFaltando(p: PlanilhaLida): Campo[] {
  return CAMPOS.filter((c) => p.colunas[c.id] < 0).map((c) => c.id);
}

/** Valores que contam como "dança nesta sessão". */
export function marcado(v: unknown): boolean {
  return ["s", "sim", "x", "1", "true", "verdadeiro", "ok"].includes(normalizar(v));
}

export function textoCelula(c: Celula | undefined): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString();
  return String(c).trim();
}

/** Monta as linhas no formato que `importar_planilha` espera. */
export function linhasParaImportar(p: PlanilhaLida, sessaoPorDanca: Record<number, string>) {
  return p.linhas
    .map(({ numero, celulas }) => ({
      linha: numero,
      nome: textoCelula(celulas[p.colunas.nome]),
      turma: textoCelula(celulas[p.colunas.turma]),
      pacote: textoCelula(celulas[p.colunas.pacote]),
      responsavel: textoCelula(celulas[p.colunas.responsavel]),
      whatsapp: textoCelula(celulas[p.colunas.whatsapp]),
      sessoes: p.dancas
        .filter((d) => marcado(celulas[d.indice]) && sessaoPorDanca[d.indice])
        .map((d) => sessaoPorDanca[d.indice] as string),
    }))
    .filter((l) => l.nome || l.responsavel || l.whatsapp);
}

/** Pré-seleciona a sessão pela data escrita no título (ex.: "Dança 28/11"). */
export function sessaoPelaData(
  titulo: string,
  sessoes: { id: string; nome: string; data_hora: string | null }[],
): string {
  const m = titulo.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!m) return "";
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const achada = sessoes.find((s) => {
    if (s.data_hora) {
      const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "numeric", month: "numeric" })
        .formatToParts(new Date(s.data_hora));
      const d = Number(partes.find((x) => x.type === "day")?.value);
      const mm = Number(partes.find((x) => x.type === "month")?.value);
      if (d === dia && mm === mes) return true;
    }
    return new RegExp(`\\b${dia}\\b`).test(s.nome);
  });
  return achada?.id ?? "";
}
