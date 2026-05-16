import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Mot de passe oublié",
  description: "Réinitialisation du mot de passe CV Optimizer.",
  path: "/forgot-password",
  noindex: true,
});

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
