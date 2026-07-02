# CV single-column ATS prompt + 2-page fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the CV generation prompt with the single-column renderer that actually exists (stop promising a 2-column sidebar layout nothing implements), and replace the current hard "must fit on 1 page or fail" behavior with a transparent, capped fallback: 1 page ideal, 2 pages accepted, 3+ pages rejected with a clear error — with the live preview showing the true content height instead of silently clipping it.

**Architecture:** Three independent surfaces get updated: the LLM prompt text (`app/api/optimize/route.ts`), the PDF export route's page-count decision (`app/api/pdf/route.ts`), and the live preview's iframe sizing (`app/components/editor/LivePreview.tsx`). No new modules, no shared new abstractions — each file already owns its own concern.

**Tech Stack:** Next.js 16 App Router route handlers, `@react-pdf/renderer` (PDF), a plain HTML/CSS string renderer (`lib/cv-html.ts`) rendered in a sandboxed iframe, Vitest for unit tests.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-02-cv-single-column-pagefallback-design.md` — every requirement below traces back to it.
- Template stays single-column by default (ATS-friendly). No 2-column layout is built in this plan.
- `finalPages === 1` → ship. `finalPages === 2` → ship (new). `finalPages >= 3` → never ship silently, return a clear 422.
- The live preview's `<iframe>` height must always equal the real measured content height — never artificially capped. Only the wrapper `<div>` around it may cap visually (via `max-height` + scroll).
- Run `npx tsc --noEmit`, `corepack pnpm test`, and `npm run build` after every task — all three must pass before moving on.

---

### Task 1: Remove "2-column/sidebar" language from the generation prompt

**Files:**
- Modify: `app/api/optimize/route.ts:80`, `:84`, `:88` (inside the `SYSTEM_PROMPT` template literal)

**Interfaces:**
- Consumes: nothing new — pure text edit inside an existing `const SYSTEM_PROMPT = \`...\`` string already defined at `app/api/optimize/route.ts:38`.
- Produces: nothing new — `SYSTEM_PROMPT` is already exported implicitly via `generateOptimizedCV`/`REPAIR_PROMPT` (which is `` `${SYSTEM_PROMPT}\n\n...` ``, so it inherits this change automatically — no separate edit needed there).

- [ ] **Step 1: Replace the 2-column layout intro sentence**

In `app/api/optimize/route.ts`, find this exact line (line 80):

```
3. Génère une nouvelle version du CV structurée pour une mise en page A4 deux colonnes (sidebar gauche : Compétences / Langues / Formation / Centres d'intérêt — colonne principale droite : Accroche, Expérience, et optionnellement Projets). **Important : les deux colonnes doivent être à peu près équilibrées en hauteur.** La sidebar doit générer assez de contenu pour ne pas finir mi-page.
```

Replace it with:

```
3. Génère une nouvelle version du CV structurée en UNE SEULE COLONNE (format ATS-friendly — de nombreux logiciels de recrutement lisent mal les CV multi-colonnes), dans cet ordre, chaque section uniquement si elle a du contenu dans la fiche vérité : Titre → Accroche → Expérience → Projets → Compétences → Formation → Langues → Centres d'intérêt.
```

- [ ] **Step 2: Remove "(en sidebar)" from the Formations bullet**

Find this exact line (line 84):

```
   - Formations (en sidebar) : **OBLIGATOIRE si la fiche vérité contient au moins une formation** — 3 à 4 entrées récentes/pertinentes, format compact : heading = intitulé court (ex: "Ingénieur Informatique"), subheading = "établissement · années". Si la place manque, réduis à 1-2 entrées plutôt que de supprimer toute la section.
```

Replace it with:

```
   - Formations : **OBLIGATOIRE si la fiche vérité contient au moins une formation** — 3 à 4 entrées récentes/pertinentes, format compact : heading = intitulé court (ex: "Ingénieur Informatique"), subheading = "établissement · années". Si la place manque, réduis à 1-2 entrées plutôt que de supprimer toute la section.
```

- [ ] **Step 3: Rewrite the 1-page objective to drop "2 colonnes" and generalize the 2-page exception**

Find this exact line (line 88):

