"use client";

import { motion } from "framer-motion";
import { content, type Service } from "@/content/site";
import { useNavigation } from "@/lib/reel-store";

/**
 * Um painel do reel: vídeo em tela cheia (100dvh x 100vw) rodando em loop, com
 * o nome do serviço e um botão "Saiba mais" que abre o modal daquele serviço.
 */
export function ServicePanel({
  service,
  index,
  onFirstReady,
}: {
  service: Service;
  index: number;
  onFirstReady?: () => void;
}) {
  const openOverlay = useNavigation((s) => s.openOverlay);
  const ui = content[useNavigation((s) => s.locale)].ui;

  return (
    <section
      id={`panel-${service.id}`}
      className="relative h-full w-screen shrink-0 snap-center overflow-hidden"
      aria-label={service.label}
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload={index === 0 ? "auto" : "metadata"}
        poster={service.poster}
        onCanPlay={index === 0 ? onFirstReady : undefined}
        onLoadedData={index === 0 ? onFirstReady : undefined}
        onError={index === 0 ? onFirstReady : undefined}
      >
        <source src={service.videoSrc} type="video/mp4" />
      </video>

      {/* contraste */}
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/50" />

      {/* conteúdo */}
      <div className="relative flex h-full w-full items-end px-6 pb-16 sm:px-12 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.5 }}
          transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
          className="max-w-2xl"
        >
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/50">
            {String(index + 1).padStart(2, "0")} / {ui.deliveryModel}
          </p>
          <h2 className="text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-7xl">
            {service.label}
          </h2>
          <p className="mt-4 max-w-lg text-base text-white/70 sm:text-lg">
            {service.tagline}
          </p>
          <button
            onClick={() => openOverlay(service.id)}
            className="group mt-8 inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/5 px-7 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white hover:text-black"
          >
            {ui.seeDetails}
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}
