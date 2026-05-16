import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Mon compte",
  description: "Gestion du compte CV Optimizer.",
  path: "/account",
  noindex: true,
});

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
