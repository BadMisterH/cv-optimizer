import { NextResponse } from "next/server";
import type { OptimizedCV } from "@/app/types";
import { renderCVToBuffer, type Template } from "@/lib/cv-pdf";
import { countPdfPages } from "@/lib/pdf-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TEMPLATES: Template[] = ["classic", "single", "ats"];
const MAX_DENSITY = 4;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cv = body?.cv as OptimizedCV | undefined;
    if (!cv?.fullName) {
      return NextResponse.json({ error: "CV invalide" }, { status: 400 });
    }

    const photoDataUrl =
      typeof body?.photo === "string" && body.photo.startsWith("data:")
        ? (body.photo as string)
        : undefined;

    const accentColor =
      typeof body?.accentColor === "string" ? body.accentColor : "#1f4bff";

    const template: Template = VALID_TEMPLATES.includes(body?.template)
      ? (body.template as Template)
      : "classic";

    // Filet de secours explicite : le candidat a déjà vu l'avertissement "trop long"
    // et choisit sciemment de télécharger quand même un PDF imparfait plutôt que de
    // rester bloqué sans aucune issue.
    const allowOverflow = body?.allowOverflow === true;

    // Boucle densité : cherche la densité minimale qui tient sur 1 page A4
    let finalBuf: Buffer | null = null;
    let finalPages = 0;
    let usedDensity = 0;

    for (let d = 0; d <= MAX_DENSITY; d++) {
      const buf = await renderCVToBuffer(cv, {
        photo: photoDataUrl,
        accentColor,
        template,
        density: d,
      });

      const pages = countPdfPages(buf);
      console.log(`[api/pdf] density=${d}, pages=${pages}`);

      finalBuf = buf;
      finalPages = pages;
      usedDensity = d;

      if (pages <= 1) break;
    }

    if (!finalBuf) {
      return NextResponse.json({ error: "Échec de génération PDF" }, { status: 500 });
    }

    console.log(`[api/pdf] final: density=${usedDensity}, pages=${finalPages}`);

    // 1 page = idéal, 2 pages = fallback accepté (contenu légitime qui ne tient pas en
    // 1 colonne même condensé au maximum). Au-delà, ce n'est plus un CV optimisé — on ne
    // l'expédie JAMAIS silencieusement (sans allowOverflow explicite). Pas de réparation
    // IA ici : cette route est un renderer pur sans accès au modèle, la condensation de
    // contenu est décidée par /api/optimize, pas ici.
    if (finalPages >= 3 && !allowOverflow) {
      return NextResponse.json(
        {
          error:
            "Ce CV est trop long pour être exporté proprement (3 pages ou plus même à densité maximale). Retire des bullets ou des expériences moins prioritaires dans l'éditeur, ou télécharge-le quand même en connaissance de cause.",
          tooLong: true,
        },
        { status: 422 }
      );
    }

    const fileName = `CV-${cv.fullName.replace(/\s+/g, "-") || "optimise"}.pdf`;

    return new Response(new Uint8Array(finalBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/pdf] generation failed:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
