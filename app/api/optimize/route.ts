import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { CVItem, OptimizedCV, OptimizeResponse } from "@/app/types";
import {
  ANON_COOKIE_MAX_AGE,
  checkUsageGate,
  deductCredit,
} from "@/lib/usage-gate";

const MODEL = "claude-opus-4-7";

const SIGNIFICANCE_DEFINITION = `Une expérience source est considérée SIGNIFICATIVE si au moins un des critères suivants est vrai :
- Durée ≥ 1 mois à temps plein (ou équivalent), ou stage/alternance de toute durée dès lors que la fiche vérité liste des missions concrètes (bullets non vide)
- Elle est directement pertinente pour l'offre (compétences/technologies qui recoupent des mots-clés de l'offre)
- Elle fait partie des 3 expériences les plus récentes du candidat
- Elle est la seule expérience du candidat dans un secteur/domaine donné (pas de doublon déjà représenté ailleurs dans le CV généré)

Elle n'est PAS significative seulement si TOUTES ces conditions sont vraies simultanément :
- Durée < 1 mois ET aucune mission concrète listée dans la fiche vérité
- Aucune pertinence apparente avec l'offre
- Une expérience très similaire (même rôle/secteur) est déjà représentée ailleurs dans le CV généré`;

const SOURCE_FACTS_PROMPT = `Tu es un extracteur de faits de CV.

Ta mission est d'extraire fidèlement le contenu du CV PDF fourni, sans l'optimiser et sans tenir compte d'une offre d'emploi.

Règles non négociables :
- N'invente rien.
- Ne corrige pas les dates, villes, entreprises, intitulés, diplômes ou coordonnées.
- Conserve toutes les expériences significatives, même si elles semblent anciennes ou moins pertinentes.
- Si une information est absente ou illisible, retourne une chaîne vide ou un tableau vide.
- Les compétences doivent venir du CV : compétences explicitement listées ou clairement justifiées par les missions/projets du CV.
- N'ajoute jamais de compétence uniquement parce qu'elle serait utile pour une candidature.
- Pour chaque expérience, fournis aussi "rawText" : le texte quasi-verbatim de ce bloc d'expérience tel qu'il apparaît dans le CV (avant toute reformulation ou résumé), utilisé plus tard pour vérifier la fidélité du CV optimisé. Si le texte est illisible, retourne une chaîne vide.

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
- Condenser (moins de bullets, formulations plus courtes) les éléments moins prioritaires quand la place manque, sans jamais supprimer silencieusement une expérience significative
- Ajouter des formulations professionnelles et impactantes uniquement si elles restent factuellement justifiées par le CV source

Définition d'une expérience "significative" (à utiliser pour décider ce qui doit apparaître dans le CV optimisé) :
${SIGNIFICANCE_DEFINITION}

Contraintes importantes :
- Ne jamais inventer d'expérience ou de compétence
- Ne jamais changer l'adresse, la ville, les coordonnées, les dates, les entreprises, les écoles ou les diplômes
- Ne jamais faire croire que le candidat a travaillé dans l'entreprise citée dans l'offre si cette entreprise n'existe pas déjà dans ses expériences source
- Ne jamais relocaliser le candidat pour le rapprocher du site de l'offre
- Ne jamais transformer une mission en résultat chiffré si le chiffre n'est pas présent dans la fiche vérité
- Ne jamais ajouter une compétence demandée dans l'offre si elle n'est pas présente ou clairement justifiée dans la fiche vérité ; mets-la plutôt dans missingKeywords
- Ne jamais exagérer le niveau de responsabilité, le périmètre ou l'impact d'une mission au-delà de ce qu'indiquent "rawText", "bullets" et "context" de l'expérience source
- Rester fidèle au parcours initial extrait du PDF
- Adapter le ton pour un recruteur (clair, professionnel, impact direct)
- Optimiser pour les ATS (mots-clés présents dans l'offre)

Méthodologie :
1. Analyse l'offre d'emploi et identifie :
   - **Le type de contrat** (stage, alternance, CDD, CDI, freelance…) — repère-le dans le texte et ajuste l'accroche/le ton en conséquence (un CV pour CDI ne se présente pas comme un CV pour stage)
   - Les compétences clés demandées
   - Les mots-clés importants
   - Le type de profil recherché

2. Lis la FICHE VÉRITÉ DU CV. Elle est la seule source autorisée pour les faits du candidat. Chaque expérience y porte un "id" stable (ex: "exp-1") — c'est cet id que tu dois référencer, jamais un id inventé.

3. Génère une nouvelle version du CV structurée pour une mise en page A4 deux colonnes (sidebar gauche : Compétences / Langues / Formation / Centres d'intérêt — colonne principale droite : Accroche, Expérience, et optionnellement Projets). **Important : les deux colonnes doivent être à peu près équilibrées en hauteur.** La sidebar doit générer assez de contenu pour ne pas finir mi-page.
   - Titre adapté à l'offre
   - Accroche personnalisée (3 phrases, 50-65 mots) qui pose le profil, le parcours et la motivation pour l'offre
   - Expériences : couvre TOUTES les expériences significatives (voir définition ci-dessus) et pertinentes pour l'offre. Priorise et condense (1 à 3 bullets selon la place disponible, formulations plus courtes pour les entrées moins prioritaires) plutôt que de supprimer. Chaque bullet fait 12-20 mots avec verbe d'action + contexte factuel. **IMPORTANT** : pour les expériences, mets le NOM DE L'ENTREPRISE SOURCE dans le champ "company" (ex: "Acme Inc.", "BNP Paribas") et UNIQUEMENT le rôle/intitulé du poste source ou légèrement clarifié dans "heading" (ex: "Développeur Full-Stack"). Dans le subheading, garde les dates source et ajoute seulement un secteur/contexte si la fiche vérité le justifie. Renseigne aussi "sourceId" avec l'id exact de l'expérience source correspondante (ex: "exp-2") — jamais un id inventé, jamais vide pour un item d'expérience.
   - Formations (en sidebar) : **OBLIGATOIRE si la fiche vérité contient au moins une formation** — 3 à 4 entrées récentes/pertinentes, format compact : heading = intitulé court (ex: "Ingénieur Informatique"), subheading = "établissement · années". Si la place manque, réduis à 1-2 entrées plutôt que de supprimer toute la section.
   - Section "Projets" : **UNIQUEMENT si la fiche vérité contient des projets distincts des expériences** (champ "projects" non vide). Ne construis JAMAIS une section Projets en dupliquant ou reformulant le contenu d'une expérience — ce n'est pas un vrai projet source, c'est une invention structurelle. Si "projects" est vide, ne crée pas cette section, même pour remplir la page.
   - Compétences : **OBLIGATOIRE si la fiche vérité contient au moins une compétence** — 4 sous-sections regroupées par catégorie, 4-7 tags par sous-section, choisis parmi les compétences de la fiche vérité qui matchent l'offre. Si la place manque, réduis le nombre de tags ou de sous-catégories plutôt que de supprimer toute la section. Le nom de la sous-catégorie va dans "heading" (ex: "Front-end", "CMS & Contenus") — ne le répète jamais dans "tags" : les tags sont uniquement des technologies/compétences spécifiques nommées dans la fiche vérité, jamais le label de regroupement lui-même.
   - Ajout de mots-clés stratégiques issus de l'offre seulement quand ils sont factuellement justifiés par la fiche vérité
   - **Objectif : tout doit tenir sur UNE seule page A4 en layout 2 colonnes**, et remplir ~90 % de la page. Pour gagner de la place, réduis D'ABORD les bullets/tags/nombre d'items secondaires (Projets, Centres d'intérêt) — les sections Compétences et Formation ne doivent JAMAIS disparaître entièrement si la fiche vérité en contient. Si le nombre d'expériences significatives rend tout ça impossible même en condensant au maximum, privilégie quand même la couverture complète des expériences significatives plutôt qu'une omission silencieuse — mais condense d'abord agressivement avant d'envisager ce cas.
   - Pour la section "Centres d'intérêt", utilise UN SEUL item avec heading "Centres d'intérêt" et 3 bullets avec brève qualité associée (ex: "Taekwondo (ceinture noire) — rigueur, dépassement de soi") — JAMAIS plusieurs items distincts avec des headings orphelins
   - Pour la section "Langues", utilise UN SEUL item avec heading "Langues" et bullets très courts (ex: "Français — natif", "Anglais — B1") — pas de subheading
   - Règle générale pour TOUTES les sections : un item doit toujours avoir soit des bullets soit des tags. Ne jamais générer un item avec uniquement un heading (sauf formation : heading=intitulé + subheading=établissement/dates accepté sans bullets)

Retourne le résultat dans le format JSON spécifié :
- "cv" : objet structuré avec nom, titre, accroche, contact, et sections (chaque section a un titre et des items avec heading/subheading/bullets/tags)
- "modifications" : liste à puces des changements effectués par rapport au CV original (ce qui a été reformulé, mis en avant, réduit ou retiré). Pour toute expérience significative condensée ou omise, nomme-la explicitement (entreprise et/ou poste) avec une raison concrète (ex: "Expérience chez Acme Corp (2015, Vendeur) non retenue : trop ancienne et hors périmètre de l'offre"). Une justification vague ("CV condensé pour tenir sur une page") ne suffit pas. Ne prétends jamais avoir ajouté un fait.
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
- "sourceId" : POUR LES EXPÉRIENCES, l'id exact (ex: "exp-1") de l'expérience source correspondante dans la fiche vérité — jamais un id inventé, jamais vide. Pour les autres types d'items, chaîne vide ""
- "subheading" : informations secondaires (ex: "Sept. 2023 — Juin 2024 · Paris")
- "bullets" : descriptions/réalisations (pour expériences/projets/formations)
- "tags" : compétences techniques (pour la section Compétences)

Si un champ n'est pas pertinent pour un item, retourne une chaîne vide pour heading/subheading et un tableau vide pour bullets/tags.`;

