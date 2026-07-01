import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { CVItem, OptimizeResponse } from "@/app/types";
import {
  ANON_COOKIE_MAX_AGE,
  checkUsageGate,
  deductCredit,
} from "@/lib/usage-gate";

const MODEL = "claude-opus-4-7";

const SOURCE_FACTS_PROMPT = `Tu es un extracteur de faits de CV.

Ta mission est d'extraire fidèlement le contenu du CV PDF fourni, sans l'optimiser et sans tenir compte d'une offre d'emploi.

Règles non négociables :
- N'invente rien.
- Ne corrige pas les dates, villes, entreprises, intitulés, diplômes ou coordonnées.
- Conserve toutes les expériences significatives, même si elles semblent anciennes ou moins pertinentes.
- Si une information est absente ou illisible, retourne une chaîne vide ou un tableau vide.
- Les compétences doivent venir du CV : compétences explicitement listées ou clairement justifiées par les missions/projets du CV.
- N'ajoute jamais de compétence uniquement parce qu'elle serait utile pour une candidature.

Retourne uniquement le JSON demandé.`;

const SYSTEM_PROMPT = `Tu es un expert en recrutement et en optimisation de CV.

Ta mission est d'adapter un CV existant pour une offre d'emploi donnée, en utilisant uniquement les faits fournis dans la FICHE VÉRITÉ DU CV.

Hiérarchie des priorités, de la plus importante à la moins importante :
1. Fidélité stricte au parcours source
2. Clarté et lisibilité recruteur
3. Pertinence avec l'offre
4. Optimisation ATS
5. Mise en page sur une page

Objectif :
- Maximiser la pertinence du CV pour cette offre spécifique
- Mettre en avant les compétences et expériences les plus alignées
- Reformuler certains éléments pour correspondre aux mots-clés de l'offre (sans mentir)
- Réduire les éléments peu pertinents quand la place manque, sans suppression silencieuse des expériences significatives
- Ajouter des formulations professionnelles et impactantes uniquement si elles restent factuellement justifiées par le CV source

Contraintes importantes :
- Ne jamais inventer d'expérience ou de compétence
- Ne jamais changer l'adresse, la ville, les coordonnées, les dates, les entreprises, les écoles ou les diplômes
- Ne jamais faire croire que le candidat a travaillé dans l'entreprise citée dans l'offre si cette entreprise n'existe pas déjà dans ses expériences source
- Ne jamais relocaliser le candidat pour le rapprocher du site de l'offre
- Ne jamais transformer une mission en résultat chiffré si le chiffre n'est pas présent dans la fiche vérité
- Ne jamais ajouter une compétence demandée dans l'offre si elle n'est pas présente ou clairement justifiée dans la fiche vérité ; mets-la plutôt dans missingKeywords
- Rester fidèle au parcours initial extrait du PDF
- Adapter le ton pour un recruteur (clair, professionnel, impact direct)
- Optimiser pour les ATS (mots-clés présents dans l'offre)

Méthodologie :
1. Analyse l'offre d'emploi et identifie :
   - **Le type de contrat** (stage, alternance, CDD, CDI, freelance…) — repère-le dans le texte et ajuste l'accroche/le ton en conséquence (un CV pour CDI ne se présente pas comme un CV pour stage)
   - Les compétences clés demandées
   - Les mots-clés importants
   - Le type de profil recherché

2. Lis la FICHE VÉRITÉ DU CV. Elle est la seule source autorisée pour les faits du candidat.

3. Génère une nouvelle version du CV structurée pour une mise en page A4 deux colonnes (sidebar gauche : Compétences / Langues / Formation / Centres d'intérêt — colonne principale droite : Accroche, Expérience, et optionnellement Projets). **Important : les deux colonnes doivent être à peu près équilibrées en hauteur.** La sidebar doit générer assez de contenu pour ne pas finir mi-page.
   - Titre adapté à l'offre
   - Accroche personnalisée (3 phrases, 50-65 mots) qui pose le profil, le parcours et la motivation pour l'offre
   - Expériences : 3 à 5 expériences selon pertinence et importance réelle dans le CV source, **2 à 3 bullets par poste**, chaque bullet de 12-20 mots avec verbe d'action + contexte factuel. **IMPORTANT** : pour les expériences, mets le NOM DE L'ENTREPRISE SOURCE dans le champ "company" (ex: "Acme Inc.", "BNP Paribas") et UNIQUEMENT le rôle/intitulé du poste source ou légèrement clarifié dans "heading" (ex: "Développeur Full-Stack"). Dans le subheading, garde les dates source et ajoute seulement un secteur/contexte si la fiche vérité le justifie.
   - Formations (en sidebar) : 3 à 4 entrées récentes/pertinentes, format compact : heading = intitulé court (ex: "Ingénieur Informatique"), subheading = "établissement · années"
   - **Section "Projets" recommandée** dans la colonne principale si le CV original mentionne des réalisations (2 items, heading=nom du projet, subheading=stack/contexte, 1 bullet par projet décrivant l'enjeu)
   - Compétences : **4 sous-sections regroupées par catégorie**, 4-7 tags par sous-section, choisis parmi les compétences de la fiche vérité qui matchent l'offre
   - Ajout de mots-clés stratégiques issus de l'offre seulement quand ils sont factuellement justifiés par la fiche vérité
   - **CRITIQUE : tout doit tenir sur UNE seule page A4 en layout 2 colonnes**, mais doit aussi remplir ~90 % de la page. Pas de page 2, pas de page à moitié vide.
   - Pour la section "Centres d'intérêt", utilise UN SEUL item avec heading "Centres d'intérêt" et 3 bullets avec brève qualité associée (ex: "Taekwondo (ceinture noire) — rigueur, dépassement de soi") — JAMAIS plusieurs items distincts avec des headings orphelins
   - Pour la section "Langues", utilise UN SEUL item avec heading "Langues" et bullets très courts (ex: "Français — natif", "Anglais — B1") — pas de subheading
   - Règle générale pour TOUTES les sections : un item doit toujours avoir soit des bullets soit des tags. Ne jamais générer un item avec uniquement un heading (sauf formation : heading=intitulé + subheading=établissement/dates accepté sans bullets)

Retourne le résultat dans le format JSON spécifié :
- "cv" : objet structuré avec nom, titre, accroche, contact, et sections (chaque section a un titre et des items avec heading/subheading/bullets/tags)
- "modifications" : liste à puces des changements effectués par rapport au CV original (ce qui a été reformulé, mis en avant, réduit ou retiré). Mentionne explicitement les expériences importantes réduites ou retirées pour tenir sur une page. Ne prétends jamais avoir ajouté un fait.
- "atsScore" : score ATS estimé du CV OPTIMISÉ par rapport à l'offre. Calcule honnêtement, sois critique. Décompose en :
   - "overall" (0-100) : score global. Calcule comme moyenne pondérée : keywords ×0.5 + skills ×0.25 + structure ×0.25. Arrondis à l'entier. Un CV qui matche très bien l'offre = 85-95. Un CV moyen = 60-75. Évite 100 (réserve pour cas parfait extrêmement rare). Évite < 50 sauf si vraiment mauvais.
   - "keywords" (0-100) : % des mots-clés importants de l'offre présents dans le CV (exact match ou variations proches). Identifie les 10-15 mots-clés critiques de l'offre (technos, compétences, soft skills, certifications, méthodologies) et compte la proportion qui apparaît dans le CV.
   - "skills" (0-100) : densité et pertinence des compétences. Si la section Compétences couvre bien le périmètre de l'offre avec des tags variés et précis → 85-95. Si vague ou incomplète → 50-70.
   - "structure" (0-100) : qualité structurelle : bullets avec verbes d'action, format clair, sections appropriées, longueur adaptée. Le CV que TU viens de générer doit scorer 90+ ici.
   - "tips" : 2 à 4 suggestions COURTES et ACTIONNABLES (max 15 mots chacune) pour passer le score à 95+. Exemples : "Ajoute une certification AWS si tu l'as réellement", "Quantifie la 2e expérience avec un chiffre réel". Pas de blabla générique.
   - "missingKeywords" : liste de 3-8 mots-clés/compétences importants de l'offre qui MANQUENT (ou sont sous-représentés) dans le CV. Ces termes doivent être réels et exacts, pas inventés. Si tout est couvert, retourne un tableau vide [].
- "atsInterpretation" : interprétation ATS ESTIMÉE du CV optimisé. Ne prétends jamais que c'est un scan réel du PDF final. Explique ce qu'un logiciel de recrutement devrait probablement comprendre à partir du CV structuré que tu viens de générer. Décompose en :
   - "identity.fullName" : nom détectable dans le CV optimisé
   - "identity.title" : titre/profil détectable dans le CV optimisé
   - "identity.emailFound" et "identity.phoneFound" : true si l'information existe dans le CV optimisé, sinon false
   - "detectedSections" : sections que l'ATS devrait reconnaître (ex: Expérience, Formation, Compétences)
   - "detectedSkills" : 8 à 16 compétences détectables et cohérentes avec le CV optimisé
   - "matchedKeywords" : 5 à 12 mots-clés de l'offre bien présents dans le CV optimisé
   - "missingKeywords" : 3 à 8 mots-clés importants encore absents ou sous-représentés. Si rien d'important ne manque, retourne []
   - "parsingRisks" : 0 à 5 risques concrets de lecture ATS ou de compréhension (ex: "photo ignorée par certains ATS", "impact peu quantifié"). Ne mentionne pas un risque si tu ne peux pas le justifier.
   - "summary" : 1 à 2 phrases directes pour le candidat : ce que l'ATS devrait comprendre et le principal point à surveiller.

Pour les sections du CV, utilise typiquement : "Expérience", "Formation", "Compétences", "Projets", "Langues", "Centres d'intérêt" selon ce qui est présent dans la fiche vérité. Ne crée jamais de section qui n'existe pas dans le CV source.

Pour chaque item :
- "heading" : titre principal — POUR LES EXPÉRIENCES, met uniquement le rôle (ex: "Développeur Full-Stack"). POUR LES FORMATIONS, l'intitulé (ex: "Master en Informatique")
- "company" : pour les EXPÉRIENCES, nom de l'entreprise (ex: "Acme Inc."). Pour les autres types d'items (formation, projet, compétence, langue, hobby), chaîne vide ""
- "subheading" : informations secondaires (ex: "Sept. 2023 — Juin 2024 · Paris")
- "bullets" : descriptions/réalisations (pour expériences/projets/formations)
- "tags" : compétences techniques (pour la section Compétences)

Si un champ n'est pas pertinent pour un item, retourne une chaîne vide pour heading/subheading et un tableau vide pour bullets/tags.`;

