import { describe, expect, it, vi } from "vitest";
import { buildHtml } from "@/lib/cv-html";
import { createBlankCV } from "./editorState";

// lib/cv-pdf.tsx importe "server-only", que Next résout nativement mais pas
// Vitest (cf. lib/cv-pdf.test.ts). vi.mock est hissé au-dessus des imports.
vi.mock("server-only", () => ({}));
const { renderCVToBuffer } = await import("@/lib/cv-pdf");

describe("createBlankCV", () => {
  it("pose la structure d'un CV français, prête à remplir", () => {
    const cv = createBlankCV();

    expect(cv.sections.map((s) => s.title)).toEqual([
      "Expérience",
      "Formation",
      "Compétences",
      "Langues",
    ]);
    // Chaque section arrive avec un item : l'éditeur montre où écrire plutôt
    // qu'une page vide où rien n'indique qu'on peut ajouter du contenu.
    for (const section of cv.sections) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it("ne contient aucun contenu à effacer avant de commencer", () => {
    const cv = createBlankCV();

    expect(cv.fullName).toBe("");
    expect(cv.title).toBe("");
    expect(cv.accroche).toBe("");
    expect(Object.values(cv.contact).every((v) => v === "")).toBe(true);

    for (const section of cv.sections) {
      for (const item of section.items) {
        expect(item.heading).toBe("");
        expect(item.subheading).toBe("");
        expect(item.company ?? "").toBe("");
        expect(item.bullets.every((b) => b === "")).toBe(true);
        expect(item.tags.every((t) => t === "")).toBe(true);
      }
    }
  });

  it("renvoie un objet neuf à chaque appel, jamais un état partagé", () => {
    // Sans ça, les modifications d'un premier remplissage fuiteraient dans le
    // suivant pendant la même session (l'objet servirait de state mutable).
    const a = createBlankCV();
    const b = createBlankCV();

    expect(a).not.toBe(b);
    expect(a.sections).not.toBe(b.sections);
    expect(a.sections[0]).not.toBe(b.sections[0]);
    expect(a.sections[0].items).not.toBe(b.sections[0].items);
    expect(a.contact).not.toBe(b.contact);

    a.sections[0].items[0].heading = "modifié";
    expect(b.sections[0].items[0].heading).toBe("");
  });

  it("traverse l'aperçu HTML sans casser", () => {
    const html = buildHtml(createBlankCV(), undefined, "#1f4bff", "classic");

    expect(html).toContain("<!DOCTYPE html>");
  });

  it("ne rend ni puce ni pastille vide tant que rien n'est saisi", () => {
    // Le squelette porte des chaînes vides pour que l'éditeur affiche des
    // placeholders cliquables. Elles ne doivent pas ressortir dans le rendu
    // sous forme de puce ou de pastille orpheline — ce qui vaut aussi quand un
    // utilisateur efface le texte d'une puce existante.
    const html = buildHtml(createBlankCV(), undefined, "#1f4bff", "classic");

    expect(html).not.toContain("<li></li>");
    expect(html).not.toContain("<span></span>");
  });

  it("traverse le rendu PDF sans casser, sur les trois templates", async () => {
    for (const template of ["classic", "single", "ats"] as const) {
      const buffer = await renderCVToBuffer(createBlankCV(), { template });
      expect(buffer.length, `template ${template}`).toBeGreaterThan(0);
    }
  }, 30000);
});
