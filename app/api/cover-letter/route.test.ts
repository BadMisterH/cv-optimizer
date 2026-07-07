import { describe, expect, it } from "vitest";
import type { LetterResponse } from "@/app/types";
import { validateLetterStrategy } from "./route";

function makeLetter(firstParagraph: string): LetterResponse {
  return {
    letter: {
      fullName: "Jean Dupont",
      contact: {
        email: "jean@example.com",
        phone: "0600000000",
        location: "Paris",
        linkedin: "",
        github: "",
        portfolio: "",
      },
      recipient: {
        company: "Pharmacie Centrale",
        role: "Préparateur en pharmacie",
        department: "",
        address: "",
      },
      city: "Paris",
      date: "5 juillet 2026",
      subject: "Candidature au poste de Préparateur en pharmacie",
      salutation: "Madame, Monsieur,",
      paragraphs: [
        firstParagraph,
        "Lors de mon expérience en officine, j'ai accompagné les patients au comptoir et suivi les produits à forte rotation.",
        "Je peux contribuer à maintenir un accueil clair, une délivrance fiable et une coordination fluide avec l'équipe.",
      ],
      closing:
        "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
      signature: "Jean Dupont",
    },
    notes: [],
  };
}

describe("validateLetterStrategy", () => {
  it("rejette l'accroche obsolète Votre annonce a retenu mon attention", () => {
    const result = validateLetterStrategy(
      makeLetter("Votre annonce a retenu mon attention et je souhaite vous adresser ma candidature.")
    );

    expect(result.some((v) => v.includes("Formule cliché"))).toBe(true);
  });

  it("rejette un premier paragraphe centré sur Je", () => {
    const result = validateLetterStrategy(
      makeLetter("Je souhaite rejoindre votre pharmacie pour développer mes compétences au comptoir.")
    );

    expect(result.some((v) => v.includes("centrée candidat"))).toBe(true);
  });

  it("accepte une accroche orientée enjeu employeur", () => {
    const result = validateLetterStrategy(
      makeLetter(
        "Dans une pharmacie de centre-ville, la qualité de conseil dépend autant de la précision au comptoir que de la disponibilité des produits à forte rotation."
      )
    );

    expect(result).toEqual([]);
  });
});
