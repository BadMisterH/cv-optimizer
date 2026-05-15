/**
 * Génération du HTML CV — partagée entre :
 *   - /api/pdf (Puppeteer convertit l'HTML en PDF)
 *   - Preview iframe côté client (rendu live identique au PDF)
 *
 * Fonctions PURES, aucune dépendance Node-specific.
 */
import type { CVSection, OptimizedCV } from "@/app/types";

export type Template = "classic" | "sidebar-left" | "sidebar-right" | "single";

// Mots-clés pour identifier les sections qui vont en sidebar (mode 2-col)
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

function renderItem(it: CVSection["items"][number]): string {
  const heading = it.heading ? escapeHtml(it.heading) : "";
  const subheading = it.subheading ? escapeHtml(it.subheading) : "";
  const company = it.company ? escapeHtml(it.company) : "";

  // Item type detection : si que tags (pas de bullets), c'est probablement une catégorie de compétences
  const isSkillCategory =
    it.tags.length > 0 && it.bullets.length === 0 && heading;

  const headingRow = heading
    ? isSkillCategory
      ? `<div class="skill-cat-header"><span class="skill-cat-heading">${heading}</span></div>`
      : `<div class="item-header"><div><span class="item-heading">${heading}</span>${company ? `<span class="item-company">${company}</span>` : ""}</div>${subheading ? `<span class="item-meta">${subheading}</span>` : ""}</div>`
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
  const itemClass = isSkillCategory ? "item item-skill-cat" : "item";
  return `<div class="${itemClass}">${headingRow}${bullets}${tags}</div>`;
}

