import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  checkFidelity,
  findLowFidelityBullets,
  findOmittedExperiences,
  stripInternalFields,
  validateExperienceSourceIds,
  validateOptimizedCV,
  validateProjectsProvenance,
  validateRequiredSections,
  type GeneratedCVItem,
  type GeneratedOptimizeResponse,
  type SourceExperience,
  type SourceFacts,
} from "./route";

function makeExperience(overrides: Partial<SourceExperience> = {}): SourceExperience {
  return {
    id: "exp-1",
    role: "Développeur",
    company: "Acme Inc.",
    dates: "2022 — 2023",
    location: "Paris",
    context: "Développement d'une plateforme e-commerce",
    rawText:
      "Développeur chez Acme Inc. à Paris de 2022 à 2023. Développement d'une plateforme e-commerce en React et Node.js, gestion des paiements et du catalogue produit.",
    bullets: ["Développement d'une plateforme e-commerce en React et Node.js"],
    technologies: ["React", "Node.js"],
    ...overrides,
  };
}

function makeSourceFacts(experiences: SourceExperience[]): SourceFacts {
  return {
    fullName: "Jean Dupont",
    contact: {
      email: "jean@example.com",
      phone: "0600000000",
      location: "Paris",
      linkedin: "",
      github: "",
      portfolio: "",
    },
    experiences,
    education: [],
    projects: [],
    skills: [],
    languages: [],
    interests: [],
    warnings: [],
  };
}

function makeExperienceItem(overrides: Partial<GeneratedCVItem> = {}): GeneratedCVItem {
  return {
    heading: "Développeur",
    subheading: "2022 — 2023 · Paris",
    company: "Acme Inc.",
    sourceId: "exp-1",
    bullets: ["Développement d'une plateforme e-commerce en React et Node.js"],
    tags: [],
    ...overrides,
  };
}

function makePayloadWithSections(
  sections: Array<{ title: string; items: GeneratedCVItem[] }>
): GeneratedOptimizeResponse {
  return {
    cv: {
      fullName: "Jean Dupont",
      title: "Développeur Full-Stack",
      accroche: "Accroche.",
      contact: {
        email: "jean@example.com",
        phone: "0600000000",
        location: "Paris",
        linkedin: "",
        github: "",
        portfolio: "",
      },
      sections,
    },
    modifications: [],
    atsScore: {
      overall: 80,
      keywords: 80,
      skills: 80,
      structure: 90,
      tips: [],
      missingKeywords: [],
    },
    atsInterpretation: {
      identity: {
        fullName: "Jean Dupont",
        title: "Développeur Full-Stack",
        emailFound: true,
        phoneFound: true,
      },
      detectedSections: sections.map((s) => s.title),
      detectedSkills: [],
      matchedKeywords: [],
      missingKeywords: [],
      parsingRisks: [],
      summary: "OK.",
    },
  };
}

function makePayload(experienceItems: GeneratedCVItem[]): GeneratedOptimizeResponse {
  return makePayloadWithSections([{ title: "Expérience", items: experienceItems }]);
}

function makeSkillItem(overrides: Partial<GeneratedCVItem> = {}): GeneratedCVItem {
  return {
    heading: "Front-end",
    subheading: "",
    company: "",
    sourceId: "",
    bullets: [],
    tags: ["React"],
    ...overrides,
  };
}

function makeProjectItem(overrides: Partial<GeneratedCVItem> = {}): GeneratedCVItem {
  return {
    heading: "Un projet",
    subheading: "React · Node.js",
    company: "",
    sourceId: "",
    bullets: ["Un projet mené de bout en bout."],
    tags: [],
    ...overrides,
  };
}

function fakeAnthropicClient(create: (...args: unknown[]) => Promise<unknown>): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