const REPAIR_PROMPT = `${SYSTEM_PROMPT}

Tu reçois aussi une liste de violations détectées par un validateur serveur.
Corrige le CV pour supprimer toutes les violations.
Si une information demandée par l'offre n'est pas prouvée par la fiche vérité, ne l'ajoute pas : mets-la dans missingKeywords ou dans tips comme suggestion à valider.`;

const AUDIT_PROMPT = `Tu es un auditeur de fidélité de CV.

On te donne une fiche vérité de CV (avec un "id" stable par expérience), un CV généré à partir de cette fiche, la liste des changements annoncés ("modifications"), et deux listes de candidats suspects détectés par un pré-filtre automatique :
- des expériences source potentiellement omises du CV généré
- des bullets générés dont le recouvrement lexical avec le texte source est faible

${SIGNIFICANCE_DEFINITION}

Pour chaque candidat, décide s'il s'agit de :
- "none" : faux positif (reformulation légitime du même fait ; ou omission d'une expérience NON significative correctement et nommément justifiée dans "modifications"). Dans ce cas, NE RETOURNE AUCUNE entrée pour ce candidat.
- "ambiguous" : doute subjectif à signaler au candidat pour vérification, pas assez grave pour bloquer la génération.
- "strong" : invention ou exagération claire (responsabilité, périmètre ou impact non supporté par le texte source) ; OU omission d'une expérience SIGNIFICATIVE sans justification nommée valable dans "modifications" (une justification vague comme "CV condensé pour tenir sur une page" ne compte pas, même si l'omission était par ailleurs raisonnable).

Ne retourne que les violations réelles ("ambiguous" ou "strong") dans le tableau "violations". N'invente pas de candidat qui ne t'a pas été fourni.`;

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
                    sourceId: { type: "string" },
                    bullets: { type: "array", items: { type: "string" } },
                    tags: { type: "array", items: { type: "string" } },
                  },
                  required: [
                    "heading",
                    "subheading",
                    "company",
                    "sourceId",
                    "bullets",
                    "tags",
                  ],
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
          rawText: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          technologies: { type: "array", items: { type: "string" } },
        },
        required: [
          "role",
          "company",
          "dates",
          "location",
          "context",
          "rawText",
          "bullets",
          "technologies",
        ],
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

