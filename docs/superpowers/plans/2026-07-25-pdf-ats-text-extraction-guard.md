# Garde-fou ATS sur le PDF généré — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un test technique qui génère un vrai PDF via `renderCVToBuffer`, en extrait le texte via `extractPdfText`, et vérifie que ce texte est ce qu'un lecteur ATS verrait réellement — présence complète, accents intacts, pas de mots collés, ordre de lecture correct.

**Architecture:** Un seul nouveau fichier de test, `lib/cv-pdf.test.ts`, qui réutilise deux fonctions déjà exportées sans les modifier (`renderCVToBuffer` de `lib/cv-pdf.tsx`, `extractPdfText` de `lib/pdf-text.ts`). Aucun appel réseau/IA. Si le test révèle un vrai défaut d'extraction dans le template, la correction se fait dans `lib/cv-pdf.tsx`.

**Tech Stack:** Vitest, `@react-pdf/renderer` (déjà en place), `unpdf` (déjà en place).

## Global Constraints

- Zéro coût API : ce test n'appelle jamais Anthropic. Vérifiable en confirmant qu'aucun import de `@anthropic-ai/sdk` n'apparaît dans le fichier de test.
- Ne modifie ni la signature ni le comportement de `renderCVToBuffer` ni `extractPdfText` — seulement leurs appelants (le test), et éventuellement le JSX interne de `lib/cv-pdf.tsx` si un vrai bug d'extraction est trouvé.
- Ne touche pas à `lib/cv-html.ts` (aperçu éditeur, hors scope).
- Testé sur les deux templates existants (`"classic"`, `"single"`), densité par défaut uniquement (la densité ne change pas la structure JSX, donc pas l'ordre/la présence du texte extrait).
- `\b` (word boundary) natif de JavaScript ne reconnaît QUE `[A-Za-z0-9_]` comme caractères de mot — les lettres accentuées françaises (é, è, à, ç...) n'en font PAS partie, donc `\bdéveloppeur\b` casserait au milieu du mot. Le test doit utiliser une frontière de mot maison basée sur une classe de caractères Unicode-français (`[A-Za-zÀ-ÖØ-öø-ÿ]`), pas `\b` brut.

---

## Task 1 : `lib/cv-pdf.test.ts` — garde-fou de lisibilité ATS

**Files:**
- Create: `lib/cv-pdf.test.ts`
- Read-only (pas de modif prévue, sauf découverte d'un vrai bug) : `lib/cv-pdf.tsx`, `lib/pdf-text.ts`, `app/types.ts`

**Interfaces:**
- Consumes: `renderCVToBuffer(cv: OptimizedCV, options?: { photo?, accentColor?, template?: "classic" | "single", density?: number }): Promise<Buffer>` from `./cv-pdf` ; `extractPdfText(buffer: Buffer | Uint8Array): Promise<string>` from `./pdf-text` ; types `OptimizedCV`, `CVSection`, `CVItem` from `@/app/types`.
- Produces: rien de consommé par du code applicatif — c'est un test terminal.

- [ ] **Step 1: Écrire la fixture et les helpers de vérification**

```ts
import { describe, expect, it } from "vitest";
import type { OptimizedCV } from "@/app/types";
import { renderCVToBuffer, type Template } from "./cv-pdf";
import { extractPdfText } from "./pdf-text";

// Fiche riche et volontairement piégeuse : accents français partout, tags
// côte à côte (risque de collage), heading/company/subheading sur une même
// ligne (risque d'ordre), contact complet (email/tel/liens).
const FIXTURE_CV: OptimizedCV = {
  fullName: "Amélie Béranger",
  title: "Développeuse Full-Stack",
  accroche:
    "Ingénieure passionnée par les architectures évolutives et l'expérience utilisateur.",
  contact: {
    email: "amelie.beranger@example.fr",
    phone: "+33 6 12 34 56 78",
    location: "Lyon, France",
    linkedin: "linkedin.com/in/amelie-beranger",
    github: "github.com/aberanger",
    portfolio: "amelieberanger.dev",
  },
  sections: [
    {
      title: "Expérience",
      items: [
        {
          heading: "Ingénieure logicielle senior",
          subheading: "2022 — 2024",
          company: "Studio Lumière",
          bullets: [
            "Piloté la refonte complète du système de facturation",
            "Encadré une équipe de quatre développeurs juniors",
          ],
          tags: [],
        },
      ],
    },
    {
      title: "Compétences",
      items: [
        {
          heading: "Langages",
          subheading: "",
          company: "",
          bullets: [],
          tags: ["TypeScript", "Python", "GraphQL"],
        },
      ],
    },
    {
      title: "Formation",
      items: [
        {
          heading: "Master Informatique",
          subheading: "2018 — 2020",
          company: "Université Claude Bernard",
          bullets: [],
          tags: [],
        },
      ],
    },
  ],
};

// [A-Za-zÀ-ÖØ-öø-ÿ] couvre les lettres accentuées françaises courantes.
// \b natif de JS ne reconnaît que [A-Za-z0-9_] comme caractère de mot, donc
// \bdéveloppeur\b casserait au milieu du mot (entre "d" et "é") — on définit
// donc une frontière de mot maison avec lookaround plutôt que \b.
const LETTER_CLASS = "A-Za-zÀ-ÖØ-öø-ÿ";

function alphaWords(text: string): string[] {
  return text.match(new RegExp(`[${LETTER_CLASS}]+`, "g")) ?? [];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Vrai si `word` apparaît dans `haystack` comme mot entier (pas collé à un
 * autre mot des deux côtés), en tenant compte des lettres accentuées. */
function containsWholeWord(haystack: string, word: string): boolean {
  const pattern = new RegExp(
    `(?<![${LETTER_CLASS}])${escapeRegExp(word)}(?![${LETTER_CLASS}])`
  );
  return pattern.test(haystack);
}

/** Tous les mots alphabétiques distincts de la fixture (hors contact, qui
 * contient des URLs/téléphone vérifiés séparément en substring). */
function fixtureAlphaWords(cv: OptimizedCV): string[] {
  const strings: string[] = [cv.fullName, cv.title, cv.accroche];
  for (const section of cv.sections) {
    strings.push(section.title);
    for (const item of section.items) {
      strings.push(item.heading, item.subheading, item.company ?? "", ...item.bullets, ...item.tags);
    }
  }
  const words = strings.flatMap(alphaWords);
  return Array.from(new Set(words));
}

async function extractedTextFor(template: Template): Promise<string> {
  const buffer = await renderCVToBuffer(FIXTURE_CV, { template });
  const text = await extractPdfText(buffer);
  expect(text.length).toBeGreaterThan(0);
  return text;
}

describe.each<Template>(["classic", "single"])("lisibilité ATS — template %s", (template) => {
  it("contient chaque mot du CV comme mot entier, sans collage", async () => {
    const text = await extractedTextFor(template);
    for (const word of fixtureAlphaWords(FIXTURE_CV)) {
      expect(containsWholeWord(text, word), `mot manquant ou collé : "${word}"`).toBe(true);
    }
  });

  it("préserve les caractères accentués exacts", async () => {
    const text = await extractedTextFor(template);
    expect(text).toContain("Développeuse");
    expect(text).toContain("Ingénieure");
    expect(text).toContain("système");
    expect(text).toContain("Université");
  });

  it("contient les coordonnées de contact en texte lisible", async () => {
    const text = await extractedTextFor(template);
    expect(text).toContain("amelie.beranger@example.fr");
    expect(text).toContain("+33 6 12 34 56 78");
    expect(text).toContain("Lyon, France");
    expect(text).toContain("linkedin.com/in/amelie-beranger");
    expect(text).toContain("github.com/aberanger");
    expect(text).toContain("amelieberanger.dev");
  });

  it("respecte l'ordre de lecture nom → titre → sections", async () => {
    const text = await extractedTextFor(template);
    const nameIdx = text.indexOf("Amélie Béranger");
    const titleIdx = text.indexOf("Développeuse Full-Stack");
    const expIdx = text.indexOf("Expérience");
    const skillsIdx = text.indexOf("Compétences");
    const eduIdx = text.indexOf("Formation");

    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeGreaterThan(nameIdx);
    expect(expIdx).toBeGreaterThan(titleIdx);
    expect(skillsIdx).toBeGreaterThan(expIdx);
    expect(eduIdx).toBeGreaterThan(skillsIdx);
  });
});
```

- [ ] **Step 2: Lancer les tests**

Run: `npx vitest run lib/cv-pdf.test.ts`

Deux issues possibles, à distinguer :
- **Échec attendu de type "assertion produit"** (un mot précis manquant/collé, un ordre inversé) : c'est le garde-fou qui fait son travail — passer au Step 3.
- **Erreur d'exécution** (import cassé, type incompatible) : corriger le test lui-même, ce n'est pas un défaut du template.

- [ ] **Step 3: Si un vrai défaut d'extraction est confirmé, corriger `lib/cv-pdf.tsx`**

Cette étape est conditionnelle — ne s'applique que si Step 2 échoue pour une vraie raison de contenu. Deux correctifs ciblés selon le risque identifié en spec (§2), à appliquer seulement si l'échec correspondant se manifeste :

*Si les tags collent entre eux* (ex. "TypeScriptPython" au lieu de "TypeScript Python") : dans la section "Tags" de `CVItem` (`lib/cv-pdf.tsx`, autour de la ligne 398-419), chaque tag est déjà dans sa propre `<View>` avec `marginRight: 4` — le problème serait que react-pdf/pdf.js n'insère aucun espace de séparation textuelle entre deux `View` visuellement espacées. Fix : ajouter un caractère espace explicite invisible entre les tags, par exemple en insérant `<Text style={{ fontSize: d.tagFontSize }}> </Text>` entre deux pastilles consécutives dans le `.map`, ou en préfixant chaque `tag` texte d'un espace insécable si `i > 0`.

*Si l'ordre heading/company/subheading est incorrect* : confirmer que le JSX émet bien `heading` puis `company` puis `subheading` dans cet ordre (c'est déjà le cas actuellement, lignes 314-353) — si le test le contredit, c'est que l'hypothèse de ce plan sur l'ordre d'extraction de pdf.js est fausse pour une mise en page `justify-content: space-between`, auquel cas il faut restructurer le rendu pour que l'ordre visuel suive l'ordre du flux de texte (peu probable, mais si constaté, escalader avant de casser la mise en page existante plutôt que de deviner un correctif).

Après toute correction, revenir au Step 2.

- [ ] **Step 4: Confirmer que la suite complète ne régresse pas**

Run: `npx vitest run`
Expected: tous les tests passent, y compris les 70 tests existants plus les nouveaux de `lib/cv-pdf.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/cv-pdf.test.ts
git commit -m "test(cv-pdf): garde-fou de lisibilité ATS sur le PDF réellement généré"
```

Si Step 3 a modifié `lib/cv-pdf.tsx`, l'ajouter au même commit (ou un commit séparé juste avant, selon ce qui a été touché) :

```bash
git add lib/cv-pdf.tsx lib/cv-pdf.test.ts
git commit -m "fix(cv-pdf): corrige [description précise du défaut trouvé] pour la lisibilité ATS"
```

---

## Note

Ce plan est volontairement un seul task : c'est un ajout de test autonome, sans dépendance externe, sans changement de schéma ni d'API. Le Step 3 est conditionnel par nature (on ne sait pas à l'avance si un vrai bug existe) — c'est le but même de ce garde-fou : le découvrir, pas le présumer.
