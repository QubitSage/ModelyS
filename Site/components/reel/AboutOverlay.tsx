"use client";

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
            <motion.div custom={2} variants={fade} initial="hidden" animate="show" className="mt-14">
              <h3 className="mb-6 text-xs uppercase tracking-[0.2em] text-white/40">
                {about.clientsTitle}
              </h3>
              <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
                <div className="logo-marquee flex w-max items-center gap-16 sm:gap-24">
                  {[...about.clients, ...about.clients, ...about.clients].map((c, i) =>
                    c.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={c.name + i}
                        src={c.logo}
                        alt={c.name}
                        title={c.name}
                        className="h-6 w-auto shrink-0 object-contain opacity-40 invert transition-opacity duration-300 hover:opacity-90 sm:h-7"
                      />
                    ) : (
                      <span
                        key={c.name + i}
                        className="shrink-0 text-sm font-medium tracking-wide text-white/25"
                      >
                        {c.name}
                      </span>
                    )
                  )}
                </div>
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
