import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { OptimizedCV } from "@/app/types";
import { alertAnthropicApiError } from "@/lib/alerting";
import { checkUsageGate, deductCredit } from "@/lib/usage-gate";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Tu es un rédacteur de lettres de motivation pour le marché français. Tu écris des lettres qui sonnent humaines, jamais corporate ni générique.

OBJECTIF : produire une lettre qui donne envie de rencontrer le candidat, en s'appuyant sur des éléments concrets du CV et de l'offre.

== RÈGLES D'ÉCRITURE (non négociables) ==

1. TON HUMAIN ET NATUREL
- Écris comme un candidat sincère qui veut vraiment ce poste, pas comme une IA polie.
- Phrases courtes et variées (en moyenne 12 à 22 mots), alterne phrases simples et composées.
- Concret toujours préféré à l'abstrait. Exemple : "j'ai mené 3 audits clients en stage" est meilleur que "j'ai développé mes compétences en relation client".
- Bannis les formules-types et clichés : "fort de mon expérience", "passionné par votre secteur", "représente une opportunité unique", "j'ai à cœur de", "vivement intéressé", "votre dynamisme", "challenge", "synergie", "écosystème", "leverage", "saisir l'opportunité", "rejoindre vos équipes".
- Pas d'auto-flagornerie ("très motivé", "extrêmement rigoureux", "force de proposition"). Montre-le par les faits.

2. INTERDICTION ABSOLUE DES TIRETS DU MILIEU
- Aucun caractère "—" (tiret cadratin / em dash).
- Aucun caractère "–" (tiret demi-cadratin / en dash).
- Aucun caractère "−" (signe moins typographique).
- Le tiret simple "-" est seulement toléré dans les mots composés (ex: "porte-parole"). Jamais comme ponctuation.
- Pour séparer une idée : utilise virgule, point, ou parenthèses.
- INTERDIT : "ma formation — sérieuse — m'a appris..."
- OK : "ma formation, sérieuse et exigeante, m'a appris..."

3. PERSONNALISATION FORTE
- Cite au moins UN élément précis et nommé tiré du CV (un projet, une mission, un chiffre, une techno, un secteur).
- Cite au moins UN élément précis de l'offre (une mission, un produit, une valeur affichée par l'entreprise, un défi cité).
- Le lien entre ces deux éléments doit être explicite, pas implicite.

4. STRUCTURE
- 3 ou 4 paragraphes, 280 à 340 mots au total dans le corps (paragraphs).
- § 1 (40-60 mots) : pourquoi cette boîte, ce poste. Angle personnel, pas générique.
- § 2 (90-120 mots) : 1 ou 2 expériences pertinentes du CV, avec verbes d'action et résultats concrets si possible.
- § 3 (60-90 mots) : ce que tu vas apporter au poste. Concret, pas des mots creux.
- § 4 optionnel (30-50 mots) : disponibilité, demande d'entretien.

