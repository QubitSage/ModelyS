"use client";

import { create } from "zustand";
import { DEFAULT_LOCALE, type Locale } from "@/content/site";

/**
 * Estado global de navegação por CAMADAS (overlays) + idioma do site.
 * A página nunca troca de rota nem rola — só muda qual overlay está ativo por
 * cima do hero. `locale` alterna EN/PT (persistido em localStorage).
 */
type NavigationState = {
  activeOverlay: string | null;
  /** True enquanto o preloader ainda está visível (vídeo não pronto). */
  isLoading: boolean;
  /** Idioma atual. Começa no DEFAULT (SSR-safe); LocaleInit ajusta no cliente. */
  locale: Locale;
  openOverlay: (id: string) => void;
  closeOverlay: () => void;
  setLoaded: () => void;
  setLocale: (l: Locale) => void;
};

export const useNavigation = create<NavigationState>((set) => ({
  activeOverlay: null,
  isLoading: true,
  locale: DEFAULT_LOCALE,
  openOverlay: (id) => set({ activeOverlay: id }),
  closeOverlay: () => set({ activeOverlay: null }),
  setLoaded: () => set({ isLoading: false }),
  setLocale: (l) => {
    try { localStorage.setItem("modely_lang", l); } catch { /* privado/off */ }
    set({ locale: l });
  },
}));