const auditSchema = {
  type: "object",
  properties: {
    violations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["ambiguous", "strong"] },
          message: { type: "string" },
          experienceId: { type: ["string", "null"] },
        },
        required: ["severity", "message", "experienceId"],
        additionalProperties: false,
      },
    },
  },
  required: ["violations"],
  additionalProperties: false,
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export type SourceExperience = {
  id: string;
  role: string;
  company: string;
  dates: string;
  location: string;
  context: string;
  rawText: string;
  bullets: string[];
  technologies: string[];
};

export type SourceFacts = {
  fullName: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  experiences: SourceExperience[];
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

/** Fiche vérité telle que renvoyée par le modèle, avant l'affectation des id stables côté serveur. */
type ExtractedSourceFacts = Omit<SourceFacts, "experiences"> & {
  experiences: Array<Omit<SourceExperience, "id">>;
};

/** Item de CV généré par le modèle, avec le sourceId interne utilisé pour la validation. */
export type GeneratedCVItem = CVItem & { sourceId: string };

type GeneratedCVSection = { title: string; items: GeneratedCVItem[] };

/** Réponse brute du modèle de génération, avant nettoyage des champs internes et ajout de reviewFlags. */
export type GeneratedOptimizeResponse = Omit<OptimizeResponse, "cv" | "reviewFlags"> & {
  cv: Omit<OptimizedCV, "sections"> & { sections: GeneratedCVSection[] };
};

export type SemanticViolation = {
  severity: "ambiguous" | "strong";
  message: string;
  experienceId: string | null;
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

  const extracted = parseMessageJson<ExtractedSourceFacts>(response as AnthropicTextResponse);

  // Les id sont générés côté serveur (jamais par le modèle) pour servir d'ancre stable et fiable.
  return {
    ...extracted,
    experiences: extracted.experiences.map((experience, index) => ({
      ...experience,
      id: `exp-${index + 1}`,
    })),
  };
}

async function generateOptimizedCV(
  client: Anthropic,
  sourceFacts: SourceFacts,
  offer: string,
  violations: string[] = []
): Promise<GeneratedOptimizeResponse> {
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

  return parseMessageJson<GeneratedOptimizeResponse>(response as AnthropicTextResponse);
}

async function auditSemanticFidelity(
  client: Anthropic,
  sourceFacts: SourceFacts,
  payload: GeneratedOptimizeResponse,
  omittedExperiences: SourceExperience[],
  lowOverlapBullets: LowFidelityBullet[]
): Promise<SemanticViolation[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: AUDIT_PROMPT,
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
              `=== CV GÉNÉRÉ ===`,
              JSON.stringify(payload.cv, null, 2),
              "",
              `=== MODIFICATIONS ANNONCÉES ===`,
              JSON.stringify(payload.modifications, null, 2),
              "",
              `=== CANDIDATS : EXPÉRIENCES POTENTIELLEMENT OMISES ===`,
              JSON.stringify(omittedExperiences, null, 2),
              "",
              `=== CANDIDATS : BULLETS À FAIBLE RECOUVREMENT LEXICAL ===`,
              JSON.stringify(lowOverlapBullets, null, 2),
            ].join("\n"),
          },
        ],
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: auditSchema },
    },
  });

  const result = parseMessageJson<{ violations: SemanticViolation[] }>(
    response as AnthropicTextResponse
  );
  return result.violations;
}

