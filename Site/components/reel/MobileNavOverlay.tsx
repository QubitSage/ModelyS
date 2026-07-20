"use client";

import { motion } from "framer-motion";
import { content, CONTACT_OVERLAY, ABOUT_OVERLAY } from "@/content/site";
import { useNavigation } from "@/lib/reel-store";
import { OverlayShell } from "./OverlayShell";

/**
 * Menu mobile (aberto pelo hamburger). Escolher um serviço fecha o menu e rola o
 * reel até o painel correspondente — continua tudo por camadas, sem rota.
 */
export function MobileNavOverlay({ onClose }: { onClose: () => void }) {
  const openOverlay = useNavigation((s) => s.openOverlay);
  const site = content[useNavigation((s) => s.locale)];
  const { services, ui } = site;

  const goToPanel = (id: string) => {
    onClose();
    // aguarda o overlay fechar antes de rolar
    setTimeout(() => {
      document
        .getElementById(`panel-${id}`)
        ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 60);
  };

  return (
    <OverlayShell onClose={onClose} labelledBy="nav-title" className="bg-black">
      <nav
        aria-label="Navegação principal"
        className="flex h-full w-full flex-col justify-center gap-2 px-8"
      >
        <h2 id="nav-title" className="sr-only">
          Navegação
        </h2>
        {services.map((s, i) => (
          <motion.button
            key={s.id}
            onClick={() => goToPanel(s.id)}
            className="text-left text-3xl font-light tracking-tight text-white/80 transition-colors hover:text-white"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
          >
            {s.label}
          </motion.button>
        ))}
        <motion.button
          onClick={() => openOverlay(ABOUT_OVERLAY)}
          className="mt-4 text-left text-3xl font-light tracking-tight text-white/80 transition-colors hover:text-white"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + services.length * 0.06, duration: 0.4 }}
        >
          {ui.about}
        </motion.button>
        <motion.button
          onClick={() => openOverlay(CONTACT_OVERLAY)}
          className="mt-6 text-left text-lg uppercase tracking-widest text-white/50 transition-colors hover:text-white"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + (services.length + 1) * 0.06, duration: 0.4 }}
        >
          {site.headerCta}
        </motion.button>
      </nav>
    </OverlayShell>
  );
}
