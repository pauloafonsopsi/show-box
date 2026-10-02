/** Leitura da planilha de elenco no navegador (xlsx ou csv). */

export type Celula = string | number | boolean | Date | null;

export interface PlanilhaLida {
  aba: string;
  linhaCabecalho: number; // 1-based na planilha
  colunas: {
    nome: number;
    turma: number;
    pacote: number;
    responsavel: number;
    whatsapp: number;
  };
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

const CABECALHOS = {
  nome: "nome completo da bailarina",
  turma: "turma",
  pacote: "pacote",
  responsavel: "responsavel (primeiro nome)",
  whatsapp: "whatsapp do responsavel",
} as const;

function acharCabecalho(dados: Celula[][]): number {
  for (let i = 0; i < Math.min(10, dados.length); i++) {
    if ((dados[i] ?? []).some((c) => normalizar(c) === CABECALHOS.nome)) return i;
  }
  return -1;
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
      abas.find((a) => acharCabecalho(a.data as Celula[][]) >= 0);
    if (!escolhida) {
      throw new Error('Não encontrei a aba "Bailarinas" nem uma aba com a coluna "Nome completo da bailarina".');
    }
    aba = escolhida.sheet;
    dados = escolhida.data as Celula[][];
  } else {
    throw new Error("Envie um arquivo .xlsx ou .csv.");
  }

  const ic = acharCabecalho(dados);
  if (ic < 0) throw new Error(`A aba "${aba}" não tem a coluna "Nome completo da bailarina" nas 10 primeiras linhas.`);
  const cab = (dados[ic] ?? []).map(normalizar);
  const idx = (k: keyof typeof CABECALHOS) => cab.indexOf(CABECALHOS[k]);
  const faltando = (Object.keys(CABECALHOS) as (keyof typeof CABECALHOS)[]).filter((k) => idx(k) < 0);
  if (faltando.length > 0) {
    const nomes: Record<string, string> = {
      nome: "Nome completo da bailarina",
      turma: "Turma",
      pacote: "Pacote",
      responsavel: "Responsável (primeiro nome)",
      whatsapp: "WhatsApp do responsável",
    };
    throw new Error(`Faltam colunas na planilha: ${faltando.map((k) => nomes[k]).join(", ")}.`);
  }
  const dancas = cab
    .map((c, i) => ({ indice: i, titulo: String(dados[ic]?.[i] ?? "").trim(), norm: c }))
    .filter((c) => c.norm.startsWith("danca"))
    .map(({ indice, titulo }) => ({ indice, titulo }));
  if (dancas.length === 0) throw new Error('A planilha não tem nenhuma coluna "Dança ...".');

  return {
    aba,
    linhaCabecalho: ic + 1,
    colunas: {
      nome: idx("nome"),
      turma: idx("turma"),
      pacote: idx("pacote"),
      responsavel: idx("responsavel"),
      whatsapp: idx("whatsapp"),
    },
    dancas,
    linhas: dados.slice(ic + 1).map((celulas, i) => ({ numero: ic + 2 + i, celulas })),
  };
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
        .filter((d) => normalizar(celulas[d.indice]) === "s" && sessaoPorDanca[d.indice])
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
