import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Connexion",
  description:
    "Connecte-toi à CV Optimizer pour accéder à ton historique et générer un CV ou une lettre de motivation.",
  path: "/sign-in",
  noindex: true,
});

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