describe("cas propre", () => {
  it("ne détecte aucun candidat quand tout est couvert et fidèle", () => {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    const payload = makePayload([makeExperienceItem()]);

    expect(findOmittedExperiences(payload, sourceFacts)).toEqual([]);
    expect(findLowFidelityBullets(payload, sourceFacts)).toEqual([]);
    expect(validateOptimizedCV(payload, sourceFacts)).toEqual([]);
  });

  it("checkFidelity n'appelle jamais l'audit LLM quand le pré-filtre ne trouve rien", async () => {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    const payload = makePayload([makeExperienceItem()]);
    const create = vi.fn(() => {
      throw new Error("l'audit ne devrait pas être appelé pour un cas propre");
    });

    const result = await checkFidelity(fakeAnthropicClient(create), payload, sourceFacts);

    expect(result.strongViolations).toEqual([]);
    expect(result.ambiguousNotes).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("sourceId manquant ou invalide", () => {
  it("signale une expérience sans sourceId comme violation strong", () => {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    const payload = makePayload([makeExperienceItem({ sourceId: "" })]);

    const violations = validateExperienceSourceIds(payload, sourceFacts);

    expect(violations.some((v) => v.includes("sans sourceId"))).toBe(true);
  });

  it("signale un sourceId qui ne correspond à aucune expérience source", () => {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    const payload = makePayload([makeExperienceItem({ sourceId: "exp-999" })]);

    const violations = validateExperienceSourceIds(payload, sourceFacts);

    expect(violations.some((v) => v.includes("sourceId inconnu"))).toBe(true);
  });

  it("checkFidelity bloque un sourceId invalide sans passer par l'audit sémantique quand l'expérience réelle est par ailleurs bien couverte", async () => {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    // item valide qui couvre exp-1 (pas d'omission, bon recouvrement lexical)
    // + item avec un sourceId inconnu (violation strong immédiate) : aucun des deux
    // pré-filtres ne doit produire de candidat, donc l'audit ne doit jamais être appelé.
    const payload = makePayload([
      makeExperienceItem({ sourceId: "exp-1" }),
      makeExperienceItem({ sourceId: "exp-999", bullets: [] }),
    ]);
    const create = vi.fn(() => {
      throw new Error("l'audit ne doit pas être nécessaire pour trancher un sourceId invalide");
    });

    const result = await checkFidelity(fakeAnthropicClient(create), payload, sourceFacts);

    expect(result.strongViolations.some((v) => v.includes("sourceId inconnu"))).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("même entreprise, expériences distinctes", () => {
  it("distingue deux passages chez le même employeur via sourceId sans les confondre", () => {
    const stage = makeExperience({
      id: "exp-1",
      dates: "2018 — 2019",
      context: "Stage commercial",
      rawText: "Stage commercial chez Acme Inc. en 2018-2019, prospection clients B2B.",
      bullets: ["Prospection clients B2B"],
    });
    const poste = makeExperience({
      id: "exp-2",
      dates: "2022 — 2023",
      context: "Développeur",
      rawText: "Développeur chez Acme Inc. en 2022-2023, développement web full-stack.",
      bullets: ["Développement web full-stack"],
    });
    const sourceFacts = makeSourceFacts([stage, poste]);

    const item1 = makeExperienceItem({
      sourceId: "exp-1",
      subheading: "2018 — 2019",
      bullets: ["Prospection clients B2B en 2018-2019"],
    });
    const item2 = makeExperienceItem({
      sourceId: "exp-2",
      subheading: "2022 — 2023",
      bullets: ["Développement web full-stack pour Acme"],
    });
    const payload = makePayload([item1, item2]);

    expect(findOmittedExperiences(payload, sourceFacts)).toEqual([]);
    expect(validateExperienceSourceIds(payload, sourceFacts)).toEqual([]);
  });

  it("détecte l'omission du bon passage même si l'autre existe chez la même entreprise", () => {
    const stage = makeExperience({ id: "exp-1", dates: "2018 — 2019" });
    const poste = makeExperience({ id: "exp-2", dates: "2022 — 2023" });
    const sourceFacts = makeSourceFacts([stage, poste]);

    // Seul exp-2 est représenté dans le CV généré : exp-1 doit être un candidat d'omission,
    // même si un fuzzy-match par nom d'entreprise aurait pu croire que "Acme Inc." était couvert.
    const payload = makePayload([makeExperienceItem({ sourceId: "exp-2" })]);

    const omitted = findOmittedExperiences(payload, sourceFacts);
    expect(omitted).toHaveLength(1);
    expect(omitted[0].id).toBe("exp-1");
  });
});

describe("rawText vide", () => {
  it("ne flague pas en cascade quand il n'y a pas assez de texte source pour juger", () => {
    const experience = makeExperience({ rawText: "", context: "", bullets: [] });
    const sourceFacts = makeSourceFacts([experience]);
    const payload = makePayload([
      makeExperienceItem({ bullets: ["Un bullet quelconque sans rapport connu"] }),
    ]);

    expect(findLowFidelityBullets(payload, sourceFacts)).toEqual([]);
  });

  it("flague un bullet à faible recouvrement quand du texte source existe bien", () => {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    const payload = makePayload([
      makeExperienceItem({
        bullets: ["Direction financière internationale de grands comptes bancaires"],
      }),
    ]);

    const candidates = findLowFidelityBullets(payload, sourceFacts);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].experienceId).toBe("exp-1");
  });
});

describe("audit sémantique conditionnel", () => {
  function lowOverlapScenario() {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    const payload = makePayload([
      makeExperienceItem({
        bullets: ["Direction financière internationale de grands comptes bancaires"],
      }),
    ]);
    return { sourceFacts, payload };
  }

  it("propage une erreur si l'audit renvoie un JSON invalide (fail-closed, jamais avalé silencieusement)", async () => {
    const { sourceFacts, payload } = lowOverlapScenario();
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "ceci n'est pas du JSON" }],
    });

    await expect(
      checkFidelity(fakeAnthropicClient(create), payload, sourceFacts)
    ).rejects.toThrow();
  });

  it("fusionne les violations strong de l'audit avec les violations heuristiques et isole les ambiguous", async () => {
    const { sourceFacts, payload } = lowOverlapScenario();
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            violations: [
              { severity: "strong", message: "Mission exagérée", experienceId: "exp-1" },
              { severity: "ambiguous", message: "Reformulation à vérifier", experienceId: null },
            ],
          }),
        },
      ],
    });

    const result = await checkFidelity(fakeAnthropicClient(create), payload, sourceFacts);

    expect(result.strongViolations).toContain("Mission exagérée");
    expect(result.ambiguousNotes).toEqual(["Reformulation à vérifier"]);
  });

  it("ne bloque pas quand l'audit ne renvoie que des ambiguous", async () => {
    const { sourceFacts, payload } = lowOverlapScenario();
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            violations: [
              { severity: "ambiguous", message: "Doute mineur", experienceId: "exp-1" },
            ],
          }),
        },
      ],
    });

    const result = await checkFidelity(fakeAnthropicClient(create), payload, sourceFacts);

    expect(result.strongViolations).toEqual([]);
    expect(result.ambiguousNotes).toEqual(["Doute mineur"]);
  });
});