const REPAIR_PROMPT = `${SYSTEM_PROMPT}

Tu reçois aussi une liste de violations détectées par un validateur serveur.
Corrige le CV pour supprimer toutes les violations.
Si une information demandée par l'offre n'est pas prouvée par la fiche vérité, ne l'ajoute pas : mets-la dans missingKeywords ou dans tips comme suggestion à valider.`;

const cvSchema = {
  type: "object",
  properties: {
    cv: {
      type: "object",
      properties: {
        fullName: { type: "string" },
        title: { type: "string" },
        accroche: { type: "string" },
        contact: {
          type: "object",
          properties: {
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            linkedin: { type: "string" },
            github: { type: "string" },
            portfolio: { type: "string" },
          },
          required: ["email", "phone", "location", "linkedin", "github", "portfolio"],
          additionalProperties: false,
        },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    heading: { type: "string" },
                    subheading: { type: "string" },
                    company: { type: "string" },
                    bullets: { type: "array", items: { type: "string" } },
                    tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["heading", "subheading", "company", "bullets", "tags"],
                  additionalProperties: false,
                },
              },
            },
            required: ["title", "items"],
            additionalProperties: false,
          },
        },
      },
      required: ["fullName", "title", "accroche", "contact", "sections"],
      additionalProperties: false,
    },
    modifications: {
      type: "array",
      items: { type: "string" },
    },
    atsScore: {
      type: "object",
      properties: {
        overall: { type: "integer" },
        keywords: { type: "integer" },
        skills: { type: "integer" },
        structure: { type: "integer" },
        tips: {
          type: "array",
          items: { type: "string" },
        },
        missingKeywords: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["overall", "keywords", "skills", "structure", "tips", "missingKeywords"],
      additionalProperties: false,
    },
    atsInterpretation: {
      type: "object",
      properties: {
        identity: {
          type: "object",
          properties: {
            fullName: { type: "string" },
            title: { type: "string" },
            emailFound: { type: "boolean" },
            phoneFound: { type: "boolean" },
          },
          required: ["fullName", "title", "emailFound", "phoneFound"],
          additionalProperties: false,
        },
        detectedSections: {
          type: "array",
          items: { type: "string" },
        },
        detectedSkills: {
          type: "array",
          items: { type: "string" },
        },
        matchedKeywords: {
          type: "array",
          items: { type: "string" },
        },
        missingKeywords: {
          type: "array",
          items: { type: "string" },
        },
        parsingRisks: {
          type: "array",
          items: { type: "string" },
        },
        summary: { type: "string" },
      },
      required: [
        "identity",
        "detectedSections",
        "detectedSkills",
        "matchedKeywords",
        "missingKeywords",
        "parsingRisks",
        "summary",
      ],
      additionalProperties: false,
    },
  },
  required: ["cv", "modifications", "atsScore", "atsInterpretation"],
  additionalProperties: false,
};

