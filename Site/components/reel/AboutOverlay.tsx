"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { content, CONTACT_OVERLAY } from "@/content/site";
import { useNavigation } from "@/lib/reel-store";
import { OverlayShell } from "./OverlayShell";

/**
 * Overlay "Sobre / About". Conteúdo é placeholder por ora (o usuário preenche
 * depois). Mesmo padrão dos outros overlays: casca compartilhada + cascata suave.
 */
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
            <motion.div custom={2} variants={fade} initial="hidden" animate="show">
              <h3 className="mb-5 mt-14 text-xs uppercase tracking-[0.2em] text-white/40">
                {about.clientsTitle}
              </h3>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-4">
                {about.clients.map((c) => (
                  <div
                    key={c.name}
                    className="flex h-24 items-center justify-center bg-neutral-950 px-4"
                    title={c.name}
                  >
                    {c.logo ? (
                      <Image
                        src={c.logo}
                        alt={c.name}
                        width={140}
                        height={48}
                        className="max-h-10 w-auto object-contain opacity-70 invert transition-opacity hover:opacity-100"
                      />
                    ) : (
                      <span className="text-sm font-medium tracking-wide text-white/30">
                        {c.name}
                      </span>
                    )}
                  </div>
                ))}
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
