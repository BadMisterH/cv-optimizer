import { NextResponse } from "next/server";
import type { OptimizedCV } from "@/app/types";
import { launchBrowser } from "@/lib/browser";
import { buildHtml, type Template } from "@/lib/cv-html";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    const body = await req.json();
    const cv = body?.cv as OptimizedCV | undefined;
    const photoDataUrl =
      typeof body?.photo === "string" && body.photo.startsWith("data:")
        ? (body.photo as string)
        : undefined;
    if (!cv?.fullName) {
      return NextResponse.json({ error: "CV invalide" }, { status: 400 });
    }

    const accentColor =
      typeof body?.accentColor === "string" ? body.accentColor : undefined;
    const template =
      typeof body?.template === "string" &&
      ["classic", "sidebar-left", "sidebar-right", "single"].includes(body.template)
        ? (body.template as Template)
        : "classic";

    const html = buildHtml(cv, photoDataUrl, accentColor, template);

    browser = await launchBrowser();
    const page = await browser.newPage();

    // A4 portrait viewport at 96dpi : 794 × 1123 px
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Mesure la hauteur réelle du contenu rendu
    const contentHeight = await page.evaluate(() => {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
    });

    // A4 portrait au 96dpi avec marges 14mm : surface utile ≈ 1017 px de haut
    const A4_USABLE_HEIGHT_PX = 1017;
    const naturalScale = A4_USABLE_HEIGHT_PX / contentHeight;
    // Plancher 0.55 pour forcer une seule page même sur CV long (texte ≈ 6pt mini).
    // Plafond 1.15 pour étirer si contenu court et bien remplir l'A4.
    const finalScale = Math.max(0.55, Math.min(1.15, naturalScale));

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: false,
      omitBackground: true,
      scale: finalScale,
      preferCSSPageSize: true,
      margin: {
        top: "14mm",
        right: "14mm",
        bottom: "14mm",
        left: "14mm",
      },
    });

    const fileName = `CV-${cv.fullName.replace(/\s+/g, "-") || "optimise"}.pdf`;

    return new Response(new Uint8Array(pdfBytes), {
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
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn("[api/pdf] browser.close() failed:", closeErr);
      }
    }
  }
}