describe("stripInternalFields", () => {
  it("retire sourceId avant de renvoyer le CV au client", () => {
    const payload = makePayload([makeExperienceItem()]);

    const cleaned = stripInternalFields(payload);

    expect(cleaned.cv.sections[0].items[0]).not.toHaveProperty("sourceId");
  });
});

describe("sections requises (Compétences / Formation)", () => {
  function sourceFactsWithSkillsAndEducation(): SourceFacts {
    return {
      ...makeSourceFacts([makeExperience()]),
      skills: ["React", "Node.js"],
      education: [
        {
          degree: "Master Informatique",
          institution: "Université de Paris",
          dates: "2018 — 2020",
          location: "Paris",
          details: [],
        },
      ],
    };
  }

  it("signale l'absence de section Compétences quand la fiche vérité a des compétences", () => {
    const sourceFacts = sourceFactsWithSkillsAndEducation();
    const payload = makePayloadWithSections([{ title: "Expérience", items: [makeExperienceItem()] }]);

    const violations = validateRequiredSections(payload, sourceFacts);

    expect(violations.some((v) => v.includes("Compétences"))).toBe(true);
  });

  it("signale l'absence de section Formation quand la fiche vérité a des formations", () => {
    const sourceFacts = sourceFactsWithSkillsAndEducation();
    const payload = makePayloadWithSections([{ title: "Expérience", items: [makeExperienceItem()] }]);

    const violations = validateRequiredSections(payload, sourceFacts);

    expect(violations.some((v) => v.includes("Formation"))).toBe(true);
  });

  it("ne signale rien quand les sections Compétences et Formation sont présentes", () => {
    const sourceFacts = sourceFactsWithSkillsAndEducation();
    const payload = makePayloadWithSections([
      { title: "Expérience", items: [makeExperienceItem()] },
      { title: "Compétences", items: [makeSkillItem()] },
      {
        title: "Formation",
        items: [
          {
            heading: "Master Informatique",
            subheading: "Université de Paris · 2018 — 2020",
            company: "",
            sourceId: "",
            bullets: [],
            tags: [],
          },
        ],
      },
    ]);

    expect(validateRequiredSections(payload, sourceFacts)).toEqual([]);
  });

  it("ne signale rien quand la fiche vérité n'a ni compétences ni formations", () => {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    const payload = makePayloadWithSections([{ title: "Expérience", items: [makeExperienceItem()] }]);

    expect(validateRequiredSections(payload, sourceFacts)).toEqual([]);
  });
});

