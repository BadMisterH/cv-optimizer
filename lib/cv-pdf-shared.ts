import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";
import type { OptimizedCV } from "@/app/types";

// ─── Police ───────────────────────────────────────────────────────────────────
// Inter (SIL OFL 1.1, embarquable librement) auto-hébergée dans le repo — pas
// de fetch réseau à chaque génération de PDF. Fichiers locaux résolus via
// fontkit.open() (Font.register ne fait un fetch() que si `src` est une URL).
// Enregistré ici, dans le module partagé, pour ne s'exécuter qu'une seule fois
// quel que soit le template importé.
const FONTS_DIR = path.join(process.cwd(), "lib", "fonts", "inter");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONTS_DIR, "Inter-400.woff"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "Inter-500.woff"), fontWeight: 500 },
    { src: path.join(FONTS_DIR, "Inter-600.woff"), fontWeight: 600 },
    { src: path.join(FONTS_DIR, "Inter-700.woff"), fontWeight: 700 },
  ],
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type Template = "classic" | "single" | "ats";

export interface CVPdfOptions {
  photo?: string;
  accentColor?: string;
  template?: Template;
  density?: number;
}

// ─── Couleurs ─────────────────────────────────────────────────────────────────

export const COLORS = {
  ink: "#0f0f10",
  inkSoft: "#2a2a2c",
  inkMuted: "#5d5b56",
  inkFaint: "#a09d94",
  rule: "#e8e6df",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function ensureProtocol(url: string): string {
  const t = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Retire le protocole pour l'affichage ("https://github.com/x" → "github.com/x"). */
export function stripProtocol(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/^https?:\/\//i, "");
}

export type ContactItem =
  | { kind: "link"; label: string; href: string }
  | { kind: "text"; label: string };

/**
 * Construit la ligne de contact.
 * `bareUrls` affiche les URLs sans leur protocole (le lien cliquable le garde) —
 * utilisé par le template ATS, plus proche des conventions de CV imprimé.
 */
export function buildContactItems(
  contact: OptimizedCV["contact"],
  { bareUrls = false }: { bareUrls?: boolean } = {}
): ContactItem[] {
  const items: ContactItem[] = [];
  if (contact.email?.trim())
    items.push({ kind: "link", label: contact.email.trim(), href: `mailto:${contact.email.trim()}` });
  if (contact.phone?.trim())
    items.push({ kind: "link", label: contact.phone.trim(), href: `tel:${contact.phone.trim().replace(/[^\d+]/g, "")}` });
  if (contact.location?.trim())
    items.push({ kind: "text", label: contact.location.trim() });
  for (const url of [contact.linkedin, contact.github, contact.portfolio]) {
    if (url?.trim())
      items.push({
        kind: "link",
        label: bareUrls ? stripProtocol(url) : ensureProtocol(url),
        href: ensureProtocol(url),
      });
  }
  return items;
}
