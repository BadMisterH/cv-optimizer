import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Créer un CV gratuitement, sans inscription",
  description:
    "Remplis ton CV directement en ligne et vois le rendu en temps réel sur trois mises en page, dont un modèle ATS. Téléchargement PDF gratuit, sans compte et sans IA.",
  path: "/creer",
  keywords: [
    "créer CV gratuit",
    "CV en ligne sans inscription",
    "faire son CV gratuitement",
    "modèle CV ATS",
    "générateur CV PDF gratuit",
    "CV sans compte",
  ],
});

export default function CreerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