const sourceFactsSchema = {
  type: "object",
  properties: {
    fullName: { type: "string" },
    contact: {
      type: "object",
      properties: {
        email: { type: "string" },
        phone: { type: "string" },
        location: { type: "string" },
        linkedin: { type: "string" },
        github: { type: "string" },
        portfolio: { type: "string" },
      },
      required: ["email", "phone", "location", "linkedin", "github", "portfolio"],
      additionalProperties: false,
    },
    experiences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string" },
          company: { type: "string" },
          dates: { type: "string" },
          location: { type: "string" },
          context: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          technologies: { type: "array", items: { type: "string" } },
        },
        required: ["role", "company", "dates", "location", "context", "bullets", "technologies"],
        additionalProperties: false,
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree: { type: "string" },
          institution: { type: "string" },
          dates: { type: "string" },
          location: { type: "string" },
          details: { type: "array", items: { type: "string" } },
        },
        required: ["degree", "institution", "dates", "location", "details"],
        additionalProperties: false,
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          context: { type: "string" },
          dates: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          technologies: { type: "array", items: { type: "string" } },
        },
        required: ["name", "context", "dates", "bullets", "technologies"],
        additionalProperties: false,
      },
    },
    skills: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "string" } },
    interests: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "fullName",
    "contact",
    "experiences",
    "education",
    "projects",
    "skills",
    "languages",
    "interests",
    "warnings",
  ],
  additionalProperties: false,
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;

