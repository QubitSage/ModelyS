"use client";

import { useNavigation } from "@/lib/reel-store";
import { content, CONTACT_OVERLAY, NAV_OVERLAY, ABOUT_OVERLAY, type Locale } from "@/content/site";

/**
 * Header fixo. Marca + tagline curta à esquerda, menu de serviços no centro,
 * toggle de idioma + CTA de contato à direita (hamburger no mobile). Nada troca
 * de rota — os itens rolam o reel; "Contato" abre overlay.
 */
export function Header() {
  const openOverlay = useNavigation((s) => s.openOverlay);
  const closeOverlay = useNavigation((s) => s.closeOverlay);
  const locale = useNavigation((s) => s.locale);
  const setLocale = useNavigation((s) => s.setLocale);
  const { brand, services, taglineShort, headerCta, ui } = content[locale];

  const goToPanel = (id: string) => {
    closeOverlay();
    document
      .getElementById(`panel-${id}`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-6">
      <div className="flex flex-col leading-none">
        <button
          onClick={() => goToPanel(services[0].id)}
          className="text-xl font-semibold tracking-[0.25em] text-white transition-opacity hover:opacity-70 text-left"
          aria-label={`${brand}, início`}
        >
          {brand}
        </button>
        <span className="hidden sm:block mt-1 text-[9.5px] uppercase tracking-[0.28em] text-white/40">
          {taglineShort}
        </span>
      </div>

      {/* Menu desktop */}
      <nav className="hidden items-center gap-7 md:flex">
        {services.map((s) => (
          <button
            key={s.id}
            onClick={() => goToPanel(s.id)}
            className="group relative text-sm tracking-wide text-white/60 transition-colors hover:text-white"
          >
            {s.label}
            <span className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-300 group-hover:w-full" />
          </button>
        ))}
        <button
          onClick={() => openOverlay(ABOUT_OVERLAY)}
          className="group relative text-sm tracking-wide text-white/60 transition-colors hover:text-white"
        >
          {ui.about}
          <span className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-300 group-hover:w-full" />
        </button>
      </nav>

      {/* Direita: idioma + contato / hamburger */}
      <div className="flex items-center gap-3">
        {/* Toggle de idioma */}
        <div className="flex items-center gap-0.5 text-[11px]">
          {(["en", "pt"] as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              className={`px-1.5 py-0.5 rounded uppercase tracking-wide transition-colors ${
                locale === l ? "text-white font-medium" : "text-white/40 hover:text-white/70"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Contato (desktop) */}
        <button
          onClick={() => openOverlay(CONTACT_OVERLAY)}
          className="hidden rounded-full border border-white/25 px-5 py-2 text-sm text-white transition-colors hover:bg-white hover:text-black md:block"
        >
          {headerCta}
        </button>

        {/* Hamburger (mobile) */}
        <button
          onClick={() => openOverlay(NAV_OVERLAY)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
          aria-label="Menu"
        >
          <span className="h-px w-6 bg-white" />
          <span className="h-px w-6 bg-white" />
        </button>
      </div>
    </header>
  );
}
