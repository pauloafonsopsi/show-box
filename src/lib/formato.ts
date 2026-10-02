/** Formatos de exibição em pt-BR, fuso America/Belem (UTC-3, sem horário de verão). */

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function dinheiro(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return "Sem preço";
  return moeda.format(centavos / 100);
}

/** "240,00" -> 24000. Aceita "240", "240,5", "1.240,00". */
export function centavosDeTexto(texto: string): number | null {
  const limpo = texto.replace(/[^\d,]/g, "").replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function textoDeCentavos(c: number | null | undefined): string {
  if (c === null || c === undefined) return "";
  return (c / 100).toFixed(2).replace(".", ",");
}

const FUSO = "America/Belem";

function partes(iso: string) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return { dia: p("day"), mes: p("month"), ano: p("year"), hora: p("hour"), minuto: p("minute") };
}

export function data(iso: string | null | undefined): string {
  if (!iso) return "Sem data";
  const p = partes(iso);
  return `${p.dia}/${p.mes}/${p.ano}`;
}

export function hora(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = partes(iso);
  const h = String(Number(p.hora));
  return p.minuto === "00" ? `${h}h` : `${h}h${p.minuto}`;
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "Sem data";
  return `${data(iso)} às ${hora(iso)}`;
}

/** ISO -> valor de <input type="datetime-local"> no fuso de Belém. */
export function paraInputLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (Belém) -> ISO com fuso. */
export function deInputLocal(v: string): string | null {
  if (!v) return null;
  return `${v}:00-03:00`;
}

export function whatsappExibir(w: string | null | undefined): string {
  if (!w) return "";
  const d = w.replace(/\D/g, "");
  const m = d.match(/^55(\d{2})(\d{5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : w;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** "Maria", "Maria e Clara", "Maria, Clara e Júlia". */
export function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function preencher(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (todo, nome: string) => vars[nome] ?? todo);
}

export function variaveisDoTexto(texto: string): string[] {
  return Array.from(new Set(Array.from(texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g), (m) => m[1] ?? "")));
}

export function mensagemDeErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    if (e.message.includes("Failed to fetch"))
      return "Sem conexão. Não deu para saber se salvou; confira a tela e tente de novo.";
    return e.message;
  }
  return "Algo deu errado. Tente de novo.";
}

export function gerarSlug(nome: string): string {
  return nome
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
