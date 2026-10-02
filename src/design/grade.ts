/**
 * Lógica pura da grade de mapas. Escrito pelo Claude. Aplicar sem alterar.
 * Sem React e sem acesso ao banco: o editor usa estas funções,
 * e quem chama grava com a função do banco `salvar_mapa` (ver `paraSalvarMapa`).
 */

export type TipoCelula = "assento" | "corredor" | "palco";

export interface Celula {
  linha: number;
  coluna: number;
  tipo: TipoCelula;
  rotuloFila: string | null;
  numero: number | null;
  setorId: string | null;
  acessivel: boolean;
  bloqueadoPadrao: boolean;
}

export interface Setor {
  id: string;
  nome: string;
  cor: string;
}

export interface Grade {
  colunas: number;
  filas: number;
  celulas: Celula[];
}

export interface Problema {
  gravidade: "erro" | "aviso";
  mensagem: string;
  posicoes: Array<[number, number]>;
}

export const LIMITE_COLUNAS = 60;
export const LIMITE_FILAS = 40;

export const chave = (linha: number, coluna: number): string => `${linha}:${coluna}`;

export function indexar(celulas: Celula[]): Map<string, Celula> {
  const mapa = new Map<string, Celula>();
  for (const c of celulas) mapa.set(chave(c.linha, c.coluna), c);
  return mapa;
}

