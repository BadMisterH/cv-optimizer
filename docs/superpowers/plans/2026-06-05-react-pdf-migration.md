# Migration Puppeteer → @react-pdf/renderer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer Puppeteer/Chromium par `@react-pdf/renderer` pour générer des PDFs propres, rapides, sans navigateur, toujours sur 1 page A4.

**Architecture:** Le template CV est réécrit en composants React (`lib/cv-pdf.tsx`). La route `/api/pdf` appelle `renderToBuffer()` en boucle avec des niveaux de densité croissants jusqu'à obtenir 1 page. La preview HTML reste inchangée.

**Tech Stack:** `@react-pdf/renderer` v4, Next.js 16 App Router (runtime nodejs), TypeScript.

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `lib/cv-pdf.tsx` | **Créer** | Template CV react-pdf + `renderCVToBuffer()` |
| `lib/pdf-utils.ts` | **Créer** | `countPdfPages(buf)` — compter les pages d'un buffer PDF |
| `app/api/pdf/route.ts` | **Modifier** | Remplacer Puppeteer par react-pdf |
| `next.config.ts` | **Modifier** | Ajouter `serverExternalPackages` |
| `lib/browser.ts` | **Supprimer** | Plus nécessaire |
| `app/components/editor/LivePreview.tsx` | **Modifier** | Mettre à jour le libellé "pixel-perfect" |
| `package.json` | **Modifier** | Ajouter react-pdf, retirer puppeteer |

---

## Task 1 — Installer @react-pdf/renderer et configurer Next.js

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`

- [ ] **Step 1.1 — Installer le package**

```bash
npm install @react-pdf/renderer
npm install --save-dev @types/react-pdf 2>/dev/null || true
```

Expected: `@react-pdf/renderer` apparaît dans `node_modules`.

- [ ] **Step 1.2 — Vérifier la version installée**

```bash
node -e "console.log(require('@react-pdf/renderer/package.json').version)"
```

Expected: une version `3.x` ou `4.x`.

- [ ] **Step 1.3 — Ajouter serverExternalPackages dans next.config.ts**

Ouvrir `next.config.ts`. Modifier `nextConfig` :

```ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@react-pdf/renderer'],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};
```

> Sans ce flag, Next.js tente de bundler react-pdf avec webpack, ce qui échoue car le package utilise des APIs Node.js natives.

- [ ] **Step 1.4 — Vérifier que Next.js démarre sans erreur**

```bash
npm run build 2>&1 | tail -20
```

Expected: build réussi, aucune erreur liée à react-pdf.

- [ ] **Step 1.5 — Commit**

```bash
git add next.config.ts package.json package-lock.json
git commit -m "feat: install @react-pdf/renderer + serverExternalPackages"
```

---

## Task 2 — Créer lib/pdf-utils.ts

**Files:**
- Create: `lib/pdf-utils.ts`

- [ ] **Step 2.1 — Créer le fichier**

```ts
// lib/pdf-utils.ts

/**
 * Compte le nombre de pages dans un buffer PDF en cherchant
 * les entrées /Type /Page (mais pas /Pages qui est le parent).
 * Fonctionne sans dépendance : regex sur le contenu latin1 du buffer.
 */
export function countPdfPages(buf: Buffer): number {
  const text = buf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}
```

- [ ] **Step 2.2 — Tester manuellement**

Créer un fichier temporaire `scripts/test-count-pages.mjs` :

```js
import { readFileSync } from "fs";
import { countPdfPages } from "../lib/pdf-utils.js";

