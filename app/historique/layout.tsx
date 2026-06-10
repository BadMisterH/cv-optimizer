import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Mes CVs générés",
  description: "Retrouve et télécharge tes CVs optimisés précédents.",
  path: "/historique",
});

export default function HistoriqueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