5. VOCABULAIRE
- Verbes d'action : conçu, piloté, lancé, débogué, présenté, négocié, recruté, animé, structuré, déployé.
- "Je" plutôt que "j'aimerais" ou "j'aurais" (on n'est pas dans le conditionnel poli mou).

== CHAMPS JSON ATTENDUS ==

- "fullName" : nom complet du candidat (depuis le CV).
- "contact" : email, phone, location, linkedin, github, portfolio (depuis le CV).
- "recipient" : { company, role, department, address } déduits de l'offre. Si l'information n'est pas trouvée, chaîne vide.
- "city" : ville d'envoi (ville du candidat si trouvée, sinon "").
- "date" : au format français long (ex: "9 mai 2026"). Utilise la date d'envoi fournie.
- "subject" : ligne d'objet courte (ex: "Candidature au poste de Développeur Full-Stack").
- "salutation" : "Madame, Monsieur," par défaut, ou avec nom si trouvé dans l'offre.
- "paragraphs" : tableau de 3 ou 4 chaînes (les paragraphes du corps).
- "closing" : formule de politesse française classique (ex: "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.").
- "signature" : nom complet du candidat.

Retourne aussi "notes" : 3 à 5 puces concrètes expliquant tes choix éditoriaux (quel élément CV mis en avant, quel mot-clé offre repris, ton choisi). Pas de meta-blabla, juste des faits.

== ANCIENNE LETTRE DE MOTIVATION (si fournie) ==
Si un document intitulé "Ancienne lettre de motivation" est présent, utilise-le UNIQUEMENT pour calibrer le style du candidat :
- Longueur typique de ses phrases et de ses paragraphes
- Registre (soutenu, direct, sobre…) et niveau de formalité
- Vocabulaire naturel, tournures qui lui sont propres
Ne reprends jamais le contenu factuel de cette ancienne lettre (missions, entreprises, formules déjà utilisées). Réécris tout de zéro. Si une ancienne lettre est fournie, mentionne-le dans les notes.`;

const letterSchema = {
  type: "object",
  properties: {
    letter: {
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
        recipient: {
          type: "object",
          properties: {
            company: { type: "string" },
            role: { type: "string" },
            department: { type: "string" },
            address: { type: "string" },
          },
          required: ["company", "role", "department", "address"],
          additionalProperties: false,
        },
        city: { type: "string" },
        date: { type: "string" },
        subject: { type: "string" },
        salutation: { type: "string" },
        paragraphs: { type: "array", items: { type: "string" } },
        closing: { type: "string" },
        signature: { type: "string" },
      },
      required: [
        "fullName",
        "contact",
        "recipient",
        "city",
        "date",
        "subject",
        "salutation",
        "paragraphs",
        "closing",
        "signature",
      ],
      additionalProperties: false,
    },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["letter", "notes"],
  additionalProperties: false,
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;

// Filet de sécurité : enlève les tirets cadratins/demi-cadratins
// au cas où le modèle en glisse malgré la consigne.
function stripDashes(s: string): string {
  return s
    .replace(/\s*[—–−]\s*/g, ", ")
    .replace(/\s*,\s*,\s*/g, ", ")
    .replace(/\s*,\s*\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDashesFromLetter<T extends Record<string, unknown>>(letter: T): T {
  const out = { ...letter } as Record<string, unknown>;
  for (const k of ["subject", "salutation", "closing"] as const) {
    const v = out[k];
    if (typeof v === "string") out[k] = stripDashes(v);
  }
  if (Array.isArray(out.paragraphs)) {
    out.paragraphs = (out.paragraphs as unknown[]).map((p) =>
      typeof p === "string" ? stripDashes(p) : p
    );
  }
  return out as T;
}

function todayInFrench(): string {
  const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export async function POST(req: Request) {
  try {
    const gate = await checkUsageGate(req, { requireAuth: true, anonRedirectPath: "/lettre" });
    if (!gate.allowed) {
      const error =
        gate.reason === "email_unverified"
          ? "Vérifie ton adresse email avant d'utiliser tes crédits."
          : gate.reason === "no_credits"
          ? "Tu n'as plus de crédits. Achète un pack pour continuer."
          : "Crée un compte gratuit pour générer une lettre de motivation.";
      const status = gate.reason === "email_unverified" ? 403 : 401;
      return NextResponse.json(
        { error, redirect: gate.redirect },
        { status }
      );
    }

    const contentType = req.headers.get("content-type") ?? "";

    let cvAsText: string | null = null;
    let cvPdfBase64: string | null = null;
    let prevLetterBase64: string | null = null;
    let offer: string | null = null;

    if (contentType.includes("application/json")) {
      // Mode "CV optimisé sans ancienne lettre" : JSON OptimizedCV + offre
      const body = await req.json();
      const cv = body?.cv as OptimizedCV | undefined;
      offer = body?.offer ?? null;
      if (!cv?.fullName) {
        return NextResponse.json({ error: "CV invalide" }, { status: 400 });
      }
      cvAsText = JSON.stringify(cv, null, 2);
    } else {
      // Mode FormData : CV (PDF ou JSON stringifié) + offre + ancienne lettre optionnelle
      const formData = await req.formData();
      const cvEntry = formData.get("cv");
      const cvJsonEntry = formData.get("cvJson"); // CV stocké sérialisé quand prevLetter est fourni
      const offerEntry = formData.get("offer");
      const prevLetterEntry = formData.get("prevLetter");

      if (cvJsonEntry && typeof cvJsonEntry === "string") {
        // CV stocké envoyé via FormData (cas: source=stored + prevLetter)
        try {
          const cv = JSON.parse(cvJsonEntry) as OptimizedCV;
          if (!cv?.fullName) throw new Error("invalid");
          cvAsText = JSON.stringify(cv, null, 2);
        } catch {
          return NextResponse.json({ error: "CV invalide." }, { status: 400 });
        }
      } else {
        // CV PDF brut
        if (!(cvEntry instanceof File) || cvEntry.size === 0) {
          return NextResponse.json({ error: "CV (PDF) requis." }, { status: 400 });
        }
        if (cvEntry.type !== "application/pdf") {
          return NextResponse.json({ error: "Le CV doit être un PDF." }, { status: 400 });
        }
        if (cvEntry.size > MAX_PDF_BYTES) {
          return NextResponse.json({ error: "Le PDF dépasse 25 Mo." }, { status: 400 });
        }
        cvPdfBase64 = Buffer.from(await cvEntry.arrayBuffer()).toString("base64");
      }

      offer = typeof offerEntry === "string" ? offerEntry : null;

      // Ancienne lettre optionnelle (max 5 Mo)
      if (prevLetterEntry instanceof File && prevLetterEntry.size > 0) {
        if (prevLetterEntry.type !== "application/pdf") {
          return NextResponse.json({ error: "L'ancienne lettre doit être un PDF." }, { status: 400 });
        }
        if (prevLetterEntry.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: "L'ancienne lettre dépasse 5 Mo." }, { status: 400 });
        }
        prevLetterBase64 = Buffer.from(await prevLetterEntry.arrayBuffer()).toString("base64");
      }
    }

    if (!offer || !offer.trim()) {
      return NextResponse.json(
        { error: "L'offre est requise." },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY n'est pas configurée." },
        { status: 500 }
      );
    }

    const today = todayInFrench();

    const userContent: Anthropic.Messages.ContentBlockParam[] = [];

    // Ancienne lettre en tête de contexte (calibration de style)
    if (prevLetterBase64) {
      userContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: prevLetterBase64 },
        title: "Ancienne lettre de motivation",
      } as Anthropic.Messages.ContentBlockParam);
    }

    if (cvPdfBase64) {
      userContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: cvPdfBase64 },
      });
      userContent.push({
        type: "text",
        text: `=== OFFRE ===\n${offer}\n\n=== DATE D'ENVOI ===\n${today}`,
      });
    } else {
      userContent.push({
        type: "text",
        text: `=== CV (JSON structuré, déjà optimisé pour cette offre) ===\n${cvAsText}\n\n=== OFFRE ===\n${offer}\n\n=== DATE D'ENVOI ===\n${today}`,
      });
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
      output_config: {
        format: { type: "json_schema", schema: letterSchema },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Pas de réponse texte du modèle." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(textBlock.text);
    if (parsed?.letter) {
      parsed.letter = stripDashesFromLetter(parsed.letter);
    }

    if (gate.isAuthenticated && !gate.isAdmin) {
      await deductCredit(gate.userId);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      await alertAnthropicApiError(err.status ?? 0, err.message, "/api/cover-letter");
      return NextResponse.json(
        { error: `Erreur API IA (${err.status}): ${err.message}` },
        { status: err.status ?? 500 }
      );
    }
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
