import { useCallback, useEffect, useState } from "react";

/**
 * Rascunho de formulário no sessionStorage. Sobrevive a recarregar a página.
 * Chame `limpar()` ao salvar ou cancelar.
 */
export function useRascunho<T>(chave: string, inicial: T | undefined) {
  const chaveCompleta = `rascunho:${chave}`;
  const [valor, setValorInterno] = useState<T | undefined>(() => {
    try {
      const salvo = window.sessionStorage.getItem(chaveCompleta);
      if (salvo) return JSON.parse(salvo) as T;
    } catch {
      /* sem armazenamento */
    }
    return inicial;
  });
  const [temRascunho, setTemRascunho] = useState(() => {
    try {
      return window.sessionStorage.getItem(chaveCompleta) !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (valor === undefined && inicial !== undefined) setValorInterno(inicial);
  }, [inicial, valor]);

  const setValor = useCallback(
    (v: T) => {
      setValorInterno(v);
      setTemRascunho(true);
      try {
        window.sessionStorage.setItem(chaveCompleta, JSON.stringify(v));
      } catch {
        /* sem armazenamento */
      }
    },
    [chaveCompleta],
  );

  const limpar = useCallback(
    (novoInicial?: T) => {
      try {
        window.sessionStorage.removeItem(chaveCompleta);
      } catch {
        /* sem armazenamento */
      }
      setTemRascunho(false);
      setValorInterno(novoInicial);
    },
    [chaveCompleta],
  );

  return { valor, setValor, limpar, temRascunho };
}