export function normalizeText(value: string): string {
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

export function looselyMatches(a: string, b: string): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return (
    (left.length >= 4 && right.includes(left)) ||
    (right.length >= 4 && left.includes(right))
  );
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

function isEducationSection(title: string): boolean {
  const normalized = normalizeText(title);
  return normalized.includes("formation") || normalized.includes("education") || normalized.includes("diplome");
}

function isProjectsSection(title: string): boolean {
  return normalizeText(title).includes("projet");
}

function isAllowedSkill(tag: string, sourceFacts: SourceFacts): boolean {
  const normalizedTag = normalizeText(tag);
  if (normalizedTag.length < 3) return true;

  const sourceText = normalizeText(JSON.stringify(sourceFacts));
  if (sourceText.includes(normalizedTag)) return true;

  const tokens = normalizedTag.split(" ").filter((token) => token.length >= 4);
  return tokens.length > 0 && tokens.every((token) => sourceText.includes(token));
}

export function getExperienceItems(payload: GeneratedOptimizeResponse): GeneratedCVItem[] {
  return payload.cv.sections
    .filter((section) => isExperienceSection(section.title))
    .flatMap((section) => section.items);
}

function validateContact(payload: GeneratedOptimizeResponse, sourceFacts: SourceFacts): string[] {
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

/**
 * Vérifie que chaque item d'expérience référence un sourceId réel de la fiche vérité.
 * Un sourceId manquant ou inconnu est une violation "strong" immédiate — jamais un
 * jugement d'audit, car c'est une incohérence factuelle certaine (expérience inventée
 * ou mal rattachée), pas une question d'interprétation.
 */
export function validateExperienceSourceIds(
  payload: GeneratedOptimizeResponse,
  sourceFacts: SourceFacts
): string[] {
  const violations: string[] = [];
  const experiencesById = new Map(sourceFacts.experiences.map((exp) => [exp.id, exp]));

  for (const item of getExperienceItems(payload)) {
    const sourceId = item.sourceId ?? "";

    if (!sourceId.trim()) {
      violations.push(`Expérience sans sourceId : "${item.heading}".`);
      continue;
    }

    const sourceExperience = experiencesById.get(sourceId);
    if (!sourceExperience) {
      violations.push(
        `sourceId inconnu : "${sourceId}" (expérience "${item.heading}") ne correspond à aucune expérience du CV source.`
      );
      continue;
    }

    // Vérification secondaire de cohérence : le sourceId est la source de vérité,
    // le nom d'entreprise affiché doit rester aligné avec l'expérience qu'il référence.
    const company = item.company ?? "";
    if (company.trim() && !looselyMatches(company, sourceExperience.company)) {
      violations.push(
        `Entreprise incohérente avec sourceId "${sourceId}" : "${company}" au lieu de "${sourceExperience.company}".`
      );
    }

    const sourceYears = new Set(extractYears(sourceExperience.dates));
    const generatedYears = extractYears(item.subheading);
    const unknownYears = generatedYears.filter((year) => !sourceYears.has(year));
    if (sourceYears.size > 0 && unknownYears.length > 0) {
      violations.push(
        `Dates contradictoires pour "${company || sourceExperience.company}" : année(s) ${unknownYears.join(", ")} absente(s) du CV source.`
      );
    }
  }

  return violations;
}

/**
 * Un tag qui reprend simplement le nom de sa propre sous-catégorie (ex: tag "CMS" dans
 * un item heading="CMS & Contenus") n'est pas une compétence inventée : c'est une
 * auto-référence redondante au label de regroupement que le modèle vient d'annoncer.
 * On ne valide que les tags qui apportent une information nouvelle.
 */
function tagMatchesOwnHeading(tag: string, heading: string): boolean {
  const normalizedTag = normalizeText(tag);
  const normalizedHeading = normalizeText(heading);
  if (normalizedTag.length < 2 || !normalizedHeading) return false;
  return normalizedHeading.includes(normalizedTag) || normalizedTag.includes(normalizedHeading);
}

function validateSkills(payload: GeneratedOptimizeResponse, sourceFacts: SourceFacts): string[] {
  const violations: string[] = [];
  const skillItems = payload.cv.sections
    .filter((section) => isSkillsSection(section.title))
    .flatMap((section) => section.items);

  for (const item of skillItems) {
    for (const tag of item.tags) {
      if (tagMatchesOwnHeading(tag, item.heading)) continue;
      if (!isAllowedSkill(tag, sourceFacts)) {
        violations.push(`Compétence non justifiée par le CV source : "${tag}".`);
      }
    }
  }

  return violations;
}

const DURATION_KEYWORDS = /\b(an|ans|ann[ée]e|ann[ée]es|year|years|yrs?)\b/i;

/**
 * Durées d'ancienneté (en années) légitimement déductibles par calcul des dates de la
 * fiche vérité — ex: expériences "2020-2022" et "2022-2023" justifient qu'un candidat se
 * décrive honnêtement comme ayant "3 ans d'expérience", même si "3" n'apparaît nulle
 * part littéralement dans la fiche vérité. Bornée aux seules durées calculables à partir
 * de vraies années source (pas une exemption générale pour un chiffre quelconque).
 */
function deriveExperienceDurationYears(sourceFacts: SourceFacts): Set<string> {
  const durations = new Set<number>();
  const allYears: number[] = [];

  for (const experience of sourceFacts.experiences) {
    const years = extractYears(experience.dates).map(Number);
    if (years.length === 0) continue;
    allYears.push(...years);
    const span = Math.max(...years) - Math.min(...years);
    durations.add(Math.max(span, 1));
    durations.add(span + 1); // comptage inclusif (ex: "2022 — 2023" peut se dire "2 ans")
  }

  if (allYears.length > 0) {
    const totalSpan = Math.max(...allYears) - Math.min(...allYears);
    durations.add(Math.max(totalSpan, 1));
    durations.add(totalSpan + 1);
  }

  return new Set(Array.from(durations, String));
}

function validateNumbers(payload: GeneratedOptimizeResponse, sourceFacts: SourceFacts): string[] {
  const violations: string[] = [];
  const sourceNumbers = new Set(extractNumbers(JSON.stringify(sourceFacts)));
  const derivedDurations = deriveExperienceDurationYears(sourceFacts);

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
      if (sourceNumbers.has(number)) continue;
      if (derivedDurations.has(number) && DURATION_KEYWORDS.test(text)) continue;
      violations.push(`Chiffre non présent dans le CV source : "${number}" dans "${text}".`);
    }
  }

  return violations;
}

