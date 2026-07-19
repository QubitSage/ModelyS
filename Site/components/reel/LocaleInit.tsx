"use client";

import { useEffect } from "react";
import { useNavigation } from "@/lib/reel-store";
import type { Locale } from "@/content/site";

/**
 * Define o idioma no cliente após montar (evita mismatch de hidratação): usa a
 * escolha salva; senão, detecta pelo navegador (pt* → pt, resto → en). Não
 * renderiza nada. O toggle do header sobrescreve e persiste.
 */
export function LocaleInit() {
  const setLocale = useNavigation((s) => s.setLocale);
  useEffect(() => {
    let chosen: Locale | null = null;
    try {
      const saved = localStorage.getItem("modely_lang");
      if (saved === "en" || saved === "pt") chosen = saved;
    } catch { /* localStorage indisponível */ }
    if (!chosen) chosen = navigator.language?.toLowerCase().startsWith("pt") ? "pt" : "en";
    setLocale(chosen);
  }, [setLocale]);
  return null;
}
