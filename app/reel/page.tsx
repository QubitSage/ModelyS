import type { Metadata, Viewport } from "next";
import { ServiceReel } from "@/components/reel/ServiceReel";
import { Header } from "@/components/reel/Header";
import { Preloader } from "@/components/reel/Preloader";
import { Overlays } from "@/components/reel/Overlays";
import { ScrollLock } from "@/components/reel/ScrollLock";
import { LocaleInit } from "@/components/reel/LocaleInit";
import { LocaleFlash } from "@/components/reel/LocaleFlash";

// Home pública (modely.com.br/). O middleware reescreve `/` deste host para cá.
// As páginas de entrega (/e/[slug]) e o dashboard continuam intactos — cada rota
// renderiza a sua própria UI. O ScrollLock escopa o trava-scroll só a esta home.
// Metadata (SEO) fica em EN (posicionamento primário); o conteúdo visível alterna
// EN/PT pelo toggle do header.
export const metadata: Metadata = {
  title: "Modely · AI Creative Studio",
  description:
    "Chicago creative studio producing AI UGC, cinematic ads, short films, storytelling commercials, and high-converting websites.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // impede o "bounce"/zoom que poderia introduzir scroll no mobile
  userScalable: false,
};

export default function ReelHome() {
  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <ScrollLock />
      <LocaleInit />
      <LocaleFlash />
      <Preloader />
      <ServiceReel />
      <Header />
      <Overlays />
    </main>
  );
}