type SourceFacts = {
  fullName: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  experiences: Array<{
    role: string;
    company: string;
    dates: string;
    location: string;
    context: string;
    bullets: string[];
    technologies: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    dates: string;
    location: string;
    details: string[];
  }>;
  projects: Array<{
    name: string;
    context: string;
    dates: string;
    bullets: string[];
    technologies: string[];
  }>;
  skills: string[];
  languages: string[];
  interests: string[];
  warnings: string[];
};

type AnthropicTextResponse = {
  content: Array<{ type: string; text?: string }>;
};

function parseMessageJson<T>(response: AnthropicTextResponse): T {
  const textBlock = response.content.find(
    (block): block is { type: "text"; text: string } =>
      block.type === "text" && typeof block.text === "string"
  );
  if (!textBlock) {
    throw new Error("Pas de réponse texte du modèle.");
  }
  return JSON.parse(textBlock.text) as T;
}

async function extractSourceFacts(
  client: Anthropic,
  pdfBase64: string
): Promise<SourceFacts> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 12000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: SOURCE_FACTS_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: "Extrais la fiche vérité complète de ce CV. Ne l'adapte à aucune offre.",
          },
        ],
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: sourceFactsSchema },
    },
  });

  return parseMessageJson<SourceFacts>(response as AnthropicTextResponse);
}

async function generateOptimizedCV(
  client: Anthropic,
  sourceFacts: SourceFacts,
  offer: string,
  violations: string[] = []
): Promise<OptimizeResponse> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: violations.length > 0 ? REPAIR_PROMPT : SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `=== FICHE VÉRITÉ DU CV ===`,
              JSON.stringify(sourceFacts, null, 2),
              "",
              `=== OFFRE D'EMPLOI ===`,
              offer,
              violations.length > 0
                ? `\n=== VIOLATIONS À CORRIGER ===\n${violations.map((v) => `- ${v}`).join("\n")}`
                : "",
            ].join("\n"),
          },
        ],
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: cvSchema },
    },
  });

  return parseMessageJson<OptimizeResponse>(response as AnthropicTextResponse);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function looselyMatches(a: string, b: string): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return (
    (left.length >= 4 && right.includes(left)) ||
    (right.length >= 4 && left.includes(right))
  );
}

function matchesAny(value: string, allowedValues: string[]): boolean {
  return allowedValues.some((allowed) => looselyMatches(value, allowed));
}

