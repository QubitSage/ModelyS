"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useNavigation } from "@/lib/reel-store";
import { content } from "@/content/site";

/**
 * Tela de carregamento client-side. Fica por cima de tudo enquanto o vídeo do
 * hero não está pronto. Some com fade (Framer Motion) quando `isLoading` vira
 * false (disparado pelo onCanPlay do <HeroVideo />).
 *
 * As animações internas (pulso da marca, barra) são CSS — animações infinitas em
 * Framer travariam o exit do AnimatePresence.
 */
export function Preloader() {
  const isLoading = useNavigation((s) => s.isLoading);
  const locale = useNavigation((s) => s.locale);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="preloader"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
          aria-hidden
        >
          <div className="flex flex-col items-center gap-6">
            <span className="preloader-brand text-3xl font-light tracking-[0.3em] text-white">
              {content[locale].brand}
            </span>
            <div className="h-px w-40 overflow-hidden bg-white/15">
              <div className="preloader-bar h-full w-full bg-white" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