// Génère un mini PDF 1 page avec jsPDF pour tester
// À défaut, télécharger un PDF existant et le pointer ici :
// const buf = readFileSync("chemin/vers/fichier.pdf");
// console.log("Pages:", countPdfPages(buf));
console.log("countPdfPages importé correctement");
```

```bash
node --input-type=module --eval "
import { countPdfPages } from './lib/pdf-utils.ts';
console.log('import OK');
" 2>&1 || echo "OK (TypeScript, pas de runner direct)"
```

Expected: pas d'erreur de syntaxe TypeScript (la vérification réelle se fera via le smoke test Task 7).

- [ ] **Step 2.3 — Commit**

```bash
git add lib/pdf-utils.ts
git commit -m "feat: add countPdfPages utility"
```

---

## Task 3 — Créer lib/cv-pdf.tsx — densités et styles de base

**Files:**
- Create: `lib/cv-pdf.tsx`

- [ ] **Step 3.1 — Créer le squelette avec le système de densité**

```tsx
// lib/cv-pdf.tsx
import "server-only";
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { OptimizedCV } from "@/app/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Template = "classic" | "single";

export interface CVPdfOptions {
  photo?: string;
  accentColor?: string;
  template?: Template;
  density?: number;
  scale?: number;
}

// ─── Densité ──────────────────────────────────────────────────────────────────

interface DensityConfig {
  baseFontSize: number;
  lineHeight: number;
  sectionGap: number;
  sectionTitleMb: number;
  sectionTitleFs: number;
  itemGap: number;
  itemBulletsLh: number;
  itemBulletsMb: number;
  containerPadY: number;
  containerPadX: number;
  headerMb: number;
  titleFontSize: number;
  subtitleFontSize: number;
  photoW: number;
  photoH: number;
  tagFontSize: number;
  tagPadH: number;
  tagPadV: number;
}

const DENSITIES: DensityConfig[] = [
  // 0 — spacieux
  { baseFontSize: 10.5, lineHeight: 1.45, sectionGap: 10, sectionTitleMb: 6, sectionTitleFs: 8, itemGap: 7, itemBulletsLh: 1.38, itemBulletsMb: 1.5, containerPadY: 14, containerPadX: 22, headerMb: 10, titleFontSize: 20, subtitleFontSize: 13, photoW: 74, photoH: 92, tagFontSize: 8.2, tagPadH: 7, tagPadV: 2.5 },
  // 1
  { baseFontSize: 10.3, lineHeight: 1.42, sectionGap: 8, sectionTitleMb: 5, sectionTitleFs: 8, itemGap: 6, itemBulletsLh: 1.33, itemBulletsMb: 1, containerPadY: 11, containerPadX: 22, headerMb: 8, titleFontSize: 19, subtitleFontSize: 12.5, photoW: 70, photoH: 86, tagFontSize: 8, tagPadH: 6, tagPadV: 2 },
  // 2
  { baseFontSize: 10, lineHeight: 1.38, sectionGap: 6, sectionTitleMb: 4, sectionTitleFs: 7.9, itemGap: 5, itemBulletsLh: 1.28, itemBulletsMb: 0.5, containerPadY: 9, containerPadX: 22, headerMb: 6, titleFontSize: 18, subtitleFontSize: 12, photoW: 66, photoH: 80, tagFontSize: 8, tagPadH: 6, tagPadV: 2 },
  // 3
  { baseFontSize: 9.7, lineHeight: 1.33, sectionGap: 5, sectionTitleMb: 3, sectionTitleFs: 7.8, itemGap: 4, itemBulletsLh: 1.22, itemBulletsMb: 0, containerPadY: 7, containerPadX: 20, headerMb: 5, titleFontSize: 17, subtitleFontSize: 11.5, photoW: 60, photoH: 74, tagFontSize: 7.8, tagPadH: 5.5, tagPadV: 1.5 },
  // 4 — compact
  { baseFontSize: 9.3, lineHeight: 1.28, sectionGap: 4, sectionTitleMb: 2, sectionTitleFs: 7.6, itemGap: 3, itemBulletsLh: 1.18, itemBulletsMb: 0, containerPadY: 5, containerPadX: 18, headerMb: 4, titleFontSize: 16, subtitleFontSize: 11, photoW: 56, photoH: 68, tagFontSize: 7.6, tagPadH: 5, tagPadV: 1 },
];

// ─── Couleurs ─────────────────────────────────────────────────────────────────