/**
 * Vérifie que les sections dont la fiche vérité a du contenu existent bien dans le CV
 * généré. Contrairement aux expériences (où une omission peut être une priorisation
 * légitime), il n'y a pas de raison valable de faire disparaître entièrement la section
 * Compétences ou Formation quand la fiche vérité en contient : au pire on réduit le
 * nombre de tags/items, on ne supprime pas la section. Donc c'est directement une
 * violation "strong", sans passer par l'audit sémantique.
 */
export function validateRequiredSections(
  payload: GeneratedOptimizeResponse,
  sourceFacts: SourceFacts
): string[] {
  const violations: string[] = [];

  // Compétences : le contenu réel vit dans "tags" (jamais dans des bullets).
  const hasSkillsContent = payload.cv.sections.some(
    (section) => isSkillsSection(section.title) && section.items.some((item) => item.tags.length > 0)
  );

  // Formation : un item valide n'a souvent qu'un heading/subheading, sans bullets ni
  // tags (règle déjà acceptée ailleurs dans le prompt) — la présence de l'item suffit.
  const hasEducationContent = payload.cv.sections.some(
    (section) => isEducationSection(section.title) && section.items.some((item) => item.heading.trim().length > 0)
  );

  if (sourceFacts.skills.length > 0 && !hasSkillsContent) {
    violations.push(
      "Section Compétences manquante ou vide alors que la fiche vérité liste des compétences."
    );
  }

  if (sourceFacts.education.length > 0 && !hasEducationContent) {
    violations.push(
      "Section Formation manquante ou vide alors que la fiche vérité liste des formations."
    );
  }

  return violations;
}

