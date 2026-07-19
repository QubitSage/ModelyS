"use client";

import { useEffect } from "react";

/**
 * Trava o scroll da página SÓ enquanto a home (o reel) está montada.
 * Adiciona a classe `.reel-no-scroll` na <html> ao montar e remove ao desmontar.
 *
 * Motivo: o reel é 100dvh sem rolagem, mas se este app também tiver outras rotas
 * (ex: páginas de entrega em /[slug]), elas PRECISAM rolar. Escopando o lock à
 * home, nada quebra nas outras páginas.
 */
export function ScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("reel-no-scroll");
    return () => root.classList.remove("reel-no-scroll");
  }, []);

  return null;
}
