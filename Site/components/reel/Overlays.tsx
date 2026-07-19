"use client";

import { AnimatePresence } from "framer-motion";
import { useNavigation } from "@/lib/reel-store";
import { content, CONTACT_OVERLAY, NAV_OVERLAY } from "@/content/site";
import { ServiceModal } from "./ServiceModal";
import { ContactOverlay } from "./ContactOverlay";
import { MobileNavOverlay } from "./MobileNavOverlay";

/**
 * Decide QUAL camada aparece por cima do reel, a partir de `activeOverlay`.
 * `mode="wait"` garante transição suave mesmo ao trocar de um overlay para outro.
 */
export function Overlays() {
  const activeOverlay = useNavigation((s) => s.activeOverlay);
  const closeOverlay = useNavigation((s) => s.closeOverlay);
  const locale = useNavigation((s) => s.locale);

  const service = content[locale].services.find((s) => s.id === activeOverlay);

  const render = () => {
    if (!activeOverlay) return null;
    if (activeOverlay === CONTACT_OVERLAY)
      return <ContactOverlay key="contact" onClose={closeOverlay} />;
    if (activeOverlay === NAV_OVERLAY)
      return <MobileNavOverlay key="nav" onClose={closeOverlay} />;
    if (service)
      return (
        <ServiceModal key={service.id} service={service} onClose={closeOverlay} />
      );
    return null;
  };

  return <AnimatePresence mode="wait">{render()}</AnimatePresence>;
}
