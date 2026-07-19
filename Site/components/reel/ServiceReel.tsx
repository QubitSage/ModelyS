"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { content } from "@/content/site";
import { useNavigation } from "@/lib/reel-store";
import { ServicePanel } from "./ServicePanel";

/**
 * Reel horizontal em tela cheia: os serviços passam de lado como um filme.
 * A navegação é PAGINADA — cada gesto de scroll (ou seta ← →) avança um painel
 * inteiro, com rolagem suave. A página nunca rola na vertical.
 */
export function ServiceReel() {
  const setLoaded = useNavigation((s) => s.setLoaded);
  const locale = useNavigation((s) => s.locale);
  const site = content[locale];
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const lockRef = useRef(false);
  const [active, setActive] = useState(0);
  const services = site.services;

  const setIndex = useCallback((i: number) => {
    activeRef.current = i;
    setActive(i);
  }, []);

  // rede segura: nunca deixa o preloader travar (vídeo lento/bloqueado)
  useEffect(() => {
    const t = setTimeout(setLoaded, 4000);
    return () => clearTimeout(t);
  }, [setLoaded]);

  const goTo = useCallback(
    (i: number) => {
      const el = trackRef.current;
      if (!el) return;
      const clamped = Math.min(Math.max(i, 0), services.length - 1);
      el.scrollTo({ left: clamped * el.clientWidth });
      setIndex(clamped);
    },
    [services.length, setIndex]
  );

  // scroll vertical/horizontal do mouse -> avança/volta um painel (paginado)
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const delta =
        Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 8 || lockRef.current) return;
      lockRef.current = true;
      goTo(activeRef.current + (delta > 0 ? 1 : -1));
      window.setTimeout(() => (lockRef.current = false), 650);
    },
    [goTo]
  );

  // mantém o índice em sincronia se o usuário arrastar (touch/trackpad)
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeRef.current) setIndex(idx);
  }, [setIndex]);

  // setas do teclado navegam o reel (quando nenhum modal está aberto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useNavigation.getState().activeOverlay) return;
      if (e.key === "ArrowRight") goTo(activeRef.current + 1);
      if (e.key === "ArrowLeft") goTo(activeRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  return (
    <div className="absolute inset-0">
      <div
        ref={trackRef}
        onWheel={onWheel}
        onScroll={onScroll}
        className="filmstrip flex h-full w-full snap-x snap-mandatory"
      >
        {services.map((service, i) => (
          <ServicePanel
            key={service.id}
            service={service}
            index={i}
            onFirstReady={setLoaded}
          />
        ))}
      </div>

      {/* indicadores + dica */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex flex-col items-center gap-3">
        <div className="pointer-events-auto flex items-center gap-2">
          {services.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`Ir para ${s.label}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-8 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
        <span className="text-[11px] uppercase tracking-[0.25em] text-white/40">
          {site.ui.scrollSideways} ↔
        </span>
      </div>
    </div>
  );
}