/**
 * Une section "Projets" ne doit exister que si la fiche vérité contient réellement des
 * projets distincts. Sans ancre de provenance (pas de sourceId comme pour les
 * expériences), le risque concret est qu'un modèle "fabrique" des projets en dupliquant
 * le contenu des expériences — repéré en pratique (voir modifications d'une génération :
 * "Section Projets ajoutée à partir des expériences"). C'est une violation "strong" :
 * ce n'est pas un jugement de pertinence, c'est une section qui ne devrait pas exister.
 */
export function validateProjectsProvenance(
  payload: GeneratedOptimizeResponse,
  sourceFacts: SourceFacts
): string[] {
  const hasProjectsSection = payload.cv.sections.some(
    (section) => isProjectsSection(section.title) && section.items.length > 0
  );

  if (hasProjectsSection && sourceFacts.projects.length === 0) {
    return [
      "Section Projets présente alors que la fiche vérité ne contient aucun projet source (probable fabrication à partir des expériences).",
    ];
  }

  return [];
}

/** Violations factuelles "dures" : jamais soumises à interprétation, toujours bloquantes. */
export function validateOptimizedCV(
  payload: GeneratedOptimizeResponse,
  sourceFacts: SourceFacts
): string[] {
  return [
    ...validateContact(payload, sourceFacts),
    ...validateExperienceSourceIds(payload, sourceFacts),
    ...validateRequiredSections(payload, sourceFacts),
    ...validateProjectsProvenance(payload, sourceFacts),
    ...validateSkills(payload, sourceFacts),
    ...validateNumbers(payload, sourceFacts),
  ];
}

