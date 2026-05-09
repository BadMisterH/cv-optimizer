import { NextResponse } from "next/server";
import type { CVSection, OptimizedCV } from "@/app/types";
import { launchBrowser } from "@/lib/browser";
import { requireSession } from "@/lib/require-auth";

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

function isDuplicateHeading(sectionTitle: string, itemHeading: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  return norm(sectionTitle) === norm(itemHeading);
}

function renderSection(section: CVSection): string {
  const items = visibleItems(section);
  if (items.length === 0) return "";

  const isOrphanList =
    items.length > 1 &&
    items.every(
      (it) => it.bullets.length === 0 && it.tags.length === 0 && !!it.heading
    );

  const itemsHtml = isOrphanList
    ? items
        .map(
          (it) =>
            `<p class="bullet">• ${escapeHtml(
              [it.heading, it.subheading].filter(Boolean).join(" — ")
            )}</p>`
        )
        .join("")
    : items
        .map((it) => {
          // Skip heading if it just duplicates the section title (ex: "Langues" inside LANGUES)
          const showHeading =
            it.heading && !isDuplicateHeading(section.title, it.heading);
          const heading = showHeading
            ? `<p class="item-heading">${escapeHtml(it.heading!)}</p>`
            : "";
          const subheading = it.subheading
            ? `<p class="item-subheading">${escapeHtml(it.subheading)}</p>`
            : "";
          const bullets = it.bullets
            .map((b) => `<p class="bullet">• ${escapeHtml(b)}</p>`)
            .join("");
          const tags =
            it.tags.length > 0
              ? `<p class="skills">${escapeHtml(it.tags.join(" · "))}</p>`
              : "";
          return `<div class="item">${heading}${subheading}${bullets}${tags}</div>`;
        })
        .join("");

  return `<section class="cv-section"><h2 class="section-title">${escapeHtml(
    section.title
  )}</h2>${itemsHtml}</section>`;
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

  const sidebarSections = cv.sections.filter((s) => isSidebarSection(s.title));
  const mainSections = cv.sections.filter((s) => !isSidebarSection(s.title));

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CV ${escapeHtml(cv.fullName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #0f0f10;
    font-size: 10pt;
    line-height: 1.5;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    border-bottom: 1.5pt solid #1f4bff;
    padding-bottom: 8pt;
    margin-bottom: 14pt;
    display: flex;
    align-items: flex-start;
    gap: 16pt;
  }
  .header-text { flex: 1; min-width: 0; }
  .header-photo {
    width: 88px;
    height: 110px;
    object-fit: cover;
    border-radius: 3pt;
    flex-shrink: 0;
  }
  .title {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: -0.4pt;
    color: #0f0f10;
    line-height: 1.15;
  }
  .name {
    font-size: 12pt;
    font-weight: 500;
    color: #2b2a28;
    margin-top: 4pt;
  }
  .contact {
    font-size: 9pt;
    color: #5d5b56;
    margin-top: 6pt;
  }
  .contact .link {
    color: #1f4bff;
    text-decoration: underline;
    text-decoration-color: rgba(31, 75, 255, 0.35);
    text-underline-offset: 1.5pt;
    word-break: break-all;
  }
  .contact .sep {
    color: #b0aea5;
    margin: 0 2pt;
  }
  .body {
    display: grid;
    grid-template-columns: 32% 1fr;
    column-gap: 20pt;
  }
  .sidebar {
    border-right: 0.5pt solid #e5e2d8;
    padding-right: 16pt;
  }
  .main { padding-left: 0; }
  .cv-section { break-inside: avoid; page-break-inside: avoid; }
  .section-title {
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.6pt;
    border-bottom: 1pt solid #1f4bff;
    padding-bottom: 3pt;
    margin-top: 14pt;
    margin-bottom: 8pt;
    color: #0f0f10;
  }
  .sidebar .cv-section:first-child .section-title,
  .main .cv-section:first-child .section-title {
    margin-top: 0;
  }
  .main > .cv-section:first-of-type .section-title {
    margin-top: 0;
  }
  .item {
    margin-bottom: 9pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sidebar .item { margin-bottom: 7pt; }
  .item-heading {
    font-weight: 700;
    font-size: 10pt;
    color: #0f0f10;
    line-height: 1.35;
  }
  .item-subheading {
    font-size: 9pt;
    color: #5d5b56;
    margin-top: 1pt;
    margin-bottom: 3pt;
  }
  .bullet {
    font-size: 9.5pt;
    margin-left: 10pt;
    margin-bottom: 2pt;
    color: #2b2a28;
    line-height: 1.45;
    text-indent: -10pt;
    padding-left: 10pt;
  }
  .sidebar .bullet { font-size: 9pt; line-height: 1.4; }
  .skills {
    font-size: 9pt;
    color: #2b2a28;
    margin-top: 2pt;
    line-height: 1.5;
  }
  .accroche {
    font-size: 10pt;
    color: #2b2a28;
    line-height: 1.55;
  }
</style>
</head>
<body>
  <header class="header">
    <div class="header-text">
      ${cv.title ? `<h1 class="title">${escapeHtml(cv.title)}</h1>` : ""}
      <p class="name">${escapeHtml(cv.fullName)}</p>
      ${contactHtml ? `<p class="contact">${contactHtml}</p>` : ""}
    </div>
    ${
      photoDataUrl
        ? `<img class="header-photo" src="${escapeHtml(photoDataUrl)}" alt="" />`
        : ""
    }
  </header>
  <div class="body">
    <aside class="sidebar">${sidebarSections.map(renderSection).join("")}</aside>
    <main class="main">
      ${
        cv.accroche
          ? `<section class="cv-section"><h2 class="section-title">À propos</h2><p class="accroche">${escapeHtml(
              cv.accroche
            )}</p></section>`
          : ""
      }
      ${mainSections.map(renderSection).join("")}
    </main>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    const guard = await requireSession(req);
    if (guard.response) return guard.response;

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
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