function renderSection(section: CVSection): string {
  const items = visibleItems(section);
  if (items.length === 0) return "";
  const sectionTitle = escapeHtml(section.title);
  const itemsHtml = items.map(renderItem).join("");
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

export function buildHtml(
  cv: OptimizedCV,
  photoDataUrl?: string,
  accentColor: string = "#1f4bff",
  template: Template = "classic"
): string {
  const contactHtml = buildContactHtml(cv.contact);
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accentColor) ? accentColor : "#1f4bff";
  const containerClass = `container template-${template}`;
  const useSidebar = template === "sidebar-left" || template === "sidebar-right";

  // Découpe sidebar / main si template 2-col
  const sidebarSections = useSidebar
    ? cv.sections.filter((s) => isSidebarSection(s.title))
    : [];
  const mainSections = useSidebar
    ? cv.sections.filter((s) => !isSidebarSection(s.title))
    : cv.sections;

  const accrocheHtml = cv.accroche?.trim()
    ? `<section class="cv-section"><h2 class="section-title">À propos</h2><p class="accroche">${escapeHtml(cv.accroche.trim())}</p></section>`
    : "";

  const photoHtml = photoDataUrl
    ? `<img class="photo" src="${escapeHtml(photoDataUrl)}" alt="" />`
    : "";

  const headerHtml = `
    <header class="header">
      <div class="top-line">
        <div class="title-block">
          <p class="title">${escapeHtml(cv.fullName)}</p>
          ${cv.title ? `<p class="subtitle">${escapeHtml(cv.title)}</p>` : ""}
        </div>
        ${!useSidebar ? photoHtml : ""}
      </div>
      ${contactHtml ? `<div class="contact">${contactHtml}</div>` : ""}
    </header>
  `;

  // Layout interne
  let layoutHtml: string;
  if (useSidebar) {
    const sidebarBody = `
      <aside class="cv-sidebar">
        ${photoHtml}
        ${sidebarSections.map(renderSection).join("")}
      </aside>
    `;
    const mainBody = `
      <div class="cv-main">
        ${accrocheHtml}
        ${mainSections.map(renderSection).join("")}
      </div>
    `;
    // Ordre HTML selon template : sidebar-left = aside puis main, sidebar-right = main puis aside
    layoutHtml = `<div class="cv-layout">${
      template === "sidebar-right" ? mainBody + sidebarBody : sidebarBody + mainBody
    }</div>`;
  } else {
    layoutHtml = `<div class="cv-flow">${accrocheHtml}${mainSections.map(renderSection).join("")}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CV ${escapeHtml(cv.fullName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 14mm; }
  :root {
    --accent: ${safeAccent};
    --accent-soft: ${safeAccent}1f;
    --accent-rule: ${safeAccent}33;
    --ink: #0f0f10;
    --ink-soft: #2a2a2c;
    --ink-muted: #5d5b56;
    --ink-faint: #a09d94;
    --rule: #e8e6df;
    --paper: #ffffff;
  }
  html, body {
    font-family: "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif;
    color: var(--ink);
    font-size: 10.5pt;
    line-height: 1.5;
    background: var(--paper);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-variant-numeric: tabular-nums;
  }
  body {
    padding: 0;
  }
  .container {
    max-width: 794px;
    margin: 0 auto;
    padding: 22px 26px;
  }

  /* ========== HEADER ========== */
  .header {
    margin-bottom: 14px;
  }
  .top-line {
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
  .title-block {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: -0.6pt;
    color: var(--ink);
    line-height: 1.05;
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: 11.5pt;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: -0.1pt;
    margin-top: 2px;
  }
  .contact {
    font-size: 8.5pt;
    color: var(--ink-muted);
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    line-height: 1.5;
  }
  .contact .link {
    color: var(--ink-soft);
    text-decoration: none;
  }
  .contact .sep {
    color: var(--ink-faint);
  }
  .photo {
    width: 78px;
    height: 96px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
    box-shadow: 0 0 0 1pt var(--rule);
  }

  /* ========== LAYOUT ========== */
  .cv-flow {
    /* mode 1 colonne */
  }
  .cv-layout {
    display: grid;
    gap: 22px;
    margin-top: 4px;
  }
  .template-sidebar-left .cv-layout {
    grid-template-columns: 200px 1fr;
  }
  .template-sidebar-right .cv-layout {
    grid-template-columns: 1fr 200px;
  }
  .cv-sidebar .photo {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 5;
    margin-bottom: 14px;
    border-radius: 3px;
  }

  /* Divider sous header (mode 1-col uniquement) */
  .cv-flow {
    position: relative;
  }
  .template-classic .header,
  .template-single .header {
    border-bottom: 1.5pt solid var(--ink);
    padding-bottom: 12px;
  }

  /* Sidebar template = pas de divider sous header (la grille s'en charge) */
  .template-sidebar-left .header,
  .template-sidebar-right .header {
    border-bottom: 0.5pt solid var(--rule);
    padding-bottom: 10px;
  }

  /* ========== SECTIONS ========== */
  .cv-section {
    margin-bottom: 14px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 8.2pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2pt;
    color: var(--ink);
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 0.8pt solid var(--ink);
    position: relative;
  }
  /* Petit accent à gauche du titre de section */
  .section-title::before {
    content: "";
    position: absolute;
    left: 0;
    bottom: -0.8pt;
    width: 24px;
    height: 0.8pt;
    background: var(--accent);
  }

  /* Items */
  .item {
    margin-bottom: 9px;
  }
  .item:last-child {
    margin-bottom: 0;
  }
  .item-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
    margin-bottom: 1px;
  }
  .item-heading {
    font-size: 10.5pt;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.1pt;
  }
  .item-company {
    font-size: 10.5pt;
    font-weight: 700;
    color: var(--accent);
    margin-left: 4px;
  }
  .item-company::before {
    content: " · ";
    color: var(--ink-faint);
    font-weight: 400;
  }
  .item-meta {
    font-size: 8.5pt;
    color: var(--ink-muted);
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  /* Bullets */
  .item-bullets {
    margin-top: 3px;
    padding-left: 14px;
    color: var(--ink-soft);
    font-size: 9.5pt;
    line-height: 1.4;
    list-style: none;
  }
  .item-bullets li {
    position: relative;
    padding-left: 4px;
    margin-bottom: 2px;
  }
  .item-bullets li::before {
    content: "";
    position: absolute;
    left: -10px;
    top: 0.55em;
    width: 5px;
    height: 0.75pt;
    background: var(--ink);
  }

  /* ========== COMPÉTENCES (sous-catégories) ========== */
  .item-skill-cat {
    margin-bottom: 8px;
  }
  .skill-cat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .skill-cat-heading {
    font-size: 8.5pt;
    font-weight: 600;
    color: var(--ink);
    text-transform: uppercase;
    letter-spacing: 0.6pt;
    white-space: nowrap;
  }
  .skill-cat-header::after {
    content: "";
    flex: 1;
    height: 0.4pt;
    background: var(--rule);
  }

  /* Tags */
  .skills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 5px;
    margin-top: 4px;
  }
  .skills span {
    display: inline-flex;
    align-items: center;
    background: var(--accent-soft);
    color: var(--accent);
    padding: 2.5px 7px;
    border-radius: 3px;
    font-size: 8.4pt;
    font-weight: 500;
    letter-spacing: 0.1pt;
  }

  /* Accroche */
  .accroche {
    font-size: 9.8pt;
    color: var(--ink-soft);
    line-height: 1.5;
    font-style: italic;
  }

  /* ========== VARIATIONS TEMPLATE ========== */
  /* Sidebar : adapter les tailles + densité */
  .cv-sidebar .section-title {
    font-size: 7.5pt;
    letter-spacing: 1.6pt;
    margin-bottom: 6px;
    padding-bottom: 3px;
  }
  .cv-sidebar .item-heading,
  .cv-sidebar .item-company {
    font-size: 9.5pt;
  }
  .cv-sidebar .item-meta {
    font-size: 8pt;
    text-align: left;
    display: block;
    margin-top: 1px;
  }
  .cv-sidebar .item-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
  }
  .cv-sidebar .item-bullets {
    font-size: 8.8pt;
  }
  .cv-sidebar .cv-section {
    margin-bottom: 12px;
  }
  .cv-sidebar .skills span {
    font-size: 8pt;
    padding: 2px 6px;
  }
  .cv-sidebar .skill-cat-heading {
    font-size: 7.8pt;
  }

  /* Single (centré) */
  .template-single .header {
    text-align: center;
  }
  .template-single .top-line {
    flex-direction: column-reverse;
    align-items: center;
    gap: 8px;
  }
  .template-single .title-block {
    text-align: center;
  }
  .template-single .contact {
    justify-content: center;
  }
  .template-single .section-title {
    text-align: center;
    border-bottom: 1pt solid var(--accent);
  }
  .template-single .section-title::before {
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
  }
</style>
</head>
<body>
  <div class="${containerClass}">
    ${headerHtml}
    ${layoutHtml}
  </div>
</body>
</html>`;
}
