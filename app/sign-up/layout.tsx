import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Créer un compte gratuit",
  description:
    "Inscription gratuite à CV Optimizer. 1 crédit offert à la création de compte, sans carte bancaire. Email + mot de passe ou Google. Optimise un CV ou rédige une lettre en quelques clics.",
  path: "/sign-up",
  keywords: ["inscription CV Optimizer", "créer compte CV", "essai gratuit CV ATS"],
});

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