describe("provenance de la section Projets", () => {
  it("signale une section Projets fabriquée quand la fiche vérité n'a aucun projet", () => {
    const sourceFacts = makeSourceFacts([makeExperience()]); // projects: []
    const payload = makePayloadWithSections([
      { title: "Expérience", items: [makeExperienceItem()] },
      { title: "Projets", items: [makeProjectItem()] },
    ]);

    const violations = validateProjectsProvenance(payload, sourceFacts);

    expect(violations.some((v) => v.includes("Projets"))).toBe(true);
  });

  it("ne signale rien quand la fiche vérité contient bien des projets", () => {
    const sourceFacts: SourceFacts = {
      ...makeSourceFacts([makeExperience()]),
      projects: [
        {
          name: "RelanceWork",
          context: "Gestionnaire de candidatures",
          dates: "2023",
          bullets: ["Application web full-stack"],
          technologies: ["TypeScript"],
        },
      ],
    };
    const payload = makePayloadWithSections([
      { title: "Expérience", items: [makeExperienceItem()] },
      { title: "Projets", items: [makeProjectItem()] },
    ]);

    expect(validateProjectsProvenance(payload, sourceFacts)).toEqual([]);
  });

  it("ne signale rien quand il n'y a pas de section Projets du tout", () => {
    const sourceFacts = makeSourceFacts([makeExperience()]);
    const payload = makePayload([makeExperienceItem()]);

    expect(validateProjectsProvenance(payload, sourceFacts)).toEqual([]);
  });
});

describe("auto-référence du heading de catégorie dans les tags", () => {
  it("n'accuse pas un tag qui reprend juste le nom de sa propre sous-catégorie", () => {
    const sourceFacts: SourceFacts = {
      ...makeSourceFacts([makeExperience()]),
      skills: ["WordPress", "WooCommerce"],
    };
    const payload = makePayloadWithSections([
      { title: "Expérience", items: [makeExperienceItem()] },
      {
        title: "Compétences",
        items: [makeSkillItem({ heading: "CMS & Contenus", tags: ["CMS", "WordPress", "WooCommerce"] })],
      },
    ]);

    expect(validateOptimizedCV(payload, sourceFacts)).toEqual([]);
  });

  it("continue de rejeter une compétence non justifiée même dans une sous-catégorie légitime", () => {
    const sourceFacts: SourceFacts = {
      ...makeSourceFacts([makeExperience()]),
      skills: ["WordPress"],
    };
    const payload = makePayloadWithSections([
      { title: "Expérience", items: [makeExperienceItem()] },
      {
        title: "Compétences",
        items: [makeSkillItem({ heading: "CMS & Contenus", tags: ["WordPress", "Kubernetes"] })],
      },
    ]);

    const violations = validateOptimizedCV(payload, sourceFacts);
    expect(violations.some((v) => v.includes("Kubernetes"))).toBe(true);
  });
});

describe("chiffres d'ancienneté calculés à partir des dates", () => {
  function sourceFactsWithTwoStints(): SourceFacts {
    return makeSourceFacts([
      makeExperience({ id: "exp-1", dates: "2022 — 2023" }),
      makeExperience({ id: "exp-2", company: "Beta Corp", dates: "2020 — 2022" }),
    ]);
  }

  it("n'accuse pas une durée d'expérience honnêtement calculée à partir des dates source", () => {
    const sourceFacts = sourceFactsWithTwoStints();
    const payload = makePayload([
      makeExperienceItem({ sourceId: "exp-1" }),
      makeExperienceItem({ sourceId: "exp-2", company: "Beta Corp" }),
    ]);
    payload.cv.accroche = "Webmaster confirmé avec 3 ans d'expérience sur WordPress et React.";

    const violations = validateOptimizedCV(payload, sourceFacts);
    expect(violations.some((v) => v.includes('"3"'))).toBe(false);
  });

  it("continue de rejeter un chiffre qui coïncide numériquement mais sans contexte d'ancienneté", () => {
    const sourceFacts = sourceFactsWithTwoStints();
    const payload = makePayload([
      makeExperienceItem({ sourceId: "exp-1" }),
      makeExperienceItem({ sourceId: "exp-2", company: "Beta Corp" }),
    ]);
    payload.cv.accroche = "Titulaire de 3 certifications professionnelles reconnues.";

    const violations = validateOptimizedCV(payload, sourceFacts);
    expect(violations.some((v) => v.includes('"3"'))).toBe(true);
  });

  it("continue de rejeter un résultat chiffré non déductible des dates (ex: pourcentage inventé)", () => {
    const sourceFacts = sourceFactsWithTwoStints();
    const payload = makePayload([
      makeExperienceItem({ sourceId: "exp-1" }),
      makeExperienceItem({ sourceId: "exp-2", company: "Beta Corp" }),
    ]);
    payload.cv.accroche = "A augmenté les ventes de 40% en un an.";

    const violations = validateOptimizedCV(payload, sourceFacts);
    expect(violations.some((v) => v.includes('"40"'))).toBe(true);
  });
});
