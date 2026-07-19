"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type Props = {
  onClose: () => void;
  children: React.ReactNode;
  /** id do elemento que rotula o overlay (aria-labelledby). */
  labelledBy?: string;
  className?: string;
};

/**
 * Casca compartilhada de todo overlay:
 * - anima entrada/saída (o pai controla via <AnimatePresence>)
 * - fecha com ESC
 * - trap de foco (Tab cicla dentro do painel)
 * - devolve o foco ao elemento que abriu o overlay ao desmontar
 * - botão de fechar (X)
 */
export function OverlayShell({
  onClose,
  children,
  labelledBy,
  className = "",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    // foca o primeiro elemento focável (ou o próprio painel)
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables && focusables.length
      ? focusables[0]
      : panel
    )?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* painel */}
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className={`absolute inset-0 outline-none ${className}`}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-5 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white transition-all hover:rotate-90 hover:bg-white hover:text-black sm:right-8 sm:top-6"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M1 1L15 15M15 1L1 15"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
