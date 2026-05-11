import { NextResponse } from "next/server";
import type { CVSection, OptimizedCV } from "@/app/types";
import { launchBrowser } from "@/lib/browser";

export const runtime = "nodejs";
export const maxDuration = 60;

const SIDEBAR_KEYWORDS = [
  "compétence",
  "competence",
  "skill",
  "langue",
  "language",
  "centre",
  "interet",
  "intérêt",
  "hobby",
  "loisir",
  "formation",
  "education",
  "éducation",
  "diplôme",
  "diplome",
  "studies",
  "parcours",
];

function isSidebarSection(title: string): boolean {
  const lower = title.toLowerCase();
  return SIDEBAR_KEYWORDS.some((k) => lower.includes(k));
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function visibleItems(section: CVSection) {
  return section.items.filter(
    (it) =>
      (it.heading && it.heading.trim().length > 0) ||
      (it.subheading && it.subheading.trim().length > 0) ||
      it.bullets.length > 0 ||
      it.tags.length > 0
  );
}

function renderSection(section: CVSection): string {
  const items = visibleItems(section);
  if (items.length === 0) return "";

  const sectionTitle = escapeHtml(section.title);

  const itemsHtml = items
    .map((it) => {
      const heading = it.heading ? escapeHtml(it.heading) : "";
      const subheading = it.subheading ? escapeHtml(it.subheading) : "";
      const headingRow = heading
        ? `<div class="item-header"><span class="item-heading">${heading}</span>${subheading ? `<span class="item-meta">${subheading}</span>` : ""}</div>`
        : "";
      const bullets = it.bullets.length
        ? `<ul class="item-bullets">${it.bullets
            .map((b) => `<li>${escapeHtml(b)}</li>`)
            .join("")}</ul>`
        : "";
      const tags = it.tags.length
        ? `<div class="skills">${it.tags
            .map((tag) => `<span>${escapeHtml(tag)}</span>`)
            .join("")}</div>`
        : "";
      return `<div class="item">${headingRow}${bullets}${tags}</div>`;
    })
    .join("");

  return `<section class="cv-section"><h2 class="section-title">${sectionTitle}</h2>${itemsHtml}</section>`;
}

function ensureProtocol(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildContactHtml(contact: OptimizedCV["contact"]): string {
  const parts: string[] = [];

  if (contact.email?.trim()) {
    const v = contact.email.trim();
    parts.push(
      `<a class="link" href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>`
    );
  }
  if (contact.phone?.trim()) {
    const display = contact.phone.trim();
    const tel = display.replace(/[^\d+]/g, "");
    parts.push(
      `<a class="link" href="tel:${escapeHtml(tel)}">${escapeHtml(display)}</a>`
    );
  }
  if (contact.location?.trim()) {
    parts.push(`<span>${escapeHtml(contact.location.trim())}</span>`);
  }
  for (const url of [contact.linkedin, contact.github, contact.portfolio]) {
    if (url?.trim()) {
      const full = ensureProtocol(url);
      parts.push(
        `<a class="link" href="${escapeHtml(full)}">${escapeHtml(full)}</a>`
      );
    }
  }

  return parts.join('<span class="sep"> · </span>');
}

function buildHtml(cv: OptimizedCV, photoDataUrl?: string): string {
  const contactHtml = buildContactHtml(cv.contact);
  const sectionsHtml = cv.sections.map(renderSection).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CV ${escapeHtml(cv.fullName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #111111;
    font-size: 11pt;
    line-height: 1.5;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    padding: 24px 28px;
  }
  .container {
    max-width: 794px;
    margin: 0 auto;
  }
  .header {
    margin-bottom: 18px;
  }
  .top-line {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .title {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: -0.4pt;
    color: #111111;
    margin-bottom: 6px;
  }
  .name {
    font-size: 14pt;
    font-weight: 700;
    color: #111111;
  }
  .subtitle {
    font-size: 11pt;
    font-weight: 600;
    color: #1f4bff;
    margin-top: 4px;
  }
  .contact {
    font-size: 9pt;
    color: #5d5b56;
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .contact .link {
    color: #111111;
    text-decoration: none;
  }
  .contact .sep {
    color: #b0aea5;
  }
  .divider {
    margin: 18px 0;
    border-top: 1.5pt solid #111111;
  }
  .cv-section {
    margin-bottom: 16px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.4pt;
    color: #111111;
    margin-bottom: 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #111111;
  }
  .item {
    margin-bottom: 12px;
  }
  .item-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .item-heading {
    font-size: 10.2pt;
    font-weight: 700;
    color: #111111;
  }
  .item-meta {
    font-size: 9pt;
    color: #5d5b56;
    text-align: right;
    min-width: 120px;
  }
  .item-bullets {
    margin-top: 6px;
    padding-left: 16px;
    color: #222222;
    font-size: 9.5pt;
    line-height: 1.55;
  }
  .item-bullets li {
    margin-bottom: 4px;
  }
  .skills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .skills span {
    display: inline-flex;
    background: #f0f5ff;
    color: #1f4bff;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 8.8pt;
  }
  .accroche {
    font-size: 10pt;
    color: #222222;
    line-height: 1.6;
    margin-top: 6px;
  }
</style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="top-line">
        <div>
          <p class="title">${escapeHtml(cv.fullName)}</p>
          ${cv.title ? `<p class="subtitle">${escapeHtml(cv.title)}</p>` : ""}
        </div>
      </div>
      ${contactHtml ? `<div class="contact">${contactHtml}</div>` : ""}
    </header>
    <div class="divider"></div>
    ${sectionsHtml}
  </div>
</body>
</html>`;
}

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

    const html = buildHtml(cv, photoDataUrl);

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
    // Plancher 0.7 (lisibilité) — plafond 1.15 (étire si contenu court pour bien remplir A4)
    const finalScale = Math.max(0.7, Math.min(1.15, naturalScale));

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      scale: finalScale,
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
