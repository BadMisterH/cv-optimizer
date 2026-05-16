import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Nouveau mot de passe",
  description: "Définir un nouveau mot de passe CV Optimizer.",
  path: "/reset-password",
  noindex: true,
});

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
