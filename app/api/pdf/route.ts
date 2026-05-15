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

    // Stratégie single-page : on essaie d'abord les densités CSS croissantes
    // (préserve la qualité typographique). Si même à density-4 ça déborde,
    // on applique le scale Puppeteer en dernier recours.
    const A4_USABLE_HEIGHT_PX = 1017;

    async function measureHeight(): Promise<number> {
      return page.evaluate(() =>
        Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        )
      );
    }

    async function applyDensity(level: number): Promise<void> {
      await page.evaluate((d) => {
        document.body.className = d > 0 ? `density-${d}` : "";
      }, level);
    }

    // Recherche linéaire de la densité minimale qui rentre
    let bestDensity = 0;
    let contentHeight = await measureHeight();
    for (let d = 0; d <= 4; d++) {
      await applyDensity(d);
      contentHeight = await measureHeight();
      if (contentHeight <= A4_USABLE_HEIGHT_PX) {
        bestDensity = d;
        break;
      }
      bestDensity = d; // fallback : on garde le dernier essayé
    }

    // Si encore overflow à density-4 → on scale (plancher 0.5, dernier recours)
    const naturalScale = A4_USABLE_HEIGHT_PX / contentHeight;
    // Plafond 1.15 pour étirer un CV court et remplir l'A4
    const finalScale = Math.max(0.5, Math.min(1.15, naturalScale));

    console.log(
      `[api/pdf] densité=${bestDensity}, hauteur=${contentHeight}px, scale=${finalScale.toFixed(2)}`
    );

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: false,
      omitBackground: true,
      scale: finalScale,
      preferCSSPageSize: true,
      // Force single-page output : si malgré densité+scale le contenu déborde
      // (très rare), on coupe à la page 1. Mieux qu'un PDF 2 pages bancal.
      pageRanges: "1",
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
