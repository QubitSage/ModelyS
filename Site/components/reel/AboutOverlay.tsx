"use client";

import { motion } from "framer-motion";
import { content, CONTACT_OVERLAY } from "@/content/site";
import { useNavigation } from "@/lib/reel-store";
import { OverlayShell } from "./OverlayShell";

/**
 * Overlay "Sobre / About". Conteúdo é placeholder por ora (o usuário preenche
 * depois). Mesmo padrão dos outros overlays: casca compartilhada + cascata suave.
 */

// Posições espalhadas pelo campo dos logos. Cicla se houver mais logos que slots.
// top/left = ponto de ancoragem (o translate -50% centraliza ali); anim/dur/delay
// dão a deriva flutuante; h = tamanho (uns maiores, outros menores, dá profundidade).
const SCATTER = [
  { top: "26%", left: "12%", anim: "logoFloat1", dur: 7.0, delay: 0.0, h: "h-11 sm:h-14" },
  { top: "64%", left: "30%", anim: "logoFloat3", dur: 8.6, delay: 0.7, h: "h-9 sm:h-11" },
  { top: "22%", left: "52%", anim: "logoFloat2", dur: 7.8, delay: 0.3, h: "h-10 sm:h-12" },
  { top: "70%", left: "70%", anim: "logoFloat4", dur: 9.2, delay: 1.1, h: "h-11 sm:h-14" },
  { top: "38%", left: "86%", anim: "logoFloat1", dur: 8.2, delay: 0.5, h: "h-9 sm:h-11" },
  { top: "50%", left: "50%", anim: "logoFloat3", dur: 7.4, delay: 1.4, h: "h-10 sm:h-12" },
];

export function AboutOverlay({ onClose }: { onClose: () => void }) {
  const openOverlay = useNavigation((s) => s.openOverlay);
  const site = content[useNavigation((s) => s.locale)];
  const { about, ui } = site;
  const titleId = "about-title";

  const fade = {
    hidden: { opacity: 0, y: 18 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.1 + i * 0.09, duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
    }),
  };

  return (
    <OverlayShell onClose={onClose} labelledBy={titleId} className="bg-neutral-950/95">
      <div className="overlay-scroll h-full w-full px-5 pb-20 pt-20 sm:px-10 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <motion.div custom={0} variants={fade} initial="hidden" animate="show">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/40">
              {about.eyebrow}
            </p>
            <h2
              id={titleId}
              className="text-4xl font-light tracking-tight text-white sm:text-6xl"
            >
              {about.title}
            </h2>
          </motion.div>

          <motion.div
            custom={1}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-8 space-y-5"
          >
            {about.paragraphs.map((p) => (
              <p key={p} className="max-w-2xl text-base text-white/70 sm:text-lg">
                {p}
              </p>
            ))}
          </motion.div>

          {about.clients.length > 0 && (
            <motion.div custom={2} variants={fade} initial="hidden" animate="show" className="mt-14">
              <h3 className="mb-2 text-xs uppercase tracking-[0.2em] text-white/40">
                {about.clientsTitle}
              </h3>
              {/* campo de logos flutuando espalhados pelo canvas */}
              <div className="relative h-64 w-full sm:h-72">
                {about.clients.map((c, i) => {
                  const p = SCATTER[i % SCATTER.length];
                  return c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={c.name + i}
                      src={c.logo}
                      alt={c.name}
                      title={c.name}
                      style={{
                        top: p.top,
                        left: p.left,
                        animation: `${p.anim} ${p.dur}s ease-in-out ${p.delay}s infinite`,
                      }}
                      className={`logo-float ${p.h} w-auto object-contain opacity-70 invert transition-opacity duration-300 hover:opacity-100`}
                    />
                  ) : (
                    <span
                      key={c.name + i}
                      style={{ top: p.top, left: p.left, animation: `${p.anim} ${p.dur}s ease-in-out ${p.delay}s infinite` }}
                      className="logo-float text-base font-medium tracking-wide text-white/50"
                    >
                      {c.name}
                    </span>
                  );
                })}
              </div>
            </motion.div>
          )}

          <motion.div
            custom={3}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-12 flex flex-wrap gap-3"
          >
            <button
              onClick={() => openOverlay(CONTACT_OVERLAY)}
              className="rounded-full bg-white px-7 py-3.5 text-sm font-medium text-black transition-colors hover:bg-white/80"
            >
              {site.headerCta}
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-white/25 px-7 py-3.5 text-sm text-white transition-colors hover:bg-white/10"
            >
              {ui.back}
            </button>
          </motion.div>
        </div>
      </div>
    </OverlayShell>
  );
}
