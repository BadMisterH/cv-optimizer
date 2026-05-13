import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  ANON_COOKIE_MAX_AGE,
  checkUsageGate,
  deductCredit,
} from "@/lib/usage-gate";

const SYSTEM_PROMPT = `Tu es un expert en recrutement et en optimisation de CV.

Ta mission est d'adapter un CV existant (fourni en PDF) pour qu'il corresponde parfaitement à une offre de stage donnée.

Objectif :
- Maximiser la pertinence du CV pour cette offre spécifique
- Mettre en avant les compétences et expériences les plus alignées
- Reformuler certains éléments pour correspondre aux mots-clés de l'offre (sans mentir)
- Supprimer ou réduire les éléments peu pertinents
- Ajouter des formulations professionnelles et impactantes

Contraintes importantes :
- Ne jamais inventer d'expérience ou de compétence
- Rester fidèle au parcours initial extrait du PDF
- Adapter le ton pour un recruteur (clair, professionnel, impact direct)
- Optimiser pour les ATS (mots-clés présents dans l'offre)

Méthodologie :
1. Analyse l'offre de stage et identifie :
   - Les compétences clés demandées
   - Les mots-clés importants
   - Le type de profil recherché

2. Lis et analyse le CV PDF fourni en pièce jointe

3. Génère une nouvelle version du CV structurée pour une mise en page A4 deux colonnes (sidebar gauche : Compétences / Langues / Formation / Centres d'intérêt — colonne principale droite : Accroche, Expérience, et optionnellement Projets). **Important : les deux colonnes doivent être à peu près équilibrées en hauteur.** La sidebar doit générer assez de contenu pour ne pas finir mi-page.
   - Titre adapté à l'offre
   - Accroche personnalisée (3 phrases, 50-65 mots) qui pose le profil, le parcours et la motivation pour l'offre
   - Expériences : 3 expériences les plus pertinentes, **3 bullets par poste**, chaque bullet de 14-20 mots avec verbe d'action + contexte + impact concret. Dans le subheading, ajoute le secteur/contexte (ex: "2023 — 2024 · E-commerce")
   - Formations (en sidebar) : 3 à 4 entrées récentes/pertinentes, format compact : heading = intitulé court (ex: "Ingénieur Informatique"), subheading = "établissement · années"
   - **Section "Projets" recommandée** dans la colonne principale si le CV original mentionne des réalisations (2 items, heading=nom du projet, subheading=stack/contexte, 1 bullet par projet décrivant l'enjeu)
   - Compétences : **4 sous-sections regroupées par catégorie**, 5-7 tags par sous-section, choisis pour matcher l'offre. Couvre largement : relation/commerce, qualités personnelles, outils techniques, et une 4e catégorie pertinente (ex: communication, méthodologie, langues techniques selon le profil)
   - Ajout de mots-clés stratégiques issus de l'offre
   - **CRITIQUE : tout doit tenir sur UNE seule page A4 en layout 2 colonnes**, mais doit aussi remplir ~90 % de la page. Pas de page 2, pas de page à moitié vide.
   - Pour la section "Centres d'intérêt", utilise UN SEUL item avec heading "Centres d'intérêt" et 3 bullets avec brève qualité associée (ex: "Taekwondo (ceinture noire) — rigueur, dépassement de soi") — JAMAIS plusieurs items distincts avec des headings orphelins
   - Pour la section "Langues", utilise UN SEUL item avec heading "Langues" et bullets très courts (ex: "Français — natif", "Anglais — B1") — pas de subheading
   - Règle générale pour TOUTES les sections : un item doit toujours avoir soit des bullets soit des tags. Ne jamais générer un item avec uniquement un heading (sauf formation : heading=intitulé + subheading=établissement/dates accepté sans bullets)

Retourne le résultat dans le format JSON spécifié :
- "cv" : objet structuré avec nom, titre, accroche, contact, et sections (chaque section a un titre et des items avec heading/subheading/bullets/tags)
- "modifications" : liste à puces des changements effectués par rapport au CV original (ce qui a été reformulé, ajouté, mis en avant, retiré)

Pour les sections du CV, utilise typiquement : "Expérience", "Formation", "Compétences", "Projets", "Langues", "Centres d'intérêt" selon ce qui est présent dans le CV original. Ne crée jamais de section qui n'existe pas dans le CV source.

Pour chaque item :
- "heading" : titre principal (ex: "Développeur Full-Stack — Acme Inc." ou "Master en Informatique")
- "subheading" : informations secondaires (ex: "Sept. 2023 — Juin 2024 · Paris")
- "bullets" : descriptions/réalisations (pour expériences/projets/formations)
- "tags" : compétences techniques (pour la section Compétences)

Si un champ n'est pas pertinent pour un item, retourne une chaîne vide pour heading/subheading et un tableau vide pour bullets/tags.`;

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
                    bullets: { type: "array", items: { type: "string" } },
                    tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["heading", "subheading", "bullets", "tags"],
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
  },
  required: ["cv", "modifications"],
  additionalProperties: false,
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const gate = await checkUsageGate(req, "cv");
    if (!gate.allowed) {
      const error =
        gate.reason === "no_credits"
          ? "Tu n'as plus de crédits. Achète un pack pour continuer."
          : "Tu as déjà utilisé ton essai gratuit. Crée un compte pour continuer.";
      return NextResponse.json(
        { error, redirect: gate.redirect },
        { status: 401 }
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
        { error: "L'offre de stage est requise." },
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

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
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
              text: `=== OFFRE DE STAGE ===\n${offer}`,
            },
          ],
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: cvSchema },
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
        { error: `Erreur API Claude (${err.status}): ${err.message}` },
        { status: err.status ?? 500 }
      );
    }
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
