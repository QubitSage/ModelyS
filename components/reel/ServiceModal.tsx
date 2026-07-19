"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { content, CONTACT_OVERLAY, type Service } from "@/content/site";
import { useNavigation } from "@/lib/reel-store";
import { OverlayShell } from "./OverlayShell";

/**
 * Popup de um serviço/modelo de entrega. Abre por cima do reel com transição
 * suave (fade + rise do OverlayShell; conteúdo entra em cascata). Traz o
 * processo, os pacotes e o portfólio daquele serviço.
 */
export function ServiceModal({
  service,
  onClose,
}: {
  service: Service;
  onClose: () => void;
}) {
  const openOverlay = useNavigation((s) => s.openOverlay);
  const ui = content[useNavigation((s) => s.locale)].ui;
  const titleId = `service-title-${service.id}`;

  const fade = {
    hidden: { opacity: 0, y: 18 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
    }),
  };

  return (
    <OverlayShell onClose={onClose} labelledBy={titleId} className="bg-neutral-950/95">
      <div className="overlay-scroll h-full w-full px-5 pb-20 pt-20 sm:px-10 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          {/* cabeçalho */}
          <motion.div custom={0} variants={fade} initial="hidden" animate="show">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/40">
              {ui.deliveryModel}
            </p>
            <h2
              id={titleId}
              className="text-4xl font-light tracking-tight text-white sm:text-6xl"
            >
              {service.label}
            </h2>
            <p className="mt-4 max-w-xl text-base text-white/70 sm:text-lg">
              {service.description}
            </p>
          </motion.div>

          {/* processo */}
          <motion.div custom={1} variants={fade} initial="hidden" animate="show">
            <h3 className="mb-4 mt-12 text-xs uppercase tracking-[0.2em] text-white/40">
              {ui.howItWorks}
            </h3>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {service.process.map((step, i) => (
                <div key={step.title} className="flex gap-5 py-4">
                  <span className="font-serif text-lg text-white/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h4 className="text-white">{step.title}</h4>
                    <p className="mt-1 text-sm text-white/60">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* pacotes */}
          <motion.div custom={2} variants={fade} initial="hidden" animate="show">
            <h3 className="mb-4 mt-12 text-xs uppercase tracking-[0.2em] text-white/40">
              {ui.packages}
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {service.packages.map((pkg) => (
                <div
                  key={pkg.name}
                  className={`flex flex-col rounded-2xl border p-5 transition-colors ${
                    pkg.featured
                      ? "border-white/40 bg-white/[0.06]"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-white">{pkg.name}</h4>
                    {pkg.badge && (
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-black">
                        {pkg.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-serif text-2xl text-white">{pkg.price}</p>
                  {pkg.description && (
                    <p className="mt-2 text-xs text-white/50">{pkg.description}</p>
                  )}
                  <ul className="mt-4 space-y-2">
                    {pkg.features.map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-white/80">
                        <span className="text-white/40">→</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {service.packagesNote && (
              <p className="mt-3 text-[11px] text-white/40">{service.packagesNote}</p>
            )}
          </motion.div>

          {/* portfólio */}
          <motion.div custom={3} variants={fade} initial="hidden" animate="show">
            <h3 className="mb-4 mt-12 text-xs uppercase tracking-[0.2em] text-white/40">
              {ui.selectedWork}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {service.gallery.map((src, i) => (
                <div
                  key={src}
                  className="relative aspect-[3/2] overflow-hidden rounded-lg bg-white/5"
                >
                  <Image
                    src={src}
                    alt={`${service.label} ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            custom={4}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-12 flex flex-wrap gap-3"
          >
            <button
              onClick={() => openOverlay(CONTACT_OVERLAY)}
              className="rounded-full bg-white px-7 py-3.5 text-sm font-medium text-black transition-colors hover:bg-white/80"
            >
              {ui.wantThis}
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
