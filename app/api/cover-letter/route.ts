import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { OptimizedCV } from "@/app/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Tu es un expert en rédaction de lettres de motivation pour le marché français.

Ta mission est de produire une lettre de motivation puissante, personnalisée et professionnelle qui aligne le profil du candidat à l'offre visée.

Principes de rédaction :
- Ton professionnel, direct, sans clichés ni phrases creuses
- Structure classique française : accroche → adéquation profil/poste → motivation → conclusion
- Référence à des expériences ou compétences précises tirées du CV (ne jamais inventer)
- Reprise des mots-clés et enjeux de l'offre, sans paraphraser bêtement
- Concis : 3 à 4 paragraphes, pas plus de 350 mots au total dans le corps de lettre
- Première personne, ton respectueux mais affirmé

Structure attendue dans le JSON :
- "fullName" : nom complet du candidat
- "contact" : email, phone, location, linkedin, github, portfolio (reprise du CV)
- "recipient" : { company, role, department, address } — déduits de l'offre. Si une information n'est pas trouvée, mets une chaîne vide.
- "city" : ville d'envoi (utiliser la ville du candidat si trouvée, sinon "")
- "date" : au format français long (ex: "7 mai 2026")
- "subject" : ligne d'objet (ex: "Candidature pour le poste de [role]")
- "salutation" : formule d'ouverture, par défaut "Madame, Monsieur," ou avec nom si trouvé dans l'offre
- "paragraphs" : tableau de 3 à 4 paragraphes du corps de lettre
  - Paragraphe 1 (accroche) : pourquoi cette entreprise / ce poste précis, lien avec ton parcours
  - Paragraphe 2 (adéquation) : compétences clés et expériences pertinentes du CV qui répondent à l'offre
  - Paragraphe 3 (motivation/projet) : ce que tu vas apporter, vision du poste, valeurs partagées
  - Paragraphe 4 (optionnel, conclusion ouverte) : disponibilité, demande d'entretien
- "closing" : formule de politesse française classique (ex: "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.")
- "signature" : nom complet du candidat (sera signé en bas de lettre)

Retourne aussi "notes" : 3-5 puces expliquant tes choix éditoriaux (quels éléments du CV tu as mis en avant, quels mots-clés de l'offre tu as repris, le ton choisi).`;

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
    const contentType = req.headers.get("content-type") ?? "";

    let cvAsText: string | null = null;
    let cvPdfBase64: string | null = null;
    let offer: string | null = null;

    if (contentType.includes("application/json")) {
      // Mode "CV optimisé" : on envoie le JSON OptimizedCV + offre
      const body = await req.json();
      const cv = body?.cv as OptimizedCV | undefined;
      offer = body?.offer ?? null;
      if (!cv?.fullName) {
        return NextResponse.json({ error: "CV invalide" }, { status: 400 });
      }
      cvAsText = JSON.stringify(cv, null, 2);
    } else {
      // Mode "PDF brut" : multipart avec fichier
      const formData = await req.formData();
      const cvEntry = formData.get("cv");
      const offerEntry = formData.get("offer");
      if (!(cvEntry instanceof File) || cvEntry.size === 0) {
        return NextResponse.json({ error: "CV (PDF) requis." }, { status: 400 });
      }
      if (cvEntry.type !== "application/pdf") {
        return NextResponse.json({ error: "Le CV doit être un PDF." }, { status: 400 });
      }
      if (cvEntry.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "Le PDF dépasse 25 Mo." }, { status: 400 });
      }
      offer = typeof offerEntry === "string" ? offerEntry : null;
      cvPdfBase64 = Buffer.from(await cvEntry.arrayBuffer()).toString("base64");
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

    if (cvPdfBase64) {
      userContent.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: cvPdfBase64,
        },
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
    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Erreur API Claude (${err.status}): ${err.message}` },
        { status: err.status ?? 500 }
      );
    }
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
