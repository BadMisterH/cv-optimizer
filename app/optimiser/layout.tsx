import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Optimiser ton CV à une offre d'emploi",
  description:
    "Téléverse ton CV en PDF, colle l'offre d'emploi visée, récupère en 30 secondes un CV ATS-friendly sur une page A4. Reformulation des expériences, mots-clés stratégiques, sans rien inventer.",
  path: "/optimiser",
  keywords: [
    "optimiser CV en ligne",
    "CV ATS friendly",
    "adapter CV offre emploi",
    "générateur CV PDF",
    "CV optimisé IA",
    "outil CV",
  ],
});

export default function OptimiserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
