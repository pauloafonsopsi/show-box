/**
 * Editor de mapa em grade. Escrito pelo Claude. Aplicar sem alterar.
 * Interação delicada: pincéis, pintura por arraste, área, fila, inspetor,
 * numeração, desfazer e refazer, importação e exportação de CSV.
 * Não acessa o banco: recebe a grade e os setores, e entrega a grade em `onSalvar`.
 * Quem chama grava com `salvar_mapa` usando `paraSalvarMapa(grade)` de ./grade.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as PointerEventReact,
} from "react";
import {
  Accessibility,
  Ban,
  Hand,
  Trash2,
  X,
  Download,
  Eraser,
  Grid3x3,
  ListOrdered,
  MousePointerClick,
  Redo2,
  Rows3,
  Save,
  Square,
  SquareDashed,
  Undo2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Poltrona, SeloStatus } from "./palco";
import {
  LIMITE_COLUNAS,
  LIMITE_FILAS,
  chave,
  contar,
  indexar,
  lerCsvMapa,
  novaCelula,
  novoAssento,
  numerar,
  paraCsv,
  proximoNumero,
  rotuloDaLinha,
  validar,
  type Celula,
  type Grade,
  type RegraNumeracao,
  type Sentido,
  type Setor,
} from "./grade";

type Pincel = "assento" | "corredor" | "palco" | "borracha" | "setor" | "acessivel" | "bloqueio";
type Modo = "livre" | "area" | "fila" | "mover" | "inspecionar";

const PINCEIS: Array<{ id: Pincel; nome: string; Icone: typeof Square }> = [
  { id: "assento", nome: "Assento", Icone: Square },
  { id: "corredor", nome: "Corredor", Icone: SquareDashed },
  { id: "palco", nome: "Palco", Icone: Rows3 },
  { id: "borracha", nome: "Borracha", Icone: Eraser },
  { id: "setor", nome: "Pintar setor", Icone: Grid3x3 },
  { id: "acessivel", nome: "Acessível", Icone: Accessibility },
  { id: "bloqueio", nome: "Bloqueado", Icone: Ban },
];

const MODOS: Array<{ id: Modo; nome: string; dica: string }> = [
  { id: "livre", nome: "Livre", dica: "Clique ou arraste sobre os quadrados" },
  { id: "area", nome: "Área", dica: "Arraste de um canto ao outro" },
  { id: "fila", nome: "Fila", dica: "Clique no começo e no fim da mesma fila" },
  { id: "mover", nome: "Mover e editar", dica: "Arraste um assento para um quadrado vazio, ou toque nele para ver as opções" },
  { id: "inspecionar", nome: "Inspecionar", dica: "Clique num assento para editar" },
];

const LIMITE_HISTORICO = 60;

export interface EditorDeGradeProps {
  gradeInicial: Grade;
  setores: Setor[];
  onSalvar: (grade: Grade) => Promise<void>;
  emUsoEmSessoes?: number;
}

export function EditorDeGrade({
  gradeInicial,
  setores,
  onSalvar,
  emUsoEmSessoes = 0,
}: EditorDeGradeProps) {
  const [colunas, setColunas] = useState(gradeInicial.colunas);
  const [filas, setFilas] = useState(gradeInicial.filas);
  const [celulas, setCelulas] = useState<Map<string, Celula>>(() => indexar(gradeInicial.celulas));
  const [passado, setPassado] = useState<Array<Map<string, Celula>>>([]);
  const [futuro, setFuturo] = useState<Array<Map<string, Celula>>>([]);
  const [pincel, setPincel] = useState<Pincel>("assento");
  const [modo, setModo] = useState<Modo>("livre");
  const [setorAtivo, setSetorAtivo] = useState<string | null>(setores[0]?.id ?? null);
  const [tamanho, setTamanho] = useState(26);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [destaques, setDestaques] = useState<Set<string>>(new Set());
  const [ancora, setAncora] = useState<[number, number] | null>(null);
  const [areaAtual, setAreaAtual] = useState<[number, number] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{
    tom: "sucesso" | "erro" | "aviso";
    texto: string;
  } | null>(null);
  const [alterado, setAlterado] = useState(false);
  const pintando = useRef(false);
  const valorArraste = useRef<boolean | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const origemArraste = useRef<string | null>(null);
  const [alvoArraste, setAlvoArraste] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ k: string; x: number; y: number } | null>(null);
  const gradeRef = useRef<HTMLDivElement>(null);

  const setorPorId = useMemo(() => new Map(setores.map((s) => [s.id, s])), [setores]);
  const grade: Grade = useMemo(
    () => ({ colunas, filas, celulas: [...celulas.values()] }),
    [colunas, filas, celulas],
  );
  const contagem = useMemo(() => contar(celulas.values()), [celulas]);
  const problemas = useMemo(() => validar(grade, setores), [grade, setores]);
  const temErro = problemas.some((p) => p.gravidade === "erro");

  // Se o setor do pincel deixou de existir (ou ainda não havia setores), usa o primeiro disponível.
  useEffect(() => {
    if (!setorAtivo || !setores.some((s) => s.id === setorAtivo))
      setSetorAtivo(setores[0]?.id ?? null);
  }, [setores, setorAtivo]);

  // Aviso ao sair com alterações não salvas.
  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  const registrar = useCallback(
    (novo: Map<string, Celula>) => {
      setPassado((p) => [...p.slice(-(LIMITE_HISTORICO - 1)), celulas]);
      setFuturo([]);
      setCelulas(novo);
      setAlterado(true);
    },
    [celulas],
  );

  const desfazer = useCallback(() => {
    const anterior = passado.at(-1);
    if (!anterior) return;
    setPassado(passado.slice(0, -1));
    setFuturo([celulas, ...futuro]);
    setCelulas(anterior);
    setAlterado(true);
  }, [passado, futuro, celulas]);

  const refazer = useCallback(() => {
    const proximo = futuro[0];
    if (!proximo) return;
    setFuturo(futuro.slice(1));
    setPassado([...passado, celulas]);
    setCelulas(proximo);
    setAlterado(true);
  }, [passado, futuro, celulas]);

  const [lote, setLote] = useState<Set<string>>(new Set());
  const moverLoteRef = useRef<(dl: number, dc: number) => void>(() => {});

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ["INPUT", "SELECT", "TEXTAREA"].includes(alvo.tagName)) return;
      if (e.key === "Escape") {
        setMenu(null);
        setLote(new Set());
      }
      const setas: Record<string, [number, number]> = {
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
      };
      const d = setas[e.key];
      if (d) {
        e.preventDefault();
        moverLoteRef.current(d[0], d[1]);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) refazer();
        else desfazer();
      }
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [desfazer, refazer]);

  /** Aplica o pincel atual num conjunto de posições, sobre uma cópia. */
  const aplicar = useCallback(
    (
      base: Map<string, Celula>,
      posicoes: Array<[number, number]>,
      valorAlternado: boolean | null,
    ): Map<string, Celula> => {
      const novo = new Map(base);
      let numero = proximoNumero(novo.values());
      for (const [linha, coluna] of posicoes) {
        const k = chave(linha, coluna);
        const atual = novo.get(k);
        switch (pincel) {
          case "assento": {
            if (atual?.tipo === "assento") break;
            novo.set(
              k,
              novoAssento(linha, coluna, numero, setorAtivo, rotuloDaLinha(novo.values(), linha)),
            );
            numero += 1;
            break;
          }
          case "corredor":
          case "palco":
            novo.set(k, novaCelula(linha, coluna, pincel));
            break;
          case "borracha":
            novo.delete(k);
            break;
          case "setor":
            if (atual?.tipo === "assento" && setorAtivo)
              novo.set(k, { ...atual, setorId: setorAtivo });
            break;
          case "acessivel":
            if (atual?.tipo === "assento")
              novo.set(k, { ...atual, acessivel: valorAlternado ?? !atual.acessivel });
            break;
          case "bloqueio":
            if (atual?.tipo === "assento")
              novo.set(k, { ...atual, bloqueadoPadrao: valorAlternado ?? !atual.bloqueadoPadrao });
            break;
        }
      }
      return novo;
    },
    [pincel, setorAtivo],
  );

  const valorInicialAlternado = (linha: number, coluna: number): boolean | null => {
    const atual = celulas.get(chave(linha, coluna));
    if (atual?.tipo !== "assento") return null;
    if (pincel === "acessivel") return !atual.acessivel;
    if (pincel === "bloqueio") return !atual.bloqueadoPadrao;
    return null;
  };

  const posicaoDoEvento = (e: PointerEventReact<HTMLDivElement>): [number, number] | null => {
    const alvo = (
      document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    )?.closest<HTMLElement>("[data-l]");
    if (!alvo) return null;
    const l = Number(alvo.dataset["l"]);
    const c = Number(alvo.dataset["c"]);
    return Number.isFinite(l) && Number.isFinite(c) ? [l, c] : null;
  };

  const retangulo = (a: [number, number], b: [number, number]): Array<[number, number]> => {
    const posicoes: Array<[number, number]> = [];
    for (let l = Math.min(a[0], b[0]); l <= Math.max(a[0], b[0]); l += 1)
      for (let c = Math.min(a[1], b[1]); c <= Math.max(a[1], b[1]); c += 1) posicoes.push([l, c]);
    return posicoes;
  };

  const aoPressionar = (e: PointerEventReact<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pos = posicaoDoEvento(e);
    if (!pos) return;
    setMensagem(null);

    if (modo === "mover" || modo === "inspecionar") {
      const k = chave(pos[0], pos[1]);
      const ehAssento = celulas.get(k)?.tipo === "assento";
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        // Seleção múltipla, como arquivos no computador.
        if (!ehAssento) return;
        setMenu(null);
        setLote((atual) => {
          const novo = new Set(atual);
          if (novo.size === 0 && selecionada && selecionada !== k) novo.add(selecionada);
          if (novo.has(k)) novo.delete(k);
          else novo.add(k);
          return novo;
        });
        setSelecionada(null);
        return;
      }
      if (ehAssento && lote.size > 0 && !lote.has(k)) setLote(new Set());
      if (!ehAssento) setLote(new Set());
      if (modo === "inspecionar") {
        if (lote.size === 0 || !lote.has(k)) setSelecionada(ehAssento ? k : null);
        return;
      }
      if (ehAssento) {
        origemArraste.current = k;
        setAlvoArraste(k);
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      } else setMenu(null);
      return;
    }
    if (modo === "area") {
      setAncora(pos);
      setAreaAtual(pos);
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      return;
    }
    if (modo === "fila") {
      if (!ancora) {
        setAncora(pos);
        return;
      }
      if (ancora[0] !== pos[0]) {
        setMensagem({ tom: "aviso", texto: "O começo e o fim precisam estar na mesma fila." });
        setAncora(null);
        return;
      }
      registrar(aplicar(celulas, retangulo(ancora, pos), valorInicialAlternado(pos[0], pos[1])));
      setAncora(null);
      return;
    }
    pintando.current = true;
    valorArraste.current = valorInicialAlternado(pos[0], pos[1]);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    registrar(aplicar(celulas, [pos], valorArraste.current));
  };

  const aoMover = (e: PointerEventReact<HTMLDivElement>) => {
    const pos = posicaoDoEvento(e);
    if (!pos) return;
    if (modo === "area" && ancora) {
      setAreaAtual(pos);
      return;
    }
    if (modo === "mover") {
      if (origemArraste.current) setAlvoArraste(chave(pos[0], pos[1]));
      return;
    }
    if (!pintando.current) return;
    const k = chave(pos[0], pos[1]);
    const atual = celulas.get(k);
    const jaPintado =
      (pincel === "assento" && atual?.tipo === "assento") ||
      ((pincel === "corredor" || pincel === "palco") && atual?.tipo === pincel) ||
      (pincel === "borracha" && !atual) ||
      (pincel === "setor" && atual?.setorId === setorAtivo) ||
      (pincel === "acessivel" && atual?.acessivel === valorArraste.current) ||
      (pincel === "bloqueio" && atual?.bloqueadoPadrao === valorArraste.current);
    if (jaPintado) return;
    setCelulas((c) => aplicar(c, [pos], valorArraste.current));
  };

  const aoSoltar = () => {
    if (modo === "mover" && origemArraste.current) {
      const origem = origemArraste.current;
      const alvo = alvoArraste;
      origemArraste.current = null;
      setAlvoArraste(null);
      if (!alvo || alvo === origem) {
        if (lote.size > 0) return; // clique simples com lote ativo: não abre menu
        const el = gradeRef.current?.querySelector<HTMLElement>(
          `[data-l="${origem.split(":")[0]}"][data-c="${origem.split(":")[1]}"]`,
        );
        setSelecionada(origem);
        if (el) setMenu({ k: origem, x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight });
        return;
      }
      if (lote.size > 1 && lote.has(origem)) {
        const [ol, oc] = origem.split(":").map(Number) as [number, number];
        const [al, ac] = alvo.split(":").map(Number) as [number, number];
        moverConjunto(lote, al - ol, ac - oc);
        return;
      }
      if (celulas.has(alvo)) {
        setMensagem({ tom: "aviso", texto: "Solte o assento num quadrado vazio." });
        return;
      }
      const atual = celulas.get(origem);
      if (!atual) return;
      const [l, c] = alvo.split(":").map(Number) as [number, number];
      const novo = new Map(celulas);
      novo.delete(origem);
      novo.set(alvo, { ...atual, linha: l, coluna: c });
      registrar(novo);
      setSelecionada(alvo);
      setMenu(null);
      return;
    }
    if (modo === "area" && ancora && areaAtual) {
      registrar(
        aplicar(celulas, retangulo(ancora, areaAtual), valorInicialAlternado(ancora[0], ancora[1])),
      );
      setAncora(null);
      setAreaAtual(null);
    }
    pintando.current = false;
    valorArraste.current = null;
  };

  const naArea = (linha: number, coluna: number) =>
    modo === "area" &&
    ancora !== null &&
    areaAtual !== null &&
    linha >= Math.min(ancora[0], areaAtual[0]) &&
    linha <= Math.max(ancora[0], areaAtual[0]) &&
    coluna >= Math.min(ancora[1], areaAtual[1]) &&
    coluna <= Math.max(ancora[1], areaAtual[1]);

  const atualizarSelecionada = (mudanca: Partial<Celula>) => {
    if (!selecionada) return;
    const atual = celulas.get(selecionada);
    if (!atual) return;
    const novo = new Map(celulas);
    novo.set(selecionada, { ...atual, ...mudanca });
    registrar(novo);
  };

  const aplicarRotuloNaFila = () => {
    if (!selecionada) return;
    const atual = celulas.get(selecionada);
    if (!atual) return;
    const novo = new Map(celulas);
    for (const [k, c] of novo)
      if (c.linha === atual.linha && c.tipo === "assento")
        novo.set(k, { ...c, rotuloFila: atual.rotuloFila });
    registrar(novo);
  };

  /** Abre um vão empurrando tudo que está depois de `depoisDe` uma posição adiante. Nada é apagado. */
  const abrirVao = (eixo: "coluna" | "linha", depoisDe: number) => {
    const limite = eixo === "coluna" ? LIMITE_COLUNAS : LIMITE_FILAS;
    const total = eixo === "coluna" ? colunas : filas;
    const ultimoUsado = Math.max(0, ...[...celulas.values()].map((c) => c[eixo]));
    const novoTotal = ultimoUsado >= total ? total + 1 : total;
    if (novoTotal > limite) {
      setMensagem({ tom: "aviso", texto: "A grade chegou ao tamanho máximo." });
      return;
    }
    const novo = new Map<string, Celula>();
    for (const c of celulas.values()) {
      const m = c[eixo] > depoisDe ? { ...c, [eixo]: c[eixo] + 1 } : c;
      novo.set(chave(m.linha, m.coluna), m);
    }
    if (eixo === "coluna") setColunas(novoTotal);
    else setFilas(novoTotal);
    registrar(novo);
    const sel = selecionada ? celulas.get(selecionada) : null;
    if (sel) {
      const pos = sel[eixo] > depoisDe ? sel[eixo] + 1 : sel[eixo];
      setSelecionada(eixo === "coluna" ? chave(sel.linha, pos) : chave(pos, sel.coluna));
    }
    setMenu(null);
  };

  /** Fecha um vão: remove a coluna/linha `indice` (só se não tiver assento) e puxa o resto de volta. */
  const fecharVao = (eixo: "coluna" | "linha", indice: number) => {
    const total = eixo === "coluna" ? colunas : filas;
    if (indice < 1 || indice > total) return;
    if ([...celulas.values()].some((c) => c[eixo] === indice && c.tipo !== "corredor")) {
      setMensagem({ tom: "aviso", texto: "Ali não é um vão vazio: há assentos ou palco nessa linha." });
      return;
    }
    const novo = new Map<string, Celula>();
    for (const c of celulas.values()) {
      if (c[eixo] === indice) continue;
      const m = c[eixo] > indice ? { ...c, [eixo]: c[eixo] - 1 } : c;
      novo.set(chave(m.linha, m.coluna), m);
    }
    registrar(novo);
    const sel = selecionada ? celulas.get(selecionada) : null;
    if (sel) {
      const pos = sel[eixo] > indice ? sel[eixo] - 1 : sel[eixo];
      setSelecionada(eixo === "coluna" ? chave(sel.linha, pos) : chave(pos, sel.coluna));
    }
    setMenu(null);
  };

  /**
   * Move um conjunto de assentos juntos. Se passar da borda, a grade cresce
   * (abrindo vão como corredor); nada é apagado. Recusa se bater em outro assento.
   */
  const moverConjunto = (chaves: Set<string>, dl: number, dc: number): Set<string> | null => {
    const grupo = [...chaves].map((k) => celulas.get(k)).filter((c): c is Celula => !!c);
    if (!grupo.length || (dl === 0 && dc === 0)) return null;
    const restantes = new Map(celulas);
    for (const c of grupo) restantes.delete(chave(c.linha, c.coluna));
    const minL = Math.min(...grupo.map((c) => c.linha + dl));
    const minC = Math.min(...grupo.map((c) => c.coluna + dc));
    // Se passou da borda de cima/esquerda, empurra o mapa todo para abrir espaço.
    const offL = minL < 1 ? 1 - minL : 0;
    const offC = minC < 1 ? 1 - minC : 0;
    const base = new Map<string, Celula>();
    for (const c of restantes.values()) {
      const m = { ...c, linha: c.linha + offL, coluna: c.coluna + offC };
      base.set(chave(m.linha, m.coluna), m);
    }
    const movidos = grupo.map((c) => ({
      ...c,
      linha: c.linha + dl + offL,
      coluna: c.coluna + dc + offC,
    }));
    for (const m of movidos) {
      if (base.has(chave(m.linha, m.coluna))) {
        setMensagem({ tom: "aviso", texto: "Há outro assento no caminho. Abra um corredor antes." });
        return null;
      }
    }
    const usados = [...base.values(), ...movidos];
    const novasFilas = Math.max(filas + offL, ...usados.map((c) => c.linha));
    const novasColunas = Math.max(colunas + offC, ...usados.map((c) => c.coluna));
    if (novasFilas > LIMITE_FILAS || novasColunas > LIMITE_COLUNAS) {
      setMensagem({ tom: "aviso", texto: "A grade chegou ao tamanho máximo." });
      return null;
    }
    for (const m of movidos) base.set(chave(m.linha, m.coluna), m);
    setFilas(novasFilas);
    setColunas(novasColunas);
    registrar(base);
    const novoLote = new Set(movidos.map((m) => chave(m.linha, m.coluna)));
    setLote(novoLote);
    setSelecionada(null);
    setMenu(null);
    return novoLote;
  };

  const alterarLote = (mudanca: Partial<Celula> | "apagar") => {
    const novo = new Map(celulas);
    for (const k of lote) {
      const atual = novo.get(k);
      if (!atual) continue;
      if (mudanca === "apagar") novo.delete(k);
      else novo.set(k, { ...atual, ...mudanca });
    }
    registrar(novo);
    if (mudanca === "apagar") setLote(new Set());
  };

  /** Move todos os assentos de uma fileira juntos, sem desalinhar. */
  const moverFileira = (linha: number, dl: number, dc: number) => {
    const daFila = [...celulas.values()].filter((c) => c.linha === linha && c.tipo === "assento");
    if (!daFila.length) return;
    const restantes = new Map(celulas);
    for (const c of daFila) restantes.delete(chave(c.linha, c.coluna));
    for (const c of daFila) {
      const l = c.linha + dl;
      const col = c.coluna + dc;
      if (l < 1 || l > filas || col < 1 || col > colunas) {
        setMensagem({ tom: "aviso", texto: "A fileira encostou na borda da grade." });
        return;
      }
      if (restantes.has(chave(l, col))) {
        setMensagem({ tom: "aviso", texto: "Há outro assento no caminho. Abra um corredor antes." });
        return;
      }
    }
    for (const c of daFila) {
      const m = { ...c, linha: c.linha + dl, coluna: c.coluna + dc };
      restantes.set(chave(m.linha, m.coluna), m);
    }
    registrar(restantes);
    const sel = selecionada ? celulas.get(selecionada) : null;
    if (sel && sel.linha === linha) setSelecionada(chave(sel.linha + dl, sel.coluna + dc));
    setMenu(null);
  };

  const renumerar = (regra: RegraNumeracao, sentido: Sentido) => {
    const ok = window.confirm(
      "Renumerar muda o número de todos os assentos deste mapa. Sessões já congeladas não mudam. Continuar?",
    );
    if (!ok) return;
    registrar(indexar(numerar([...celulas.values()], regra, sentido)));
  };

  const redimensionar = (novasColunas: number, novasFilas: number) => {
    const c = Math.max(1, Math.min(LIMITE_COLUNAS, novasColunas || 1));
    const f = Math.max(1, Math.min(LIMITE_FILAS, novasFilas || 1));
    const fora = [...celulas.values()].filter((x) => x.coluna > c || x.linha > f);
    if (
      fora.length &&
      !window.confirm(
        `${fora.length} quadrado(s) ficam fora da nova grade e serão apagados. Continuar?`,
      )
    )
      return;
    const novo = new Map(celulas);
    for (const x of fora) novo.delete(chave(x.linha, x.coluna));
    setColunas(c);
    setFilas(f);
    registrar(novo);
  };

  const importarCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    const leitura = lerCsvMapa(await arquivo.text(), setores);
    if (!leitura.grade) {
      setMensagem({ tom: "erro", texto: leitura.erros.join(" ") });
      return;
    }
    if (leitura.setoresFaltando.length) {
      setMensagem({
        tom: "erro",
        texto: `Crie estes setores antes de importar: ${leitura.setoresFaltando.join(", ")}.`,
      });
      return;
    }
    if (celulas.size && !window.confirm("A importação substitui todo o desenho atual. Continuar?"))
      return;
    setColunas(leitura.grade.colunas);
    setFilas(leitura.grade.filas);
    registrar(indexar(leitura.grade.celulas));
    setMensagem({
      tom: leitura.erros.length ? "aviso" : "sucesso",
      texto: leitura.erros.length
        ? `Importado com avisos: ${leitura.erros.slice(0, 3).join("; ")}`
        : "Mapa importado. Confira e salve.",
    });
  };

  const exportarCsv = () => {
    const blob = new Blob([paraCsv(grade, setores)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mapa.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const salvar = async () => {
    if (temErro || salvando) return;
    setSalvando(true);
    setMensagem(null);
    try {
      await onSalvar(grade);
      setAlterado(false);
      setMensagem({ tom: "sucesso", texto: "Mapa salvo." });
    } catch (erro) {
      setMensagem({
        tom: "erro",
        texto: erro instanceof Error ? erro.message : "Não foi possível salvar. Tente de novo.",
      });
    } finally {
      setSalvando(false);
    }
  };

  moverLoteRef.current = (dl, dc) => {
    if (lote.size > 0) moverConjunto(lote, dl, dc);
  };
  const celulaSelecionada = selecionada ? (celulas.get(selecionada) ?? null) : null;
  const dicaModo = MODOS.find((m) => m.id === modo)?.dica ?? "";

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3">
        <div className="numeros flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            <strong>{contagem.total}</strong> assentos
          </span>
          {setores.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: s.cor }}
              />
              {s.nome}: {contagem.porSetor.get(s.id) ?? 0}
            </span>
          ))}
          <span className="text-muted-foreground">Bloqueados: {contagem.bloqueados}</span>
          <span className="text-muted-foreground">Acessíveis: {contagem.acessiveis}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={desfazer}
            disabled={!passado.length}
            aria-label="Desfazer"
          >
            <Undo2 className="h-4 w-4" /> Desfazer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={refazer}
            disabled={!futuro.length}
            aria-label="Refazer"
          >
            <Redo2 className="h-4 w-4" /> Refazer
          </Button>
          <Button variant="outline" size="sm" onClick={() => arquivoRef.current?.click()}>
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <input
            ref={arquivoRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={importarCsv}
          />
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!celulas.size}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button size="sm" onClick={salvar} disabled={temErro || salvando || !alterado}>
            <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar mapa"}
          </Button>
        </div>
      </div>

      {emUsoEmSessoes > 0 ? (
        <SeloStatus tom="neutro">
          Este mapa está em {emUsoEmSessoes} sessão(ões). Mudanças aqui não afetam sessões já
          congeladas.
        </SeloStatus>
      ) : null}
      {mensagem ? <SeloStatus tom={mensagem.tom}>{mensagem.texto}</SeloStatus> : null}

      <div className="grid min-h-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] 2xl:grid-cols-[13rem_minmax(0,1fr)_17rem]">
        {/* Ferramentas */}
        <aside
          className="flex flex-col gap-4 rounded-md border bg-card p-3"
          aria-label="Ferramentas"
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">Pincel</legend>
            {PINCEIS.map(({ id, nome, Icone }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPincel(id);
                  if (modo === "inspecionar") setModo("livre");
                }}
                aria-pressed={pincel === id && modo !== "inspecionar"}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md px-2 text-left text-sm",
                  pincel === id && modo !== "inspecionar"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                <Icone aria-hidden="true" className="h-4 w-4" /> {nome}
              </button>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Setor do pincel</span>
            <select
              className="min-h-11 rounded-md border bg-background px-2"
              value={setorAtivo ?? ""}
              onChange={(e) => setSetorAtivo(e.target.value || null)}
            >
              {setores.length === 0 ? <option value="">Crie um setor primeiro</option> : null}
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">Modo</legend>
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setModo(m.id);
                  setAncora(null);
                  setAreaAtual(null);
                }}
                aria-pressed={modo === m.id}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md px-2 text-left text-sm",
                  modo === m.id ? "bg-secondary font-semibold" : "hover:bg-accent",
                )}
              >
                {m.id === "mover" ? <Hand aria-hidden="true" className="h-4 w-4" /> : null}
                {m.id === "inspecionar" ? (
                  <MousePointerClick aria-hidden="true" className="h-4 w-4" />
                ) : null}
                {m.nome}
              </button>
            ))}
            <p className="mt-1 text-xs text-muted-foreground">{dicaModo}</p>
            {modo === "fila" && ancora ? (
              <p className="text-xs font-medium">
                Começo marcado na fila {ancora[0]}. Agora clique no fim.
              </p>
            ) : null}
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Zoom</span>
            <input
              type="range"
              min={16}
              max={40}
              value={tamanho}
              onChange={(e) => setTamanho(Number(e.target.value))}
            />
          </label>
        </aside>

        {/* Grade */}
        <section
          className="min-w-0 overflow-auto rounded-md border bg-card p-3"
          aria-label="Grade do mapa"
        >
          {celulas.size === 0 ? (
            <div className="flex flex-col items-start gap-2 p-6">
              <p className="titulo-palco text-2xl">Comece pelo palco</p>
              <p className="text-sm text-muted-foreground">
                Escolha o pincel Palco e pinte a primeira linha. Depois desenhe os assentos com o
                pincel Assento, ou importe um CSV.
              </p>
            </div>
          ) : null}
          {lote.size > 0 ? (
            <div
              className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-primary/50 bg-background p-2 text-sm"
              aria-label="Poltronas selecionadas"
            >
              <span className="font-semibold">
                {lote.size} {lote.size === 1 ? "poltrona selecionada" : "poltronas selecionadas"}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground">Mover juntas:</span>
                {(
                  [
                    ["←", 0, -1, "para a esquerda"],
                    ["→", 0, 1, "para a direita"],
                    ["↑", -1, 0, "para a frente"],
                    ["↓", 1, 0, "para trás"],
                  ] as const
                ).map(([seta, dl, dc, nome]) => (
                  <Button
                    key={nome}
                    variant="outline"
                    size="sm"
                    className="min-h-11 min-w-11"
                    aria-label={`Mover seleção ${nome}`}
                    onClick={() => moverConjunto(lote, dl, dc)}
                  >
                    {seta}
                  </Button>
                ))}
              </div>
              {setores.length ? (
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">Setor:</span>
                  <select
                    className="min-h-11 rounded-md border bg-background px-2 text-base"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) alterarLote({ setorId: e.target.value });
                      e.target.value = "";
                    }}
                  >
                    <option value="">Trocar para...</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Button variant="ghost" size="sm" className="min-h-11" onClick={() => alterarLote("apagar")}>
                Apagar
              </Button>
              <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setLote(new Set())}>
                Limpar seleção
              </Button>
            </div>
          ) : null}
          {lote.size > 0 ? null : celulaSelecionada ? (
            <div
              className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-background p-2 text-sm"
              aria-label="Corredores e fileira"
            >
              <span className="font-semibold">
                Fila {celulaSelecionada.rotuloFila ?? celulaSelecionada.linha}, lugar{" "}
                {celulaSelecionada.numero ?? ""}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground">Abrir corredor:</span>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => abrirVao("coluna", celulaSelecionada.coluna - 1)}>
                  à esquerda
                </Button>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => abrirVao("coluna", celulaSelecionada.coluna)}>
                  à direita
                </Button>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => abrirVao("linha", celulaSelecionada.linha - 1)}>
                  na frente
                </Button>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => abrirVao("linha", celulaSelecionada.linha)}>
                  atrás
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground">Fechar vão vazio:</span>
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => fecharVao("coluna", celulaSelecionada.coluna - 1)}>
                  esquerda
                </Button>
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => fecharVao("coluna", celulaSelecionada.coluna + 1)}>
                  direita
                </Button>
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => fecharVao("linha", celulaSelecionada.linha - 1)}>
                  frente
                </Button>
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => fecharVao("linha", celulaSelecionada.linha + 1)}>
                  trás
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground">Mover a fileira toda:</span>
                {(
                  [
                    ["←", 0, -1, "para a esquerda"],
                    ["→", 0, 1, "para a direita"],
                    ["↑", -1, 0, "para a frente"],
                    ["↓", 1, 0, "para trás"],
                  ] as const
                ).map(([seta, dl, dc, nome]) => (
                  <Button
                    key={nome}
                    variant="outline"
                    size="sm"
                    className="min-h-11 min-w-11"
                    aria-label={`Mover fileira ${nome}`}
                    onClick={() => moverFileira(celulaSelecionada.linha, dl, dc)}
                  >
                    {seta}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">
              Toque num assento (modo Mover e editar ou Inspecionar) para abrir corredores ao lado dele ou mover a fileira inteira.
            </p>
          )}
          <div className="relative w-max" ref={gradeRef}>
          <div
            className="proscenio mb-4 h-12 text-sm"
            style={{ width: colunas * (tamanho + 2) - 2 }}
            aria-label="Palco fica deste lado"
          >
            PALCO
          </div>
          <div
            role="presentation"
            className={cn("grid w-max touch-none select-none", modo === "mover" && "cursor-grab")}
            style={{
              gridTemplateColumns: `repeat(${colunas}, ${tamanho}px)`,
              gridTemplateRows: `repeat(${filas}, ${tamanho}px)`,
              gap: 2,
            }}
            onPointerDown={aoPressionar}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
          >
            {Array.from({ length: filas }, (_, i) => i + 1).flatMap((linha) =>
              Array.from({ length: colunas }, (_, j) => j + 1).map((coluna) => {
                const k = chave(linha, coluna);
                const c = celulas.get(k);
                const setor = c?.setorId ? setorPorId.get(c.setorId) : undefined;
                const marcada =
                  naArea(linha, coluna) ||
                  (modo === "fila" && ancora?.[0] === linha && ancora[1] === coluna);
                return (
                  <div
                    key={k}
                    data-l={linha}
                    data-c={coluna}
                    title={`Fila ${linha}, coluna ${coluna}`}
                    className={cn(
                      "relative flex items-center justify-center rounded-[3px]",
                      !c && "border border-dashed border-border/70",
                      c?.tipo === "palco" && "bg-ouro/45 shadow-[0_0_12px_var(--luz-palco)]",
                      c?.tipo === "corredor" && "bg-muted/60",
                      alvoArraste === k && !c && "ring-2 ring-primary bg-primary/20",
                      origemArraste.current === k && alvoArraste !== k && "opacity-40",
                      marcada && "ring-2 ring-ring",
                      selecionada === k && "ring-2 ring-primary",
                      lote.has(k) && "ring-2 ring-primary bg-primary/25",
                      alvoArraste === k && c && lote.size > 1 && "ring-2 ring-primary",
                    )}
                  >
                    {c?.tipo === "assento" ? (
                      <Poltrona
                        numero={c.numero ?? 0}
                        estado={c.bloqueadoPadrao ? "bloqueada" : "livre"}
                        tamanho={tamanho - 2}
                        fila={c.rotuloFila}
                        setor={setor?.nome ?? null}
                        corSetor={setor?.cor ?? null}
                        acessivel={c.acessivel}
                        destaque={destaques.has(k)}
                      />
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>
          {menu && celulas.get(menu.k)?.tipo === "assento" ? (
            <MenuAssento
              x={menu.x}
              y={menu.y}
              celula={celulas.get(menu.k) as Celula}
              setores={setores}
              aoMudar={(m) => {
                const atual = celulas.get(menu.k);
                if (!atual) return;
                const novo = new Map(celulas);
                novo.set(menu.k, { ...atual, ...m });
                registrar(novo);
              }}
              aoCorredor={() => {
                const atual = celulas.get(menu.k);
                if (!atual) return;
                const novo = new Map(celulas);
                novo.set(menu.k, novaCelula(atual.linha, atual.coluna, "corredor"));
                registrar(novo);
                setMenu(null);
                setSelecionada(null);
              }}
              aoApagar={() => {
                const novo = new Map(celulas);
                novo.delete(menu.k);
                registrar(novo);
                setMenu(null);
                setSelecionada(null);
              }}
              aoFechar={() => setMenu(null)}
            />
          ) : null}
          </div>
        </section>

        {/* Inspetor, problemas e numeração */}
        <aside className="flex flex-col gap-4 rounded-md border bg-card p-3" aria-label="Detalhes">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Assento selecionado</h3>
            {celulaSelecionada ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Número
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="min-h-11 rounded-md border bg-background px-2"
                    value={celulaSelecionada.numero ?? ""}
                    onChange={(e) =>
                      atualizarSelecionada({
                        numero: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Rótulo da fila
                  <input
                    className="min-h-11 rounded-md border bg-background px-2"
                    value={celulaSelecionada.rotuloFila ?? ""}
                    onChange={(e) => atualizarSelecionada({ rotuloFila: e.target.value || null })}
                  />
                </label>
                <Button variant="ghost" size="sm" onClick={aplicarRotuloNaFila}>
                  Usar este rótulo na fila inteira
                </Button>
                <label className="flex flex-col gap-1 text-sm">
                  Setor
                  <select
                    className="min-h-11 rounded-md border bg-background px-2"
                    value={celulaSelecionada.setorId ?? ""}
                    onChange={(e) => atualizarSelecionada({ setorId: e.target.value || null })}
                  >
                    <option value="">Sem setor</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={celulaSelecionada.acessivel}
                    onChange={(e) => atualizarSelecionada({ acessivel: e.target.checked })}
                  />
                  Lugar acessível
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={celulaSelecionada.bloqueadoPadrao}
                    onChange={(e) => atualizarSelecionada({ bloqueadoPadrao: e.target.checked })}
                  />
                  Começa bloqueado nas sessões
                </label>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Use o modo Inspecionar e clique num assento.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Conferência</h3>
            {problemas.length === 0 ? (
              <SeloStatus tom="sucesso">Tudo certo para salvar</SeloStatus>
            ) : (
              <ul className="flex flex-col gap-1">
                {problemas.map((p) => (
                  <li key={p.mensagem}>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setDestaques(new Set(p.posicoes.map(([l, c]) => chave(l, c))))}
                    >
                      <SeloStatus tom={p.gravidade === "erro" ? "erro" : "aviso"}>
                        {p.mensagem}
                      </SeloStatus>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ListOrdered aria-hidden="true" className="h-4 w-4" /> Numeração automática
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => renumerar("continua", "esquerda_direita")}
            >
              Contínua, da esquerda para a direita
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => renumerar("por_fila", "esquerda_direita")}
            >
              Por fila, da esquerda para a direita
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => renumerar("por_fila", "direita_esquerda")}
            >
              Por fila, da direita para a esquerda
            </Button>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Tamanho da grade</h3>
            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">
                Colunas
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={LIMITE_COLUNAS}
                  defaultValue={colunas}
                  key={`c${colunas}`}
                  className="min-h-11 w-20 rounded-md border bg-background px-2"
                  onBlur={(e) => redimensionar(Number(e.target.value), filas)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Filas
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={LIMITE_FILAS}
                  defaultValue={filas}
                  key={`f${filas}`}
                  className="min-h-11 w-20 rounded-md border bg-background px-2"
                  onBlur={(e) => redimensionar(colunas, Number(e.target.value))}
                />
              </label>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MenuAssento({
  x,
  y,
  celula,
  setores,
  aoMudar,
  aoCorredor,
  aoApagar,
  aoFechar,
}: {
  x: number;
  y: number;
  celula: Celula;
  setores: Setor[];
  aoMudar: (m: Partial<Celula>) => void;
  aoCorredor: () => void;
  aoApagar: () => void;
  aoFechar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`Assento ${celula.rotuloFila ?? ""}${celula.numero ?? ""}`}
      className="absolute z-20 mt-2 flex w-64 -translate-x-1/2 flex-col gap-3 rounded-xl border bg-popover p-3 text-popover-foreground"
      style={{ left: Math.max(136, x), top: y, boxShadow: "var(--sombra-janela)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          Fila {celula.rotuloFila ?? celula.linha}, assento {celula.numero ?? "sem número"}
        </p>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Fila
          <input
            className="min-h-11 rounded-md border bg-background px-2 text-base text-foreground"
            value={celula.rotuloFila ?? ""}
            onChange={(e) => aoMudar({ rotuloFila: e.target.value || null })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Número
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="min-h-11 rounded-md border bg-background px-2 text-base text-foreground"
            value={celula.numero ?? ""}
            onChange={(e) => aoMudar({ numero: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">Setor</p>
        <div className="flex flex-wrap gap-1.5">
          {setores.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={celula.setorId === s.id}
              onClick={() => aoMudar({ setorId: s.id })}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-md border px-2 text-sm",
                celula.setorId === s.id ? "border-primary bg-accent" : "border-border",
              )}
            >
              <span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ background: s.cor }} />
              {s.nome}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          aria-pressed={celula.acessivel}
          onClick={() => aoMudar({ acessivel: !celula.acessivel })}
          className={cn(
            "flex min-h-11 items-center gap-1.5 rounded-md border px-2 text-sm",
            celula.acessivel ? "border-primary bg-accent" : "border-border",
          )}
        >
          <Accessibility className="h-4 w-4" /> Acessível
        </button>
        <button
          type="button"
          aria-pressed={celula.bloqueadoPadrao}
          onClick={() => aoMudar({ bloqueadoPadrao: !celula.bloqueadoPadrao })}
          className={cn(
            "flex min-h-11 items-center gap-1.5 rounded-md border px-2 text-sm",
            celula.bloqueadoPadrao ? "border-primary bg-accent" : "border-border",
          )}
        >
          <Ban className="h-4 w-4" /> Bloqueado
        </button>
        <button
          type="button"
          onClick={aoCorredor}
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-border px-2 text-sm"
        >
          <SquareDashed className="h-4 w-4" /> Corredor
        </button>
        <button
          type="button"
          onClick={aoApagar}
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-destructive/50 px-2 text-sm text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Apagar
        </button>
      </div>
    </div>
  );
}
