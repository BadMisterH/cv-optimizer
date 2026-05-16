import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Acheter des crédits",
  description: "Acquiers des crédits CV Optimizer pour générer plus de CV et de lettres de motivation.",
  path: "/buy-credits",
  noindex: true,
});

export default function BuyCreditsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