```
   - **Objectif : tout doit tenir sur UNE seule page A4 en layout 2 colonnes**, et remplir ~90 % de la page. Pour gagner de la place, réduis D'ABORD les bullets/tags/nombre d'items secondaires (Projets, Centres d'intérêt) — les sections Compétences et Formation ne doivent JAMAIS disparaître entièrement si la fiche vérité en contient. Si le nombre d'expériences significatives rend tout ça impossible même en condensant au maximum, privilégie quand même la couverture complète des expériences significatives plutôt qu'une omission silencieuse — mais condense d'abord agressivement avant d'envisager ce cas.
```

Replace it with:

```
   - **Objectif : tenir sur UNE seule page A4 en une seule colonne**, et remplir ~90 % de la page. Pour gagner de la place, réduis D'ABORD les bullets/tags/nombre d'items secondaires (Projets, Centres d'intérêt) — les sections Compétences et Formation ne doivent JAMAIS disparaître entièrement si la fiche vérité en contient. Si le contenu significatif ne tient toujours pas sur 1 page même condensé au maximum, une 2ᵉ page propre est acceptable — ça doit rester l'exception, pas la norme.
```

- [ ] **Step 4: Verify no residual 2-column/sidebar language remains**

Run: `grep -n -i "colonne\|sidebar" app/api/optimize/route.ts`
Expected: no output (empty result — grep exits with status 1 when no match is found, that's correct here).

- [ ] **Step 5: Typecheck (text-only change, but confirms the file still parses)**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add app/api/optimize/route.ts
git commit -m "$(cat <<'EOF'
fix(optimize): retire la promesse de mise en page 2 colonnes du prompt

Le prompt decrivait une sidebar/2 colonnes que ni lib/cv-pdf.tsx ni
lib/cv-html.ts n'ont jamais implementee (les deux rendent en 1 seule
colonne). Le prompt correspond maintenant au rendu reel, avec un ordre de
sections explicite pour le format ATS-friendly 1 colonne.
EOF
)"
```

---

### Task 2: Cap the PDF export fallback at 2 pages, reject 3+ with a clear error

**Files:**
- Modify: `app/api/pdf/route.ts:59-71`
- Create: `app/api/pdf/route.test.ts`

**Interfaces:**
- Consumes: `renderCVToBuffer(cv: OptimizedCV, options: CVPdfOptions): Promise<Buffer>` from `@/lib/cv-pdf` (unchanged signature), `countPdfPages(buf: Buffer): number` from `@/lib/pdf-utils` (unchanged signature). Both already imported in `app/api/pdf/route.ts:3-4`.
- Produces: `POST(req: Request): Promise<Response>` — same exported signature as today, only its response for the `finalPages` 2-vs-3+ boundary changes (200 instead of 422 for exactly 2 pages; 422 with an updated message for 3+ pages instead of any page count > 1).

- [ ] **Step 1: Write the failing tests**

Create `app/api/pdf/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OptimizedCV } from "@/app/types";

const { renderCVToBuffer, countPdfPages } = vi.hoisted(() => ({
  renderCVToBuffer: vi.fn(),
  countPdfPages: vi.fn(),
}));

vi.mock("@/lib/cv-pdf", () => ({
  renderCVToBuffer,
}));

vi.mock("@/lib/pdf-utils", () => ({
  countPdfPages,
}));

import { POST } from "./route";

const VALID_CV: OptimizedCV = {
  fullName: "Jean Dupont",
  title: "Développeur",
  accroche: "",
  contact: {
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
  },
  sections: [],
};

function makeRequest(cv: unknown): Request {
  return new Request("http://localhost/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cv }),
  });
}

beforeEach(() => {
  renderCVToBuffer.mockReset();
  countPdfPages.mockReset();
  renderCVToBuffer.mockResolvedValue(Buffer.from("fake-pdf"));
});

