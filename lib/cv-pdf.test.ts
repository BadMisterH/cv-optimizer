import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OptimizedCV } from "@/app/types";
import { renderCVToBuffer, type Template } from "./cv-pdf";
import { extractPdfText } from "./pdf-text";

// Next.js résout nativement le package "server-only" au build/dev (il n'est
// même pas dans node_modules ici) ; Vitest ne connaît pas cette résolution
// spéciale, donc importer lib/cv-pdf.tsx directement (au lieu de le mocker
// comme le fait app/api/pdf/route.test.ts) casse sans ce stub. vi.mock est
// hissé par Vitest au-dessus des imports, donc ceci s'applique bien avant
// que "./cv-pdf" ne soit résolu.
vi.mock("server-only", () => ({}));

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
 * autre mot des deux côtés), en tenant compte des lettres accentuées.
 * Insensible à la casse : le nom/titre/titres de section passent par
 * `textTransform: "uppercase"` dans le template (choix de design assumé,
 * cf. capture validée en brainstorming) — un vrai ATS fait un matching de
 * mots-clés insensible à la casse, donc ce test doit l'être aussi. */
function containsWholeWord(haystack: string, word: string): boolean {
  const pattern = new RegExp(
    `(?<![${LETTER_CLASS}])${escapeRegExp(word)}(?![${LETTER_CLASS}])`,
    "i"
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

// Render react-pdf + extraction pdf.js sont lents (import à froid des deux
// libs + rendu réel), largement au-delà du timeout par défaut de Vitest
// (5s). On rend une seule fois par template (beforeAll) plutôt qu'une fois
// par assertion — 2 renders au lieu de 8 — avec un timeout de hook généreux.
describe.each<Template>(["classic", "single", "ats"])("lisibilité ATS — template %s", (template) => {
  let text: string;

  beforeAll(async () => {
    text = await extractedTextFor(template);
  }, 30000);

  it("contient chaque mot du CV comme mot entier, sans collage", () => {
    for (const word of fixtureAlphaWords(FIXTURE_CV)) {
      expect(containsWholeWord(text, word), `mot manquant ou collé : "${word}"`).toBe(true);
    }
  });

  it("préserve les caractères accentués exacts", () => {
    // Comparaison insensible à la casse (nom/titres passent par
    // textTransform: "uppercase") — seul l'accent lui-même doit survivre.
    const lower = text.toLowerCase();
    expect(lower).toContain("développeuse");
    expect(lower).toContain("ingénieure");
    expect(lower).toContain("système");
    expect(lower).toContain("université");
  });

  it("contient les coordonnées de contact en texte lisible", () => {
    expect(text).toContain("amelie.beranger@example.fr");
    expect(text).toContain("+33 6 12 34 56 78");
    expect(text).toContain("Lyon, France");
    expect(text).toContain("linkedin.com/in/amelie-beranger");
    expect(text).toContain("github.com/aberanger");
    expect(text).toContain("amelieberanger.dev");
  });

  it("respecte l'ordre de lecture nom → titre → sections", () => {
    // Insensible à la casse pour la même raison que le test précédent.
    const lower = text.toLowerCase();
    const nameIdx = lower.indexOf("amélie béranger");
    const titleIdx = lower.indexOf("développeuse full-stack");
    const expIdx = lower.indexOf("expérience");
    const skillsIdx = lower.indexOf("compétences");
    const eduIdx = lower.indexOf("formation");

    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeGreaterThan(nameIdx);
    expect(expIdx).toBeGreaterThan(titleIdx);
    expect(skillsIdx).toBeGreaterThan(expIdx);
    expect(eduIdx).toBeGreaterThan(skillsIdx);
  });
});