/**
 * Pré-filtre de complétude : expériences de la fiche vérité dont l'id n'est référencé
 * par aucun sourceId du CV généré. Liste de CANDIDATS uniquement — jamais une violation
 * directe (une omission peut être légitime et justifiée).
 */
export function findOmittedExperiences(
  payload: GeneratedOptimizeResponse,
  sourceFacts: SourceFacts
): SourceExperience[] {
  const referencedIds = new Set(
    getExperienceItems(payload)
      .map((item) => item.sourceId)
      .filter((id): id is string => Boolean(id && id.trim()))
  );
  return sourceFacts.experiences.filter((experience) => !referencedIds.has(experience.id));
}

export type LowFidelityBullet = { experienceId: string; bullet: string };

const MIN_SOURCE_TOKENS_FOR_FIDELITY_CHECK = 3;
const MIN_OVERLAP_RATIO = 1 / 3;

/**
 * Pré-filtre de fidélité : bullets générés dont le recouvrement lexical avec le rawText
 * source est faible. Liste de CANDIDATS uniquement — jamais une violation directe (une
 * reformulation légitime peut avoir un faible recouvrement lexical). Si l'expérience
 * source n'a pas assez de texte exploitable (rawText/context/bullets vides ou trop
 * courts), on ne peut rien juger lexicalement : on n'émet aucun candidat pour elle
 * plutôt que de tout flaguer à tort.
 */
export function findLowFidelityBullets(
  payload: GeneratedOptimizeResponse,
  sourceFacts: SourceFacts
): LowFidelityBullet[] {
  const experiencesById = new Map(sourceFacts.experiences.map((exp) => [exp.id, exp]));
  const candidates: LowFidelityBullet[] = [];

  for (const item of getExperienceItems(payload)) {
    const sourceExperience = experiencesById.get(item.sourceId);
    if (!sourceExperience) continue; // sourceId invalide : déjà couvert par validateExperienceSourceIds

    const sourceText = normalizeText(
      [sourceExperience.rawText, sourceExperience.context, ...sourceExperience.bullets].join(" ")
    );
    const sourceTokens = new Set(sourceText.split(" ").filter((token) => token.length >= 4));

    if (sourceTokens.size < MIN_SOURCE_TOKENS_FOR_FIDELITY_CHECK) continue;

    for (const bullet of item.bullets) {
      const bulletTokens = normalizeText(bullet)
        .split(" ")
        .filter((token) => token.length >= 4);
      if (bulletTokens.length === 0) continue;

      const matched = bulletTokens.filter((token) => sourceTokens.has(token)).length;
      const overlapRatio = matched / bulletTokens.length;

      if (overlapRatio < MIN_OVERLAP_RATIO) {
        candidates.push({ experienceId: sourceExperience.id, bullet });
      }
    }
  }

  return candidates;
}