describe("POST /api/pdf — seuil de pages", () => {
  it("expédie normalement un PDF qui tient sur 1 page", async () => {
    countPdfPages.mockReturnValue(1);

    const res = await POST(makeRequest(VALID_CV));

    expect(res.status).toBe(200);
  });

  it("expédie un PDF qui tient sur 2 pages après densité max (nouveau fallback)", async () => {
    countPdfPages.mockReturnValue(2);

    const res = await POST(makeRequest(VALID_CV));

    expect(res.status).toBe(200);
  });

  it("bloque avec une erreur claire un PDF qui reste à 3 pages ou plus", async () => {
    countPdfPages.mockReturnValue(3);

    const res = await POST(makeRequest(VALID_CV));

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toMatch(/trop long/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm test`
Expected: the "2 pages" test fails (current code returns 422 for any `finalPages > 1`, so it gets 422 instead of the expected 200). The "1 page" test should already pass (no behavior change there). The "3 pages" test should already pass by coincidence (current code already blocks anything `> 1`, so 3 pages already returns 422) — but its error message assertion (`/trop long/i`) will fail since the current message says "dépasse une page", not "trop long".

- [ ] **Step 3: Update the page-count check in the route**

In `app/api/pdf/route.ts`, find this exact block (lines 59-71):

```ts
    console.log(`[api/pdf] final: density=${usedDensity}, pages=${finalPages}`);

    // Ne jamais expédier silencieusement un PDF qui dépasse 1 page même à densité
    // maximale : le candidat croirait avoir un CV conforme au format annoncé.
    if (finalPages > 1) {
      return NextResponse.json(
        {
          error:
            "Le CV dépasse une page même à la densité maximale. Réduis le contenu (bullets, nombre d'expériences) avant de générer le PDF.",
        },
        { status: 422 }
      );
    }
```

Replace it with:

```ts
    console.log(`[api/pdf] final: density=${usedDensity}, pages=${finalPages}`);

    // 1 page = idéal, 2 pages = fallback accepté (contenu légitime qui ne tient pas en
    // 1 colonne même condensé au maximum). Au-delà, ce n'est plus un CV optimisé — on ne
    // l'expédie jamais silencieusement. Pas de réparation IA ici : cette route est un
    // renderer pur sans accès au modèle, la condensation de contenu est décidée par
    // /api/optimize, pas ici.
    if (finalPages >= 3) {
      return NextResponse.json(
        {
          error:
            "Ce CV est trop long pour être exporté proprement (3 pages ou plus même à densité maximale). Retire des bullets ou des expériences moins prioritaires dans l'éditeur avant de réessayer.",
        },
        { status: 422 }
      );
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm test`
Expected: all tests in `app/api/pdf/route.test.ts` pass, plus all pre-existing tests in `app/api/optimize/route.test.ts` still pass (25 tests).

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`, no type errors, `/api/pdf` still listed in the route output.

- [ ] **Step 6: Commit**

```bash
git add app/api/pdf/route.ts app/api/pdf/route.test.ts
git commit -m "$(cat <<'EOF'
fix(pdf): plafonne le fallback a 2 pages, rejette 3+ avec une erreur claire

Remplace le blocage systematique au-dela d'1 page par un vrai fallback :
1 page ideal, 2 pages accepte (contenu legitime qui ne tient pas en 1
colonne meme condense au max), 3+ pages toujours rejete explicitement.
EOF
)"
```

---

### Task 3: Remove the hard clip in the live preview, with robust content-height measurement

**Files:**
- Modify: `app/components/editor/LivePreview.tsx` (full rewrite of the component body — state, refs, both `<iframe>` elements, and their wrapping containers)

**Interfaces:**
- Consumes: `buildHtml(cv, photo, accentColorHex, template): string` from `@/lib/cv-html` (unchanged). `A4_W`/`A4_H` constants stay as the *initial/fallback* dimensions, no longer the hard ceiling.
- Produces: same exported `LivePreview(props: Props)` component, same `Props` type — no signature change, purely internal behavior.

- [ ] **Step 1: Replace the full component file**

Read the current file first to confirm no unrelated changes have landed since this plan was written:

Run: `git diff --stat app/components/editor/LivePreview.tsx`
Expected: no output (clean, matches the version this plan was written against).

Write the complete new content to `app/components/editor/LivePreview.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OptimizedCV } from "@/app/types";
import { buildHtml, type Template } from "@/lib/cv-html";
import { ACCENT_HEX, type AccentKey } from "@/app/lib/editorState";

type Props = {
  cv: OptimizedCV;
  photo: string | null;
  accent: AccentKey;
  template: Template;
};

const A4_W = 794;
const A4_H = 1123;
// Borne purement visuelle du wrapper (scroll au-delà) — jamais appliquée à l'iframe
// elle-même, qui doit toujours refléter la hauteur réelle du contenu.
const PREVIEW_MAX_VH = 80;

/**
 * Mesure la hauteur réelle du contenu d'une iframe déjà chargée (srcDoc same-origin).
 * Attend un cycle de layout (rAF) puis, si possible, le chargement des web fonts
 * (document.fonts.ready) avant de lire scrollHeight — mesurer trop tôt sous-estime la
 * hauteur d'un texte dont la police custom n'a pas fini de charger.
 */
async function measureIframeContentHeight(iframe: HTMLIFrameElement): Promise<number> {
  const doc = iframe.contentDocument;
  if (!doc) return A4_H;

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const fonts = doc.fonts;
  if (fonts?.ready) {
    await fonts.ready.catch(() => undefined);
  }

  const measured = Math.max(
    doc.documentElement?.scrollHeight ?? 0,
    doc.body?.scrollHeight ?? 0
  );
  return measured > 0 ? measured : A4_H;
}

/**
 * Iframe qui rend le HTML EXACT utilisé par /api/pdf — preview pixel-perfect.
 * - Auto-scale par défaut pour tenir dans le parent
 * - Hauteur mesurée dynamiquement sur le contenu réel (jamais clippée silencieusement) ;
 *   seul le wrapper visuel est borné (scroll), jamais l'iframe elle-même
 * - Bouton "Plein écran" → modal A4 à 100% (ou max-fit fenêtre)
 * - Debounce 250ms sur srcDoc pour éviter le jank
 */
export function LivePreview({ cv, photo, accent, template }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(A4_H);
  const [fullscreen, setFullscreen] = useState(false);

  // Mesure la largeur du conteneur
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build HTML mémoïsé
  const html = useMemo(
    () => buildHtml(cv, photo ?? undefined, ACCENT_HEX[accent], template),
    [cv, photo, accent, template]
  );

  // Debounce 250ms
  const [debouncedHtml, setDebouncedHtml] = useState(html);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHtml(html), 250);
    return () => clearTimeout(t);
  }, [html]);

  // Échap pour fermer le plein écran
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  // Nettoyage du ResizeObserver de contenu au démontage
  useEffect(() => {
    return () => resizeObserverRef.current?.disconnect();
  }, []);

  function handlePreviewIframeLoad() {
    const iframe = iframeRef.current;
    if (!iframe) return;

    measureIframeContentHeight(iframe).then(setContentHeight);

    resizeObserverRef.current?.disconnect();
    const body = iframe.contentDocument?.body;
    if (body) {
      const observer = new ResizeObserver(() => {
        measureIframeContentHeight(iframe).then(setContentHeight);
      });
      observer.observe(body);
      resizeObserverRef.current = observer;
    }
  }

  function handleFullscreenIframeLoad() {
    const iframe = fullscreenIframeRef.current;
    if (!iframe) return;
    measureIframeContentHeight(iframe).then(setContentHeight);
  }

  const scale = containerWidth > 0 ? Math.min(1, containerWidth / A4_W) : 1;
  const scaledH = contentHeight * scale;
  const pct = Math.round(scale * 100);

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        {/* Toolbar du preview */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-accent">
            <span className="text-accent">●</span> Aperçu PDF en direct
          </p>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="group inline-flex items-center gap-1.5 border border-rule px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted transition hover:border-ink hover:text-ink"
            aria-label="Ouvrir l'aperçu en plein écran"
          >
            <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M2 5V2H5M9 2H12V5M12 9V12H9M5 12H2V9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Plein écran</span>
          </button>
        </div>

        <div
          className="overflow-y-auto border border-rule bg-white shadow-[0_18px_44px_-22px_rgba(15,15,16,0.28)]"
          style={{ height: `${scaledH}px`, maxHeight: `${PREVIEW_MAX_VH}vh` }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={debouncedHtml}
            onLoad={handlePreviewIframeLoad}
            title="Aperçu PDF en direct"
            sandbox="allow-same-origin"
            className="block border-0 bg-white"
            style={{
              width: `${A4_W}px`,
              height: `${contentHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-faint">
          <span>↪ aperçu du rendu final</span>
          <span>A4 · {pct} %</span>
        </div>
      </div>

      {/* Modal plein écran */}
      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu PDF plein écran"
          className="fixed inset-0 z-50 flex flex-col bg-ink/85 backdrop-blur"
          onClick={(e) => {
            // Clic sur le backdrop (pas sur la modal) → ferme
            if (e.target === e.currentTarget) setFullscreen(false);
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-paper/10 px-6 py-3">
            <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-paper">
              <span className="text-accent">●</span> Aperçu PDF · A4
            </p>
            <div className="flex items-center gap-2">
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-paper/60 sm:inline">
                Esc pour fermer
              </span>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                aria-label="Fermer"
                className="inline-flex h-9 w-9 items-center justify-center border border-paper/20 text-paper transition hover:border-paper hover:bg-paper/10"
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M3 3L11 11M11 3L3 11" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Contenu : A4 centré, scrollable si trop grand */}
          <div className="flex-1 overflow-auto p-6 sm:p-10">
            <div
              className="mx-auto bg-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.5)]"
              style={{ width: `${A4_W}px`, height: `${contentHeight}px` }}
            >
              <iframe
                ref={fullscreenIframeRef}
                srcDoc={debouncedHtml}
                onLoad={handleFullscreenIframeLoad}
                title="Aperçu PDF plein écran"
                sandbox="allow-same-origin"
                className="block h-full w-full border-0 bg-white"
              />
            </div>
            <p className="mx-auto mt-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60">
              ↪ rendu exact du PDF · 100 %
            </p>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. (If `FontFaceSet`/`Document.fonts` isn't recognized, confirm `tsconfig.json`'s `lib` array includes `"dom"` — it already does per `tsconfig.json:5`, no change needed there.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no type errors.

- [ ] **Step 4: Manual verification in the browser**

This component has no automated test (DOM/iframe measurement logic isn't practically unit-testable without a full browser — the spec calls this out explicitly as manual-only). Verify by hand:

```bash
corepack pnpm dev > /tmp/cv-optimizer-dev.log 2>&1 &
disown
```

Wait for `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` to return `200`, then open `http://localhost:3000/optimiser` in a browser, generate or load a CV in the editor, and confirm:
- A CV that fits on 1 page: the preview box looks exactly as before (no extra blank space, no layout shift).
- A CV edited to be very long (add several extra bullets to multiple experiences until it would clearly exceed 1 page): the preview box grows and/or becomes scrollable, and every section is reachable by scrolling — nothing is cut off invisibly.
- Open "Plein écran" on the long CV: same — everything scrolls into view, no content is silently missing compared to what's in the editor.

- [ ] **Step 5: Commit**

```bash
git add app/components/editor/LivePreview.tsx
git commit -m "$(cat <<'EOF'
fix(editor): mesure la hauteur reelle de l'apercu au lieu de la clipper

L'iframe etait figee a exactement 1 page A4 avec overflow-hidden sur le
wrapper : tout contenu au-dela etait invisible sans aucun signal. Mesure
maintenant la hauteur reelle du contenu (onLoad + rAF + fonts.ready +
ResizeObserver) et l'applique a l'iframe elle-meme ; seul le wrapper visuel
est borne (max-height + scroll), jamais l'iframe.
EOF
)"
```

---

### Task 4: Detect experience dates silently dropped from the generated CV

**Files:**
- Modify: `app/api/optimize/route.ts` (inside `validateExperienceSourceIds`, ~line 779-786)
- Modify: `app/api/optimize/route.test.ts` (add a new `describe` block)

**Interfaces:**
- Consumes: `extractYears(value: string): string[]` (existing, unchanged), `SourceExperience.dates: string` (existing field).
- Produces: no new exported symbols — this extends the existing exported `validateExperienceSourceIds(payload, sourceFacts): string[]`, which already feeds into `validateOptimizedCV` and the `strongViolations` merge in `checkFidelity`. No caller changes needed.

**Why this task exists:** live testing surfaced a real gap — `validateExperienceSourceIds` already flags an experience subheading that contains a year NOT in the source (invented/contradictory dates), but says nothing when the generated subheading has NO year at all even though the source clearly has one (dates silently dropped, e.g. a subheading like "E-COMMERCE · MAINTENANCE ET ÉVOLUTION" replacing what should have been "2023 — 2024 · Paris"). This is the same class of fidelity bug as the missing-section checks already in this file (`validateRequiredSections`) — presence, not just correctness.

- [ ] **Step 1: Write the failing tests**

In `app/api/optimize/route.test.ts`, add this new `describe` block (anywhere after the existing `describe("sourceId manquant ou invalide", ...)` block is fine — it uses the same `makeSourceFacts`/`makeExperience`/`makePayload`/`makeExperienceItem` helpers already defined at the top of the file):

```ts
describe("dates manquantes", () => {
  it("signale des dates manquantes quand la fiche vérité a des années mais le subheading n'en a aucune", () => {
    const sourceFacts = makeSourceFacts([makeExperience({ dates: "2023 — 2024" })]);
    const payload = makePayload([makeExperienceItem({ subheading: "Angoulême" })]);

    const violations = validateExperienceSourceIds(payload, sourceFacts);

    expect(violations.some((v) => v.includes("Dates manquantes"))).toBe(true);
  });

  it("ne signale rien quand les dates sont bien présentes", () => {
    const sourceFacts = makeSourceFacts([makeExperience({ dates: "2023 — 2024" })]);
    const payload = makePayload([
      makeExperienceItem({ subheading: "2023 — 2024 · Angoulême" }),
    ]);

    expect(validateExperienceSourceIds(payload, sourceFacts)).toEqual([]);
  });

  it("ne signale rien quand la fiche vérité elle-même n'a pas d'année (ex: poste toujours en cours sans date chiffrée)", () => {
    const sourceFacts = makeSourceFacts([makeExperience({ dates: "En cours" })]);
    const payload = makePayload([makeExperienceItem({ subheading: "Angoulême" })]);

    expect(validateExperienceSourceIds(payload, sourceFacts)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify the first one fails**

Run: `npx vitest run`
Expected: the "signale des dates manquantes" test fails (current code has no check for the zero-years case, so no violation is produced and `violations.some(...)` is `false`). The other two tests in this new block already pass (no regression expected from them — they're guarding against over-tightening in a later step).

- [ ] **Step 3: Add the missing-dates check**

In `app/api/optimize/route.ts`, find this exact block inside `validateExperienceSourceIds` (~line 779-786):

```ts
    const sourceYears = new Set(extractYears(sourceExperience.dates));
    const generatedYears = extractYears(item.subheading);
    const unknownYears = generatedYears.filter((year) => !sourceYears.has(year));
    if (sourceYears.size > 0 && unknownYears.length > 0) {
      violations.push(
        `Dates contradictoires pour "${company || sourceExperience.company}" : année(s) ${unknownYears.join(", ")} absente(s) du CV source.`
      );
    }
  }
```

Replace it with:

```ts
    const sourceYears = new Set(extractYears(sourceExperience.dates));
    const generatedYears = extractYears(item.subheading);
    const unknownYears = generatedYears.filter((year) => !sourceYears.has(year));
    if (sourceYears.size > 0 && unknownYears.length > 0) {
      violations.push(
        `Dates contradictoires pour "${company || sourceExperience.company}" : année(s) ${unknownYears.join(", ")} absente(s) du CV source.`
      );
    }
    if (sourceYears.size > 0 && generatedYears.length === 0) {
      violations.push(
        `Dates manquantes pour "${company || sourceExperience.company}" : la fiche vérité indique ${Array.from(sourceYears).join(", ")} mais aucune date n'apparaît dans le CV généré.`
      );
    }
  }
```

(Only the closing `}` of the `for` loop moves down — everything above it is unchanged, this only adds the new `if` block right after the existing contradictory-dates check.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: all 3 new tests pass, plus the full existing suite still passes (28 pre-existing → 31 total: 25 in `app/api/optimize/route.test.ts` become 28, + 3 in `app/api/pdf/route.test.ts` unchanged).

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add app/api/optimize/route.ts app/api/optimize/route.test.ts
git commit -m "$(cat <<'EOF'
fix(optimize): detecte les dates d'experience supprimees silencieusement

validateExperienceSourceIds detectait deja une annee inventee dans le
subheading genere, mais pas l'absence totale de date quand la fiche verite
en a. Trouve en testant en conditions reelles (Kocosmetic sans dates,
remplacees par un descriptif secteur). Meme categorie que
validateRequiredSections : la presence compte autant que l'exactitude.
EOF
)"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Full test suite**

Run: `corepack pnpm test`
Expected: all tests pass (31 total: 28 in `app/api/optimize/route.test.ts` + 3 in `app/api/pdf/route.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, all routes listed including `/api/optimize`, `/api/pdf`, `/optimiser`.

- [ ] **Step 4: Confirm no residual 2-column language anywhere in the touched files**

Run: `grep -rn -i "colonne\|sidebar" app/api/optimize/route.ts app/api/pdf/route.ts app/components/editor/LivePreview.tsx`
Expected: no output.

- [ ] **Step 5: Report**

Summarize to the user: prompt no longer promises a 2-column layout, `/api/pdf` now accepts up to 2 pages and rejects 3+ with a clear message, and the live preview shows the true content height without silent clipping. Ask them to re-test with their real CV (the one from earlier in the session that produced a 2-page result) to confirm the export now succeeds and the preview shows the full content.