export function normalizarNome(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Linha de uma célula vira assento com valores padrão. */
export function novoAssento(
  linha: number,
  coluna: number,
  numero: number,
  setorId: string | null,
  rotuloFila: string | null,
): Celula {
  return {
    linha,
    coluna,
    tipo: "assento",
    rotuloFila,
    numero,
    setorId,
    acessivel: false,
    bloqueadoPadrao: false,
  };
}

export function novaCelula(
  linha: number,
  coluna: number,
  tipo: Exclude<TipoCelula, "assento">,
): Celula {
  return {
    linha,
    coluna,
    tipo,
    rotuloFila: null,
    numero: null,
    setorId: null,
    acessivel: false,
    bloqueadoPadrao: false,
  };
}

export function proximoNumero(celulas: Iterable<Celula>): number {
  let maior = 0;
  for (const c of celulas)
    if (c.tipo === "assento" && c.numero !== null && c.numero > maior) maior = c.numero;
  return maior + 1;
}

/** Rótulo usado pelos outros assentos da mesma linha, se houver. */
export function rotuloDaLinha(celulas: Iterable<Celula>, linha: number): string | null {
  for (const c of celulas)
    if (c.linha === linha && c.tipo === "assento" && c.rotuloFila) return c.rotuloFila;
  return null;
}

export interface Contagem {
  total: number;
  porSetor: Map<string, number>;
  bloqueados: number;
  acessiveis: number;
}

export function contar(celulas: Iterable<Celula>): Contagem {
  const porSetor = new Map<string, number>();
  let total = 0;
  let bloqueados = 0;
  let acessiveis = 0;
  for (const c of celulas) {
    if (c.tipo !== "assento") continue;
    total += 1;
    if (c.bloqueadoPadrao) bloqueados += 1;
    if (c.acessivel) acessiveis += 1;
    if (c.setorId) porSetor.set(c.setorId, (porSetor.get(c.setorId) ?? 0) + 1);
  }
  return { total, porSetor, bloqueados, acessiveis };
}

/** Mesmas regras da função do banco, para avisar antes de salvar. */
export function validar(grade: Grade, setores: Setor[]): Problema[] {
  const problemas: Problema[] = [];
  const idsSetor = new Set(setores.map((s) => s.id));
  const porNumero = new Map<number, Array<[number, number]>>();
  const foraDaGrade: Array<[number, number]> = [];
  const semSetor: Array<[number, number]> = [];
  const semNumero: Array<[number, number]> = [];
  let temPalco = false;

  for (const c of grade.celulas) {
    if (c.linha < 1 || c.linha > grade.filas || c.coluna < 1 || c.coluna > grade.colunas)
      foraDaGrade.push([c.linha, c.coluna]);
    if (c.tipo === "palco") temPalco = true;
    if (c.tipo !== "assento") continue;
    if (c.numero === null || c.numero < 1) semNumero.push([c.linha, c.coluna]);
    else porNumero.set(c.numero, [...(porNumero.get(c.numero) ?? []), [c.linha, c.coluna]]);
    if (!c.setorId || !idsSetor.has(c.setorId)) semSetor.push([c.linha, c.coluna]);
  }

  if (foraDaGrade.length)
    problemas.push({
      gravidade: "erro",
      mensagem: `${foraDaGrade.length} quadrado(s) fora da grade`,
      posicoes: foraDaGrade,
    });
  for (const [numero, posicoes] of porNumero) {
    if (posicoes.length > 1)
      problemas.push({ gravidade: "erro", mensagem: `Número ${numero} repetido`, posicoes });
  }
  if (semNumero.length)
    problemas.push({
      gravidade: "erro",
      mensagem: `${semNumero.length} assento(s) sem número`,
      posicoes: semNumero,
    });
  if (semSetor.length)
    problemas.push({
      gravidade: "erro",
      mensagem: `${semSetor.length} assento(s) sem setor`,
      posicoes: semSetor,
    });
  if (!temPalco)
    problemas.push({
      gravidade: "aviso",
      mensagem: "O mapa não tem palco. As famílias se orientam por ele.",
      posicoes: [],
    });
  return problemas;
}

export type RegraNumeracao = "por_fila" | "continua";
export type Sentido = "esquerda_direita" | "direita_esquerda";

/** Renumera os assentos, de cima para baixo, na regra e no sentido escolhidos. */
export function numerar(celulas: Celula[], regra: RegraNumeracao, sentido: Sentido): Celula[] {
  const assentos = celulas
    .filter((c) => c.tipo === "assento")
    .sort(
      (a, b) =>
        a.linha - b.linha ||
        (sentido === "esquerda_direita" ? a.coluna - b.coluna : b.coluna - a.coluna),
    );
  const novos = new Map<string, number>();
  let contador = 0;
  let linhaAtual = -1;
  for (const c of assentos) {
    if (regra === "por_fila" && c.linha !== linhaAtual) {
      contador = 0;
      linhaAtual = c.linha;
    }
    contador += 1;
    novos.set(chave(c.linha, c.coluna), contador);
  }
  return celulas.map((c) =>
    c.tipo === "assento" ? { ...c, numero: novos.get(chave(c.linha, c.coluna)) ?? c.numero } : c,
  );
}

/** Formato da função do banco `salvar_mapa(p_mapa, p_colunas, p_filas, p_celulas)`. */
export function paraSalvarMapa(grade: Grade) {
  return {
    p_colunas: grade.colunas,
    p_filas: grade.filas,
    p_celulas: grade.celulas.map((c) => ({
      linha: c.linha,
      coluna: c.coluna,
      tipo: c.tipo,
      rotulo_fila: c.rotuloFila,
      numero: c.tipo === "assento" ? c.numero : null,
      setor_id: c.tipo === "assento" ? c.setorId : null,
      acessivel: c.tipo === "assento" && c.acessivel,
      bloqueado_padrao: c.tipo === "assento" && c.bloqueadoPadrao,
    })),
  };
}

/** Linhas da tabela `mapa_celulas` para o formato do editor. */
export interface LinhaMapaCelulas {
  linha: number;
  coluna: number;
  tipo: string;
  rotulo_fila: string | null;
  numero: number | null;
  setor_id: string | null;
  acessivel: boolean;
  bloqueado_padrao: boolean;
}

export function deMapaCelulas(colunas: number, filas: number, linhas: LinhaMapaCelulas[]): Grade {
  return {
    colunas,
    filas,
    celulas: linhas
      .filter(
        (l): l is LinhaMapaCelulas & { tipo: TipoCelula } =>
          l.tipo === "assento" || l.tipo === "corredor" || l.tipo === "palco",
      )
      .map((l) => ({
        linha: l.linha,
        coluna: l.coluna,
        tipo: l.tipo,
        rotuloFila: l.rotulo_fila,
        numero: l.numero,
        setorId: l.setor_id,
        acessivel: l.acessivel,
        bloqueadoPadrao: l.bloqueado_padrao,
      })),
  };
}

export interface LeituraCsv {
  grade: Grade | null;
  setoresFaltando: string[];
  erros: string[];
}

function verdadeiro(valor: string | undefined): boolean {
  return ["1", "s", "sim", "true", "x"].includes(normalizarNome(valor ?? ""));
}

/**
 * Lê um CSV de mapa. Aceita dois formatos de cabeçalho:
 * 1. numero,setor,fila,coluna,lado  (fila 1 = mais perto do palco; o palco entra na linha 1)
 * 2. linha,coluna,tipo,fila,numero,setor,acessivel,bloqueado  (formato completo, igual à exportação)
 * Setores são casados pelo nome, sem acento e sem diferença de maiúsculas.
 */
export function lerCsvMapa(texto: string, setores: Setor[]): LeituraCsv {
  const linhas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const cabecalho = (linhas.shift() ?? "").split(/[;,]/).map((h) => normalizarNome(h));
  const pos = (nome: string) => cabecalho.indexOf(nome);
  const setorPorNome = new Map(setores.map((s) => [normalizarNome(s.nome), s.id]));
  const faltando = new Set<string>();
  const erros: string[] = [];
  const celulas: Celula[] = [];

  const iSetor = pos("setor");
  const iNumero = pos("numero");
  const iColuna = pos("coluna");
  const formatoCompleto = pos("linha") >= 0 && pos("tipo") >= 0;
  const formatoSimples = !formatoCompleto && pos("fila") >= 0 && iNumero >= 0 && iColuna >= 0;

  if (!formatoCompleto && !formatoSimples) {
    return {
      grade: null,
      setoresFaltando: [],
      erros: [
        "Cabeçalho não reconhecido. Use numero,setor,fila,coluna ou o formato exportado pelo editor.",
      ],
    };
  }

  const deslocamento = formatoSimples ? 2 : 0;

  linhas.forEach((bruta, i) => {
    const campos = bruta.split(/[;,]/).map((c) => c.trim());
    const ler = (indice: number) => (indice >= 0 ? (campos[indice] ?? "") : "");
    const coluna = Number.parseInt(ler(iColuna), 10);
    const fila = ler(pos("fila"));
    const linha = formatoCompleto
      ? Number.parseInt(ler(pos("linha")), 10)
      : Number.parseInt(fila, 10) + deslocamento;
    const tipo = formatoCompleto ? (normalizarNome(ler(pos("tipo"))) as TipoCelula) : "assento";
    if (!Number.isFinite(linha) || !Number.isFinite(coluna)) {
      erros.push(`Linha ${i + 2} do arquivo: posição inválida`);
      return;
    }
    if (tipo !== "assento" && tipo !== "corredor" && tipo !== "palco") {
      erros.push(`Linha ${i + 2} do arquivo: tipo desconhecido`);
      return;
    }
    if (tipo !== "assento") {
      celulas.push(novaCelula(linha, coluna, tipo));
      return;
    }
    const nomeSetor = ler(iSetor);
    const setorId = setorPorNome.get(normalizarNome(nomeSetor)) ?? null;
    if (!setorId && nomeSetor) faltando.add(nomeSetor);
    const numero = Number.parseInt(ler(iNumero), 10);
    celulas.push({
      linha,
      coluna,
      tipo: "assento",
      rotuloFila: fila || null,
      numero: Number.isFinite(numero) ? numero : null,
      setorId,
      acessivel: verdadeiro(ler(pos("acessivel"))),
      bloqueadoPadrao: verdadeiro(ler(pos("bloqueado"))),
    });
  });

  if (!celulas.length)
    return {
      grade: null,
      setoresFaltando: [...faltando],
      erros: [...erros, "O arquivo não tem quadrados."],
    };

  let colunas = Math.max(...celulas.map((c) => c.coluna));
  let filas = Math.max(...celulas.map((c) => c.linha));

  if (formatoSimples) {
    const primeira = celulas.filter((c) => c.linha === 1 + deslocamento);
    const inicio = Math.min(...primeira.map((c) => c.coluna));
    const fim = Math.max(...primeira.map((c) => c.coluna));
    for (let c = inicio; c <= fim; c += 1) celulas.push(novaCelula(1, c, "palco"));
  }

  colunas = Math.min(colunas, LIMITE_COLUNAS);
  filas = Math.min(filas, LIMITE_FILAS);
  return { grade: { colunas, filas, celulas }, setoresFaltando: [...faltando], erros };
}

/** CSV no formato completo, para cópia de segurança ou para editar fora. */
export function paraCsv(grade: Grade, setores: Setor[]): string {
  const nomePorId = new Map(setores.map((s) => [s.id, s.nome]));
  const linhas = ["linha,coluna,tipo,fila,numero,setor,acessivel,bloqueado"];
  const ordenadas = [...grade.celulas].sort((a, b) => a.linha - b.linha || a.coluna - b.coluna);
  for (const c of ordenadas) {
    linhas.push(
      [
        c.linha,
        c.coluna,
        c.tipo,
        c.rotuloFila ?? "",
        c.numero ?? "",
        c.setorId ? (nomePorId.get(c.setorId) ?? "") : "",
        c.acessivel ? "sim" : "",
        c.bloqueadoPadrao ? "sim" : "",
      ].join(","),
    );
  }
  return linhas.join("\n");
}