const COLORS = {
  ink: "#0f0f10",
  inkSoft: "#2a2a2c",
  inkMuted: "#5d5b56",
  inkFaint: "#a09d94",
  rule: "#e8e6df",
  paper: "#ffffff",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureProtocol(url: string): string {
  const t = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

type ContactItem =
  | { kind: "link"; label: string; href: string }
  | { kind: "text"; label: string };

function buildContactItems(contact: OptimizedCV["contact"]): ContactItem[] {
  const items: ContactItem[] = [];
  if (contact.email?.trim())
    items.push({ kind: "link", label: contact.email.trim(), href: `mailto:${contact.email.trim()}` });
  if (contact.phone?.trim())
    items.push({ kind: "link", label: contact.phone.trim(), href: `tel:${contact.phone.trim().replace(/[^\d+]/g, "")}` });
  if (contact.location?.trim())
    items.push({ kind: "text", label: contact.location.trim() });
  for (const url of [contact.linkedin, contact.github, contact.portfolio]) {
    if (url?.trim())
      items.push({ kind: "link", label: ensureProtocol(url), href: ensureProtocol(url) });
  }
  return items;
}
```

- [ ] **Step 3.2 — Vérifier qu'il n'y a pas d'erreur TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur dans `lib/cv-pdf.tsx`.

- [ ] **Step 3.3 — Commit**

```bash
git add lib/cv-pdf.tsx
git commit -m "feat(cv-pdf): scaffold + density system + color tokens"
```

---

## Task 4 — Ajouter CVHeader dans lib/cv-pdf.tsx

**Files:**
- Modify: `lib/cv-pdf.tsx`

- [ ] **Step 4.1 — Ajouter CVHeader à la fin de lib/cv-pdf.tsx**

Ajouter après les helpers (à la suite du contenu existant) :

```tsx
// ─── CVHeader ─────────────────────────────────────────────────────────────────

interface CVHeaderProps {
  cv: OptimizedCV;
  photo: string | undefined;
  accent: string;
  d: DensityConfig;
  template: Template;
}

function CVHeader({ cv, photo, accent, d, template }: CVHeaderProps) {
  const contactItems = buildContactItems(cv.contact);
  const isSingle = template === "single";

  const photoEl = photo ? (
    <Image
      src={photo}
      style={{
        width: d.photoW,
        height: d.photoH,
        objectFit: "cover",
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  ) : null;

  const titleBlock = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        style={{
          fontSize: d.titleFontSize,
          fontFamily: "Helvetica-Bold",
          letterSpacing: -0.7,
          color: COLORS.ink,
          lineHeight: 1,
          marginBottom: 5,
        }}
      >
        {cv.fullName}
      </Text>
      {cv.title ? (
        <Text
          style={{
            fontSize: d.subtitleFontSize,
            fontFamily: "Helvetica",
            color: accent,
            marginTop: 2,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {cv.title}
        </Text>
      ) : null}
    </View>
  );

  // Contact row
  const contactEl = contactItems.length > 0 ? (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 7,
      }}
    >
      {contactItems.map((item, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          {i > 0 && (
            <Text style={{ fontSize: 8.5, color: COLORS.inkFaint }}>
              {" · "}
            </Text>
          )}
          {item.kind === "link" ? (
            <Link
              src={item.href}
              style={{ fontSize: 8.5, color: COLORS.inkSoft, textDecoration: "none" }}
            >
              {item.label}
            </Link>
          ) : (
            <Text style={{ fontSize: 8.5, color: COLORS.inkMuted }}>
              {item.label}
            </Text>
          )}
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View
      style={{
        marginBottom: d.headerMb,
        borderBottomWidth: 1.5,
        borderBottomColor: COLORS.ink,
        paddingBottom: 8,
      }}
    >
      {/* Trait accent au-dessus du nom */}
      <View
        style={{
          width: 28,
          height: 1.4,
          backgroundColor: accent,
          marginBottom: 5,
        }}
      />

      {/* Top line : nom + photo (classic) ou photo + nom (single centré) */}
      {isSingle ? (
        <View style={{ alignItems: "center" }}>
          {photoEl ? (
            <View style={{ marginBottom: 6 }}>{photoEl}</View>
          ) : null}
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: d.titleFontSize,
                fontFamily: "Helvetica-Bold",
                letterSpacing: -0.7,
                color: COLORS.ink,
                lineHeight: 1,
                marginBottom: 5,
                textAlign: "center",
              }}
            >
              {cv.fullName}
            </Text>
            {cv.title ? (
              <Text
                style={{
                  fontSize: d.subtitleFontSize,
                  fontFamily: "Helvetica",
                  color: accent,
                  marginTop: 2,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  textAlign: "center",
                }}
              >
                {cv.title}
              </Text>
            ) : null}
          </View>
          {contactEl ? (
            <View style={{ justifyContent: "center", marginTop: 7 }}>
              {contactEl}
            </View>
          ) : null}
        </View>
      ) : (
        <View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            {titleBlock}
            {photoEl}
          </View>
          {contactEl}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 4.2 — Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur.

- [ ] **Step 4.3 — Commit**

```bash
git add lib/cv-pdf.tsx
git commit -m "feat(cv-pdf): add CVHeader component (classic + single)"
```

---

## Task 5 — Ajouter CVAccroche, CVSection, CVItem dans lib/cv-pdf.tsx

**Files:**
- Modify: `lib/cv-pdf.tsx`

- [ ] **Step 5.1 — Ajouter CVAccroche après CVHeader**

```tsx
// ─── CVAccroche ───────────────────────────────────────────────────────────────

function CVAccroche({ text, accent, d }: { text: string; accent: string; d: DensityConfig }) {
  return (
    <View style={{ marginBottom: d.sectionGap }}>
      {/* Titre section */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 0.5,
          borderBottomColor: COLORS.rule,
          paddingBottom: 5,
          marginBottom: d.sectionTitleMb,
        }}
      >
        <View
          style={{
            width: 5,
            height: 5,
            backgroundColor: accent,
            marginRight: 7,
            flexShrink: 0,
          }}
        />
        <Text
          style={{
            fontSize: d.sectionTitleFs,
            fontFamily: "Helvetica-Bold",
            textTransform: "uppercase",
            letterSpacing: 2.2,
            color: COLORS.ink,
          }}
        >
          À propos
        </Text>
      </View>
      <Text
        style={{
          fontSize: 9.5,
          color: COLORS.inkSoft,
          lineHeight: 1.45,
          paddingLeft: 10,
          borderLeftWidth: 1.2,
          borderLeftColor: accent,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
```

- [ ] **Step 5.2 — Ajouter CVItem et CVSection après CVAccroche**

```tsx
// ─── CVItem ───────────────────────────────────────────────────────────────────

interface CVItemProps {
  item: OptimizedCV["sections"][number]["items"][number];
  accent: string;
  d: DensityConfig;
}

function CVItem({ item, accent, d }: CVItemProps) {
  const isSkillCat = item.tags.length > 0 && item.bullets.length === 0 && item.heading;

  return (
    <View style={{ marginBottom: d.itemGap }}>
      {item.heading ? (
        isSkillCat ? (
          /* Catégorie de compétences : heading + règle + tags */
          <View style={{ marginBottom: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
              <Text
                style={{
                  fontSize: 8.5,
                  fontFamily: "Helvetica-Bold",
                  color: COLORS.ink,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginRight: 8,
                }}
              >
                {item.heading}
              </Text>
              <View style={{ flex: 1, height: 0.4, backgroundColor: COLORS.rule }} />
            </View>
          </View>
        ) : (
          /* En-tête standard : heading · company — meta date */
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "baseline", flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: d.itemFontSize ?? d.baseFontSize,
                  fontFamily: "Helvetica-Bold",
                  color: COLORS.ink,
                  letterSpacing: -0.15,
                }}
              >
                {item.heading}
              </Text>
              {item.company ? (
                <Text
                  style={{
                    fontSize: d.itemFontSize ?? d.baseFontSize,
                    fontFamily: "Helvetica-Bold",
                    color: accent,
                    marginLeft: 5,
                    letterSpacing: -0.1,
                  }}
                >
                  {" · "}
                  {item.company}
                </Text>
              ) : null}
            </View>
            {item.subheading ? (
              <Text
                style={{
                  fontSize: 8.3,
                  color: COLORS.inkMuted,
                  textAlign: "right",
                  flexShrink: 0,
                  marginLeft: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.2,
                }}
              >
                {item.subheading}
              </Text>
            ) : null}
          </View>
        )
      ) : null}

      {/* Bullets */}
      {item.bullets.length > 0 ? (
        <View style={{ marginTop: 2, paddingLeft: 12 }}>
          {item.bullets.map((b, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                marginBottom: d.itemBulletsMb,
              }}
            >
              <View
                style={{
                  width: 3.5,
                  height: 3.5,
                  backgroundColor: accent,
                  borderRadius: 0.5,
                  marginTop: (d.baseFontSize * d.itemBulletsLh) / 2 - 1.75,
                  marginRight: 4,
                  marginLeft: -9,
                  flexShrink: 0,
                }}
              />
              <Text
                style={{
                  fontSize: d.baseFontSize * 0.9,
                  color: COLORS.inkSoft,
                  lineHeight: d.itemBulletsLh,
                  flex: 1,
                }}
              >
                {b}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Tags / chips */}
      {item.tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3 }}>
          {item.tags.map((tag, i) => (
            <View
              key={i}
              style={{
                borderWidth: 0.5,
                borderColor: accent,
                borderRadius: 999,
                paddingHorizontal: d.tagPadH,
                paddingVertical: d.tagPadV,
                marginRight: 4,
                marginBottom: 3,
              }}
            >
              <Text
                style={{
                  fontSize: d.tagFontSize,
                  color: COLORS.inkSoft,
                  letterSpacing: 0.15,
                }}
              >
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── CVSection ────────────────────────────────────────────────────────────────

interface CVSectionProps {
  section: OptimizedCV["sections"][number];
  accent: string;
  d: DensityConfig;
}

function CVSection({ section, accent, d }: CVSectionProps) {
  const visibleItems = section.items.filter(
    (it) =>
      (it.heading?.trim()) ||
      (it.subheading?.trim()) ||
      it.bullets.length > 0 ||
      it.tags.length > 0
  );
  if (visibleItems.length === 0) return null;

  return (
    <View style={{ marginBottom: d.sectionGap }} wrap={false}>
      {/* Titre de section */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 0.5,
          borderBottomColor: COLORS.rule,
          paddingBottom: 5,
          marginBottom: d.sectionTitleMb,
        }}
      >
        <View
          style={{
            width: 5,
            height: 5,
            backgroundColor: accent,
            marginRight: 7,
            flexShrink: 0,
          }}
        />
        <Text
          style={{
            fontSize: d.sectionTitleFs,
            fontFamily: "Helvetica-Bold",
            textTransform: "uppercase",
            letterSpacing: 2.2,
            color: COLORS.ink,
          }}
        >
          {section.title}
        </Text>
      </View>

      {visibleItems.map((item, i) => (
        <CVItem key={i} item={item} accent={accent} d={d} />
      ))}
    </View>
  );
}
```

> Note: `d.itemFontSize` n'existe pas encore dans `DensityConfig`. Remplace `d.itemFontSize ?? d.baseFontSize` par simplement `d.baseFontSize` dans CVItem.

- [ ] **Step 5.3 — Corriger la référence itemFontSize**

Dans CVItem, remplace les deux occurrences de `d.itemFontSize ?? d.baseFontSize` par `d.baseFontSize`.

- [ ] **Step 5.4 — Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur.

- [ ] **Step 5.5 — Commit**

```bash
git add lib/cv-pdf.tsx
git commit -m "feat(cv-pdf): add CVAccroche, CVItem, CVSection components"
```

---

## Task 6 — Assembler CVDocument et exporter renderCVToBuffer

**Files:**
- Modify: `lib/cv-pdf.tsx`

- [ ] **Step 6.1 — Ajouter CVDocument à la fin de lib/cv-pdf.tsx**

```tsx
// ─── CVDocument ───────────────────────────────────────────────────────────────

interface CVDocumentProps {
  cv: OptimizedCV;
  photo: string | undefined;
  accentColor: string;
  template: Template;
  density: number;
}

function CVDocument({ cv, photo, accentColor, template, density }: CVDocumentProps) {
  const d = DENSITIES[Math.max(0, Math.min(4, density))];
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(accentColor) ? accentColor : "#1f4bff";

  return (
    <Document>
      <Page
        size="A4"
        style={{
          fontFamily: "Helvetica",
          fontSize: d.baseFontSize,
          lineHeight: d.lineHeight,
          color: COLORS.ink,
          backgroundColor: COLORS.paper,
          paddingTop: d.containerPadY,
          paddingBottom: d.containerPadY,
          paddingLeft: d.containerPadX,
          paddingRight: d.containerPadX,
        }}
      >
        <CVHeader cv={cv} photo={photo} accent={accent} d={d} template={template} />

        {cv.accroche?.trim() ? (
          <CVAccroche text={cv.accroche.trim()} accent={accent} d={d} />
        ) : null}

        {cv.sections.map((section, i) => (
          <CVSection key={i} section={section} accent={accent} d={d} />
        ))}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 6.2 — Ajouter la fonction renderCVToBuffer à la fin du fichier**

```tsx
// ─── Export principal ─────────────────────────────────────────────────────────

export async function renderCVToBuffer(
  cv: OptimizedCV,
  options: CVPdfOptions = {}
): Promise<Buffer> {
  const {
    photo,
    accentColor = "#1f4bff",
    template = "classic",
    density = 0,
    scale: _scale = 1,
  } = options;

  const buf = await renderToBuffer(
    <CVDocument
      cv={cv}
      photo={photo}
      accentColor={accentColor}
      template={template}
      density={density}
    />
  );
  return buf;
}
```

> Note: Le paramètre `scale` est réservé pour le futur (react-pdf ne supporte pas encore un scale global post-rendu facilement). Pour l'instant, le scale est géré par la densité uniquement.

- [ ] **Step 6.3 — Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur.

- [ ] **Step 6.4 — Commit**

```bash
git add lib/cv-pdf.tsx
git commit -m "feat(cv-pdf): add CVDocument + renderCVToBuffer export"
```

---

## Task 7 — Smoke test : générer un PDF de test

**Files:**
- Create: `scripts/smoke-pdf.mjs` (temporaire)

- [ ] **Step 7.1 — Créer le script de smoke test**

```js
// scripts/smoke-pdf.mjs
// Usage : node --experimental-vm-modules scripts/smoke-pdf.mjs

import { writeFileSync } from "fs";

// On passe par la route API directement pour éviter les imports TypeScript
const BASE = "http://localhost:3000";

const testCV = {
  fullName: "Jean Dupont",
  title: "Développeur Full-Stack",
  accroche: "Passionné par la création de produits simples et efficaces.",
  contact: {
    email: "jean@exemple.com",
    phone: "06 12 34 56 78",
    location: "Paris",
    linkedin: "linkedin.com/in/jeandupont",
    github: "",
    portfolio: "",
  },
  sections: [
    {
      title: "Expérience",
      items: [
        {
          heading: "Développeur Frontend",
          company: "Acme Corp",
          subheading: "2022 – 2024",
          bullets: [
            "Refonte de l'interface utilisateur, -40% de temps de chargement.",
            "Migration de React 17 vers React 18 avec concurrent features.",
          ],
          tags: [],
        },
      ],
    },
    {
      title: "Compétences",
      items: [
        {
          heading: "Frontend",
          subheading: "",
          company: "",
          bullets: [],
          tags: ["React", "TypeScript", "Next.js", "Tailwind"],
        },
        {
          heading: "Backend",
          subheading: "",
          company: "",
          bullets: [],
          tags: ["Node.js", "PostgreSQL", "REST", "GraphQL"],
        },
      ],
    },
  ],
};

const res = await fetch(`${BASE}/api/pdf`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cv: testCV, accentColor: "#1f4bff", template: "classic" }),
});

if (!res.ok) {
  const err = await res.text();
  console.error("ERREUR:", res.status, err);
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
writeFileSync("/tmp/test-cv.pdf", buf);
console.log(`✓ PDF généré : /tmp/test-cv.pdf (${buf.length} octets)`);

// Vérification rapide du nombre de pages
const text = buf.toString("latin1");
const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log(`✓ Pages : ${pages}`);
if (pages !== 1) {
  console.error(`✗ Attendu 1 page, obtenu ${pages}`);
  process.exit(1);
}
console.log("✓ Smoke test passé");
```

- [ ] **Step 7.2 — Démarrer le serveur et lancer le smoke test**

Dans un terminal :
```bash
npm run dev
```

Dans un autre terminal :
```bash
node scripts/smoke-pdf.mjs
```

Expected:
```
✓ PDF généré : /tmp/test-cv.pdf (xxxxx octets)
✓ Pages : 1
✓ Smoke test passé
```

- [ ] **Step 7.3 — Ouvrir le PDF et vérifier visuellement**

```bash
open /tmp/test-cv.pdf
```

Vérifier : 1 page A4, nom visible, sections présentes, couleur accent bleue, pas de contenu coupé.

- [ ] **Step 7.4 — Si le smoke test échoue**

Si l'erreur est `Cannot find module '@react-pdf/renderer'` → vérifier que `serverExternalPackages` est dans `next.config.ts` et relancer `npm run dev`.

Si le PDF fait 2 pages → la logique de densité dans `route.ts` n'est pas encore en place (Task 8). Normal à ce stade.

- [ ] **Step 7.5 — Supprimer le script temporaire**

```bash
rm scripts/smoke-pdf.mjs
```

---

## Task 8 — Réécrire app/api/pdf/route.ts

**Files:**
- Modify: `app/api/pdf/route.ts`

- [ ] **Step 8.1 — Remplacer le contenu complet de app/api/pdf/route.ts**

```ts
import { NextResponse } from "next/server";
import type { OptimizedCV } from "@/app/types";
import { renderCVToBuffer, type Template } from "@/lib/cv-pdf";
import { countPdfPages } from "@/lib/pdf-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TEMPLATES: Template[] = ["classic", "single"];
const MAX_DENSITY = 4;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cv = body?.cv as OptimizedCV | undefined;
    if (!cv?.fullName) {
      return NextResponse.json({ error: "CV invalide" }, { status: 400 });
    }

    const photoDataUrl =
      typeof body?.photo === "string" && body.photo.startsWith("data:")
        ? (body.photo as string)
        : undefined;

    const accentColor =
      typeof body?.accentColor === "string" ? body.accentColor : "#1f4bff";

    const template: Template = VALID_TEMPLATES.includes(body?.template)
      ? (body.template as Template)
      : "classic";

    // Boucle densité : on cherche la densité minimale qui tient sur 1 page
    let finalBuf: Buffer | null = null;
    let usedDensity = 0;

    for (let d = 0; d <= MAX_DENSITY; d++) {
      const buf = await renderCVToBuffer(cv, {
        photo: photoDataUrl,
        accentColor,
        template,
        density: d,
      });

      const pages = countPdfPages(buf);
      console.log(`[api/pdf] density=${d}, pages=${pages}`);

      if (pages <= 1) {
        finalBuf = buf;
        usedDensity = d;
        break;
      }

      // Garder le dernier rendu en fallback
      if (d === MAX_DENSITY) {
        finalBuf = buf;
        usedDensity = d;
      }
    }

    if (!finalBuf) {
      return NextResponse.json({ error: "Échec de génération PDF" }, { status: 500 });
    }

    const pages = countPdfPages(finalBuf);
    console.log(`[api/pdf] final: density=${usedDensity}, pages=${pages}`);

    const fileName = `CV-${cv.fullName.replace(/\s+/g, "-") || "optimise"}.pdf`;

    return new Response(new Uint8Array(finalBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/pdf] generation failed:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 8.2 — Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur.

- [ ] **Step 8.3 — Relancer le smoke test**

```bash
# Dans un terminal : npm run dev
# Dans un autre :
node -e "
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
" 2>/dev/null || true

# Test direct via curl
curl -s -X POST http://localhost:3000/api/pdf \
  -H 'Content-Type: application/json' \
  -d '{\"cv\":{\"fullName\":\"Test User\",\"title\":\"Dev\",\"accroche\":\"\",\"contact\":{\"email\":\"t@t.com\",\"phone\":\"\",\"location\":\"\",\"linkedin\":\"\",\"github\":\"\",\"portfolio\":\"\"},\"sections\":[]},\"accentColor\":\"#1f4bff\",\"template\":\"classic\"}' \
  --output /tmp/test2.pdf && echo "PDF généré" && open /tmp/test2.pdf
```

Expected: PDF s'ouvre, 1 page, nom "Test User" visible.

- [ ] **Step 8.4 — Commit**

```bash
git add app/api/pdf/route.ts
git commit -m "feat(api/pdf): replace Puppeteer with renderCVToBuffer + density loop"
```

---

## Task 9 — Supprimer Puppeteer et lib/browser.ts

**Files:**
- Delete: `lib/browser.ts`
- Modify: `package.json`

- [ ] **Step 9.1 — Vérifier qu'aucun fichier n'importe encore browser.ts**

```bash
grep -r "browser" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next" | grep -v "lib/browser.ts"
```

Expected: aucun résultat (ou uniquement des commentaires sans import).

- [ ] **Step 9.2 — Supprimer lib/browser.ts**

```bash
rm lib/browser.ts
```

- [ ] **Step 9.3 — Désinstaller Puppeteer et Chromium**

```bash
npm uninstall puppeteer puppeteer-core @sparticuz/chromium-min
```

- [ ] **Step 9.4 — Vérifier TypeScript et build**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20
```

Expected: aucune erreur. `lib/browser.ts` ne doit plus être référencé.

- [ ] **Step 9.5 — Commit**

```bash
git add -A
git commit -m "chore: remove Puppeteer, chromium-min and browser.ts"
```

---

## Task 10 — Mettre à jour le libellé LivePreview

**Files:**
- Modify: `app/components/editor/LivePreview.tsx`

- [ ] **Step 10.1 — Mettre à jour le texte**

Dans `LivePreview.tsx`, remplacer :

```tsx
<span>↪ pixel-perfect du PDF</span>
```

par :

```tsx
<span>↪ aperçu du rendu final</span>
```

- [ ] **Step 10.2 — Vérifier visuellement dans le browser**

Naviguer vers `/optimiser`, générer un CV, vérifier que le nouveau libellé apparaît sous la preview.

- [ ] **Step 10.3 — Commit final**

```bash
git add app/components/editor/LivePreview.tsx
git commit -m "chore: update LivePreview label (preview != pixel-perfect post react-pdf)"
```

---

## Self-Review

**Spec coverage :**
- ✓ `lib/cv-pdf.tsx` — template react-pdf complet
- ✓ Densité 0-4 définie et itérée dans la route
- ✓ countPdfPages dans `lib/pdf-utils.ts`
- ✓ `renderCVToBuffer` exporté et appelé depuis la route
- ✓ Photo (base64 → `<Image>`) — Task 4
- ✓ Templates classic + single — Task 4
- ✓ Accent couleur passé comme prop — Task 3/4
- ✓ Puppeteer supprimé — Task 9
- ✓ LivePreview inchangée, libellé mis à jour — Task 10
- ✓ `serverExternalPackages` next.config — Task 1

**Placeholders :** aucun.

**Type consistency :**
- `Template` défini dans `lib/cv-pdf.tsx`, réexporté et utilisé dans `route.ts` ✓
- `CVPdfOptions` utilisé dans `renderCVToBuffer` ✓
- `DensityConfig` local au fichier, pas exposé à l'extérieur ✓
- `countPdfPages(buf: Buffer): number` — signature cohérente entre `pdf-utils.ts` et `route.ts` ✓