/** Retire les champs internes (sourceId) avant de renvoyer le CV au client. */
export function stripInternalFields(payload: GeneratedOptimizeResponse): Omit<OptimizeResponse, "reviewFlags"> {
  return {
    ...payload,
    cv: {
      ...payload.cv,
      sections: payload.cv.sections.map((section) => ({
        ...section,
        items: section.items.map(({ sourceId: _sourceId, ...item }) => item),
      })),
    },
  };
}

type FidelityCheckResult = { strongViolations: string[]; ambiguousNotes: string[] };

/**
 * Fusionne les violations heuristiques "dures" (toujours strong) avec l'audit sémantique
 * conditionnel (§2/§3 de la spec) : l'audit n'est appelé que si le pré-filtre a produit
 * des candidats, pour ne pas ajouter de coût/latence au cas propre.
 */
export async function checkFidelity(
  client: Anthropic,
  payload: GeneratedOptimizeResponse,
  sourceFacts: SourceFacts
): Promise<FidelityCheckResult> {
  const heuristicViolations = validateOptimizedCV(payload, sourceFacts);
  const omittedExperiences = findOmittedExperiences(payload, sourceFacts);
  const lowOverlapBullets = findLowFidelityBullets(payload, sourceFacts);

  if (omittedExperiences.length === 0 && lowOverlapBullets.length === 0) {
    return { strongViolations: heuristicViolations, ambiguousNotes: [] };
  }

  const semanticViolations = await auditSemanticFidelity(
    client,
    sourceFacts,
    payload,
    omittedExperiences,
    lowOverlapBullets
  );

  const semanticStrong = semanticViolations
    .filter((v) => v.severity === "strong")
    .map((v) => v.message);
  const ambiguousNotes = semanticViolations
    .filter((v) => v.severity === "ambiguous")
    .map((v) => v.message);

  return {
    strongViolations: [...heuristicViolations, ...semanticStrong],
    ambiguousNotes,
  };
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
    console.log(
      "[api/optimize] source counts:",
      JSON.stringify({
        experiences: sourceFacts.experiences.length,
        education: sourceFacts.education.length,
        projects: sourceFacts.projects.length,
        skills: sourceFacts.skills.length,
        languages: sourceFacts.languages.length,
        interests: sourceFacts.interests.length,
      })
    );
    let parsed = await generateOptimizedCV(client, sourceFacts, offerText);
    console.log(
      "[api/optimize] generated sections:",
      JSON.stringify(parsed.cv.sections.map((s) => ({ title: s.title, items: s.items.length })))
    );
    let { strongViolations, ambiguousNotes } = await checkFidelity(client, parsed, sourceFacts);

    if (strongViolations.length > 0) {
      parsed = await generateOptimizedCV(client, sourceFacts, offerText, strongViolations);
      ({ strongViolations, ambiguousNotes } = await checkFidelity(client, parsed, sourceFacts));
    }

    if (strongViolations.length > 0) {
      return NextResponse.json(
        {
          error:
            "La génération a été bloquée car elle modifiait ou occultait des faits du CV source. Réessaie avec un PDF plus lisible ou ajuste le CV source.",
          details: strongViolations.slice(0, 8),
        },
        { status: 422 }
      );
    }

    const cleaned = stripInternalFields(parsed);
    const finalResponse: OptimizeResponse = {
      ...cleaned,
      modifications: [
        ...cleaned.modifications,
        "Audit anti-invention validé : coordonnées, localisation, entreprises, dates, compétences, chiffres et complétude des expériences contrôlés par rapport au CV source.",
      ],
      reviewFlags: ambiguousNotes,
    };

    if (gate.isAuthenticated && !gate.isAdmin) {
      await deductCredit(gate.userId);
    }

    const res = NextResponse.json(finalResponse);
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
