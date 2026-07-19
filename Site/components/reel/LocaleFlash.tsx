"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@/lib/reel-store";

/**
 * Efeito ao trocar o idioma: um wipe escuro varrendo a tela + o código do idioma
 * (EN/PT) surgindo no centro. Ignora a definição inicial do LocaleInit (só dispara
 * em trocas do usuário, ~1.5s após montar).
 */
export function LocaleFlash() {
  const locale = useNavigation((s) => s.locale);
  const [show, setShow] = useState<string | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => { ready.current = true; }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    setShow(locale.toUpperCase());
    const t = setTimeout(() => setShow(null), 750);
    return () => clearTimeout(t);
  }, [locale]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={show}
          className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden
        >
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)", "inset(0 0 0 100%)"] }}
            transition={{ duration: 0.75, times: [0, 0.5, 1], ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.span
            className="relative text-white text-5xl font-light tracking-[0.45em] sm:text-7xl"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.94, 1, 1, 1.02] }}
            transition={{ duration: 0.75, times: [0, 0.28, 0.62, 1] }}
          >
            {show}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
