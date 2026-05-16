import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Lettre de motivation personnalisée en 30 secondes",
  description:
    "Rédige une lettre de motivation alignée sur ton CV et l'offre d'emploi. Ton humain, vocabulaire concret, structurée pour le marché français. 280 à 340 mots, prête à envoyer en PDF.",
  path: "/lettre",
  keywords: [
    "lettre de motivation générateur",
    "lettre de motivation personnalisée",
    "lettre motivation IA",
    "exemple lettre motivation",
    "rédiger lettre de motivation",
    "lettre motivation PDF",
  ],
});

export default function LettreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
