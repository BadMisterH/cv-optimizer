import { NextResponse } from "next/server";
import type { OptimizedCV } from "@/app/types";
import { renderCVToBuffer, type Template } from "@/lib/cv-pdf";
import { countPdfPages } from "@/lib/pdf-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TEMPLATES: Template[] = ["classic", "single"];
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

    // Ne jamais expédier silencieusement un PDF qui dépasse 1 page même à densité
    // maximale : le candidat croirait avoir un CV conforme au format annoncé.
    if (finalPages > 1) {
      return NextResponse.json(
        {
          error:
            "Le CV dépasse une page même à la densité maximale. Réduis le contenu (bullets, nombre d'expériences) avant de générer le PDF.",
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