function extractYears(value: string): string[] {
  return Array.from(value.matchAll(/\b(?:19|20)\d{2}\b/g), (match) => match[0]);
}

function extractNumbers(value: string): string[] {
  return Array.from(value.matchAll(/\b\d+(?:[.,]\d+)?\b/g), (match) =>
    match[0].replace(",", ".")
  );
}

function isExperienceSection(title: string): boolean {
  const normalized = normalizeText(title);
  return normalized.includes("experience") || normalized.includes("parcours professionnel");
}

function isSkillsSection(title: string): boolean {
  return normalizeText(title).includes("competence");
}

function isAllowedSkill(tag: string, sourceFacts: SourceFacts): boolean {
  const normalizedTag = normalizeText(tag);
  if (normalizedTag.length < 3) return true;

  const sourceText = normalizeText(JSON.stringify(sourceFacts));
  if (sourceText.includes(normalizedTag)) return true;

  const tokens = normalizedTag.split(" ").filter((token) => token.length >= 4);
  return tokens.length > 0 && tokens.every((token) => sourceText.includes(token));
}

function findSourceExperienceByCompany(
  company: string,
  sourceFacts: SourceFacts
): SourceFacts["experiences"][number] | undefined {
  return sourceFacts.experiences.find((experience) =>
    looselyMatches(company, experience.company)
  );
}

function validateContact(payload: OptimizeResponse, sourceFacts: SourceFacts): string[] {
  const violations: string[] = [];
  const sourceContact = sourceFacts.contact;
  const generatedContact = payload.cv.contact;

  if (
    sourceFacts.fullName &&
    payload.cv.fullName &&
    !looselyMatches(payload.cv.fullName, sourceFacts.fullName)
  ) {
    violations.push(
      `Nom modifié : "${payload.cv.fullName}" au lieu de "${sourceFacts.fullName}".`
    );
  }

  if (
    sourceContact.email &&
    sourceContact.email.toLowerCase() !== generatedContact.email.toLowerCase()
  ) {
    violations.push("Email modifié ou supprimé par rapport au CV source.");
  }

  if (
    sourceContact.phone &&
    normalizePhone(sourceContact.phone) !== normalizePhone(generatedContact.phone)
  ) {
    violations.push("Téléphone modifié ou supprimé par rapport au CV source.");
  }

  if (
    sourceContact.location &&
    generatedContact.location &&
    !looselyMatches(generatedContact.location, sourceContact.location)
  ) {
    violations.push(
      `Localisation modifiée : "${generatedContact.location}" au lieu de "${sourceContact.location}".`
    );
  }

  return violations;
}

function validateExperienceCompanies(
  payload: OptimizeResponse,
  sourceFacts: SourceFacts
): string[] {
  const violations: string[] = [];
  const sourceCompanies = sourceFacts.experiences
    .map((experience) => experience.company)
    .filter((company) => company.trim().length > 0);

  const experienceItems = payload.cv.sections
    .filter((section) => isExperienceSection(section.title))
    .flatMap((section) => section.items);

  for (const item of experienceItems) {
    const company = item.company ?? "";

    if (!company.trim()) {
      violations.push(`Expérience sans entreprise source : "${item.heading}".`);
      continue;
    }

    if (sourceCompanies.length === 0 || !matchesAny(company, sourceCompanies)) {
      violations.push(
        `Entreprise d'expérience inconnue : "${company}" n'existe pas dans le CV source.`
      );
      continue;
    }

    const sourceExperience = findSourceExperienceByCompany(company, sourceFacts);
    if (!sourceExperience) continue;

    const sourceYears = new Set(extractYears(sourceExperience.dates));
    const generatedYears = extractYears(item.subheading);
    const unknownYears = generatedYears.filter((year) => !sourceYears.has(year));
    if (sourceYears.size > 0 && unknownYears.length > 0) {
      violations.push(
        `Dates contradictoires pour "${company}" : année(s) ${unknownYears.join(", ")} absente(s) du CV source.`
      );
    }
  }

  return violations;
}

function validateSkills(payload: OptimizeResponse, sourceFacts: SourceFacts): string[] {
  const violations: string[] = [];
  const skillTags = payload.cv.sections
    .filter((section) => isSkillsSection(section.title))
    .flatMap((section) => section.items)
    .flatMap((item) => item.tags);

  for (const tag of skillTags) {
    if (!isAllowedSkill(tag, sourceFacts)) {
      violations.push(`Compétence non justifiée par le CV source : "${tag}".`);
    }
  }

  return violations;
}

