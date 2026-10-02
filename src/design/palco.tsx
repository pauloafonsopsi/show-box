/**
 * Componentes-base do design system. Escrito pelo Claude. Aplicar sem alterar.
 * Proscênio, cortina, poltrona, grade de poltronas e selo de status.
 * Cores só pelos tokens de src/styles.css.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Accessibility, AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Proscênio: o arco dourado que emoldura o palco.                     */
/* ------------------------------------------------------------------ */

export function Proscenio({
  className,
  rotulo = "Palco",
}: {
  className?: string;
  rotulo?: string;
}) {
  return (
    <div className={cn("relative w-full", className)} aria-label={rotulo} role="img">
      <svg
        viewBox="0 0 400 44"
        preserveAspectRatio="none"
        className="block h-10 w-full"
        aria-hidden="true"
      >
        <path
          d="M2 44 V18 Q2 4 18 4 H382 Q398 4 398 18 V44"
          fill="none"
          stroke="var(--ouro)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M10 44 V20 Q10 11 21 11 H379 Q390 11 390 20 V44"
          fill="none"
          stroke="var(--ouro)"
          strokeOpacity="0.45"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="titulo-palco absolute inset-x-0 top-3 text-center text-sm text-muted-foreground">
        {rotulo}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cortina: abre uma vez por evento, no primeiro acesso.               */
/* Só CSS, até 900 ms, respeita "reduzir movimento", nunca segura      */
/* o conteúdo (que carrega por trás) e nunca bloqueia cliques.         */
/* ------------------------------------------------------------------ */

const DURACAO_CORTINA_MS = 850;

function cortinaJaVista(chave: string): boolean {
  try {
    return window.localStorage.getItem(`cortina:${chave}`) === "1";
  } catch {
    return true;
  }
}

function marcarCortina(chave: string) {
  try {
    window.localStorage.setItem(`cortina:${chave}`, "1");
  } catch {
    /* sem armazenamento: a cortina simplesmente não volta a aparecer nesta visita */
  }
}

export function Cortina({ chave }: { chave: string }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduzir || cortinaJaVista(chave)) return;
    marcarCortina(chave);
    setVisivel(true);
    const t = window.setTimeout(() => setVisivel(false), DURACAO_CORTINA_MS + 150);
    return () => window.clearTimeout(t);
  }, [chave]);

  if (!visivel) return null;

  const pregas: CSSProperties = {
    backgroundColor: "var(--veludo)",
    backgroundImage:
      "repeating-linear-gradient(90deg, oklch(0 0 0 / 0.22) 0 2px, transparent 2px 22px, oklch(1 0 0 / 0.06) 22px 24px, transparent 24px 46px)",
    animationDuration: `${DURACAO_CORTINA_MS}ms`,
    animationTimingFunction: "cubic-bezier(0.7, 0, 0.2, 1)",
    animationFillMode: "forwards",
    animationDelay: "120ms",
  };

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 flex overflow-hidden">
      <div className="h-full w-1/2" style={{ ...pregas, animationName: "cortina-abre-esquerda" }} />
      <div className="h-full w-1/2" style={{ ...pregas, animationName: "cortina-abre-direita" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Poltrona                                                            */
/* ------------------------------------------------------------------ */

export type EstadoPoltrona = "livre" | "escolhida" | "ocupada" | "outra-pessoa" | "bloqueada";

const NOME_ESTADO: Record<EstadoPoltrona, string> = {
  livre: "livre",
  escolhida: "escolhida por você",
  ocupada: "ocupada",
  "outra-pessoa": "sendo escolhida agora",
  bloqueada: "indisponível",
};

export interface PoltronaProps {
  numero: number;
  estado: EstadoPoltrona;
  tamanho: number;
  fila?: string | null;
  setor?: string | null;
  corSetor?: string | null;
  acessivel?: boolean;
  mostrarNumero?: boolean;
  destaque?: boolean;
  onClick?: () => void;
}

export function Poltrona({
  numero,
  estado,
  tamanho,
  fila,
  setor,
  corSetor,
  acessivel = false,
  mostrarNumero = true,
  destaque = false,
  onClick,
}: PoltronaProps) {
  const clicavel = Boolean(onClick) && (estado === "livre" || estado === "escolhida");
  const rotulo = [
    fila ? `Fila ${fila}` : null,
    `poltrona ${numero}`,
    setor ? `setor ${setor}` : null,
    NOME_ESTADO[estado],
  ]
    .filter(Boolean)
    .join(", ");

  const estilo: CSSProperties = {
    width: tamanho,
    height: tamanho,
    borderRadius: `${Math.max(3, tamanho * 0.24)}px ${Math.max(3, tamanho * 0.24)}px ${Math.max(2, tamanho * 0.09)}px ${Math.max(2, tamanho * 0.09)}px`,
    fontSize: Math.max(8, Math.min(13, tamanho * 0.36)),
    boxShadow:
      corSetor && estado === "livre"
        ? `inset 0 -${Math.max(2, tamanho * 0.08)}px 0 ${corSetor}`
        : undefined,
  };

  const classes = cn(
    "numeros relative inline-flex shrink-0 select-none items-center justify-center font-medium leading-none transition-colors",
    estado === "livre" && "border-[1.5px] border-poltrona-livre bg-transparent text-foreground",
    estado === "escolhida" &&
      "border-[1.5px] border-poltrona-escolhida bg-poltrona-escolhida text-poltrona-texto",
    estado === "ocupada" && "border border-transparent bg-poltrona-ocupada text-muted-foreground",
    estado === "outra-pessoa" &&
      "border-[1.5px] border-dashed border-poltrona-escolhida text-muted-foreground [animation:poltrona-pulso_1.6s_ease-in-out_infinite]",
    estado === "bloqueada" &&
      "border border-border text-muted-foreground [background-image:repeating-linear-gradient(135deg,var(--border)_0_2px,transparent_2px_6px)]",
    destaque && "outline outline-2 outline-offset-1 outline-erro",
    clicavel && "cursor-pointer hover:border-poltrona-escolhida",
  );

  const conteudo = (
    <>
      {estado === "ocupada" ? (
        <X
          aria-hidden="true"
          className="opacity-70"
          style={{ width: tamanho * 0.45, height: tamanho * 0.45 }}
        />
      ) : mostrarNumero && tamanho >= 18 ? (
        numero
      ) : null}
      {acessivel ? (
        <Accessibility
          aria-hidden="true"
          className="absolute -right-1 -top-1 rounded-full bg-background p-[1px] text-foreground"
          style={{ width: Math.max(10, tamanho * 0.36), height: Math.max(10, tamanho * 0.36) }}
        />
      ) : null}
    </>
  );

  if (!onClick) {
    return (
      <span role="img" aria-label={rotulo} title={rotulo} className={classes} style={estilo}>
        {conteudo}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={estado === "escolhida"}
      title={rotulo}
      disabled={!clicavel}
      onClick={onClick}
      className={classes}
      style={estilo}
    >
      {conteudo}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Grade de poltronas: desenha o mapa de uma sessão, ajustado à        */
/* largura. Usada no admin, na Bilheteria e como visão geral no Palco. */
/* ------------------------------------------------------------------ */

export interface CelulaGrade {
  linha: number;
  coluna: number;
  tipo: "assento" | "corredor" | "palco";
  numero?: number | null;
  rotuloFila?: string | null;
  estado?: EstadoPoltrona;
  setor?: string | null;
  corSetor?: string | null;
  acessivel?: boolean;
  destaque?: boolean;
}

export interface GradeDePoltronasProps {
  colunas: number;
  filas: number;
  celulas: CelulaGrade[];
  onEscolher?: (numero: number) => void;
  tamanhoMaximo?: number;
  mostrarRotulosDeFila?: boolean;
  className?: string;
}

export function GradeDePoltronas({
  colunas,
  filas,
  celulas,
  onEscolher,
  tamanhoMaximo = 34,
  mostrarRotulosDeFila = true,
  className,
}: GradeDePoltronasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const margemRotulo = mostrarRotulosDeFila ? 24 : 0;
  const espaco = 2;
  const tamanho = largura
    ? Math.max(8, Math.min(tamanhoMaximo, Math.floor((largura - margemRotulo) / colunas) - espaco))
    : tamanhoMaximo;

  const rotulosPorLinha = new Map<number, string>();
  for (const c of celulas)
    if (c.tipo === "assento" && c.rotuloFila && !rotulosPorLinha.has(c.linha))
      rotulosPorLinha.set(c.linha, c.rotuloFila);

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${margemRotulo ? `${margemRotulo}px ` : ""}repeat(${colunas}, ${tamanho}px)`,
          gridTemplateRows: `repeat(${filas}, ${tamanho}px)`,
          gap: espaco,
          justifyContent: "center",
        }}
      >
        {mostrarRotulosDeFila
          ? Array.from(rotulosPorLinha.entries()).map(([linha, rotulo]) => (
              <span
                key={`r${linha}`}
                className="numeros flex items-center justify-end pr-1 text-[11px] text-muted-foreground"
                style={{ gridRow: linha, gridColumn: 1 }}
                aria-hidden="true"
              >
                {rotulo}
              </span>
            ))
          : null}
        {celulas.map((c) => {
          const coluna = c.coluna + (margemRotulo ? 1 : 0);
          if (c.tipo === "palco") {
            return (
              <span
                key={`${c.linha}:${c.coluna}`}
                aria-hidden="true"
                className="bg-ouro/25"
                style={{ gridRow: c.linha, gridColumn: coluna }}
              />
            );
          }
          if (c.tipo === "corredor") {
            return (
              <span
                key={`${c.linha}:${c.coluna}`}
                aria-hidden="true"
                style={{ gridRow: c.linha, gridColumn: coluna }}
              />
            );
          }
          const numero = c.numero ?? 0;
          return (
            <span
              key={`${c.linha}:${c.coluna}`}
              className="flex items-center justify-center"
              style={{ gridRow: c.linha, gridColumn: coluna }}
            >
              <Poltrona
                numero={numero}
                estado={c.estado ?? "livre"}
                tamanho={tamanho}
                fila={c.rotuloFila ?? null}
                setor={c.setor ?? null}
                corSetor={c.corSetor ?? null}
                acessivel={c.acessivel ?? false}
                destaque={c.destaque ?? false}
                {...(onEscolher ? { onClick: () => onEscolher(numero) } : {})}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Selo de status: sempre cor, ícone e texto juntos.                   */
/* ------------------------------------------------------------------ */

export type TomStatus = "sucesso" | "aviso" | "erro" | "neutro";

const ICONE_STATUS: Record<TomStatus, typeof CheckCircle2> = {
  sucesso: CheckCircle2,
  aviso: AlertTriangle,
  erro: XCircle,
  neutro: Info,
};

export function SeloStatus({
  tom,
  children,
  className,
}: {
  tom: TomStatus;
  children: ReactNode;
  className?: string;
}) {
  const Icone = ICONE_STATUS[tom];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm font-medium",
        tom === "sucesso" && "border-sucesso/40 text-sucesso",
        tom === "aviso" && "border-aviso/50 text-foreground",
        tom === "erro" && "border-erro/40 text-erro",
        tom === "neutro" && "border-border text-muted-foreground",
        className,
      )}
    >
      <Icone aria-hidden="true" className={cn("h-4 w-4", tom === "aviso" && "text-aviso")} />
      {children}
    </span>
  );
}