function validateNumbers(payload: OptimizeResponse, sourceFacts: SourceFacts): string[] {
  const violations: string[] = [];
  const sourceNumbers = new Set(extractNumbers(JSON.stringify(sourceFacts)));

  const cvTexts = [
    payload.cv.title,
    payload.cv.accroche,
    ...payload.cv.sections.flatMap((section) =>
      section.items.flatMap((item: CVItem) => [
        item.heading,
        item.subheading,
        ...item.bullets,
        ...item.tags,
      ])
    ),
  ];

  for (const text of cvTexts) {
    for (const number of extractNumbers(text)) {
      if (!sourceNumbers.has(number)) {
        violations.push(`Chiffre non présent dans le CV source : "${number}" dans "${text}".`);
      }
    }
  }

  return violations;
}

function validateOptimizedCV(
  payload: OptimizeResponse,
  sourceFacts: SourceFacts
): { valid: boolean; violations: string[] } {
  const violations = [
    ...validateContact(payload, sourceFacts),
    ...validateExperienceCompanies(payload, sourceFacts),
    ...validateSkills(payload, sourceFacts),
    ...validateNumbers(payload, sourceFacts),
  ];

  return { valid: violations.length === 0, violations };
}

export async function POST(req: Request) {
  try {
    const gate = await checkUsageGate(req);
    if (!gate.allowed) {
      const error =
        gate.reason === "email_unverified"
          ? "Vérifie ton adresse email avant d'utiliser tes crédits."
          : gate.reason === "no_credits"
          ? "Tu n'as plus de crédits. Achète un pack pour continuer."
          : "Tu as déjà utilisé ton essai gratuit. Crée un compte pour continuer.";
      const status = gate.reason === "email_unverified" ? 403 : 401;
      return NextResponse.json(
        { error, redirect: gate.redirect },
        { status }
      );
    }

    const formData = await req.formData();
    const cvEntry = formData.get("cv");
    const offer = formData.get("offer");

    if (!(cvEntry instanceof File) || cvEntry.size === 0) {
      return NextResponse.json(
        { error: "Le CV (fichier PDF) est requis." },
        { status: 400 }
      );
    }

    if (cvEntry.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Le CV doit être un fichier PDF." },
        { status: 400 }
      );
    }

    if (cvEntry.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "Le PDF dépasse 25 Mo." },
        { status: 400 }
      );
    }

    if (typeof offer !== "string" || !offer.trim()) {
      return NextResponse.json(
        { error: "L'offre d'emploi est requise." },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY n'est pas configurée. Crée un fichier .env.local." },
        { status: 500 }
      );
    }

    const pdfBase64 = Buffer.from(await cvEntry.arrayBuffer()).toString("base64");

    const client = new Anthropic();
    const offerText = offer.trim();

    const sourceFacts = await extractSourceFacts(client, pdfBase64);
    let parsed = await generateOptimizedCV(client, sourceFacts, offerText);
    let validation = validateOptimizedCV(parsed, sourceFacts);

    if (!validation.valid) {
      parsed = await generateOptimizedCV(
        client,
        sourceFacts,
        offerText,
        validation.violations
      );
      validation = validateOptimizedCV(parsed, sourceFacts);
    }

    if (!validation.valid) {
      return NextResponse.json(
        {
          error:
            "La génération a été bloquée car elle modifiait des faits du CV source. Réessaie avec un PDF plus lisible ou ajuste le CV source.",
          details: validation.violations.slice(0, 8),
        },
        { status: 422 }
      );
    }

    parsed.modifications = [
      ...parsed.modifications,
      "Audit anti-invention validé : coordonnées, localisation, entreprises, dates, compétences et chiffres contrôlés par rapport au CV source.",
    ];

    if (gate.isAuthenticated && !gate.isAdmin) {
      await deductCredit(gate.userId);
    }

    const res = NextResponse.json(parsed);
    if (!gate.isAuthenticated && gate.cookieToSet) {
      res.cookies.set(gate.cookieToSet, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ANON_COOKIE_MAX_AGE,
      });
    }
    return res;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Erreur API IA (${err.status}): ${err.message}` },
        { status: err.status ?? 500 }
      );
    }
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
