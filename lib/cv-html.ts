/**
 * Génération du HTML CV — partagée entre :
 *   - /api/pdf (Puppeteer convertit l'HTML en PDF)
 *   - Preview iframe côté client (rendu live identique au PDF)
 *
 * Fonctions PURES, aucune dépendance Node-specific.
 */
import type { CVSection, OptimizedCV } from "@/app/types";

export type Template = "classic" | "sidebar-left" | "sidebar-right" | "single";

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
      const company = it.company ? escapeHtml(it.company) : "";
      const headingRow = heading
        ? `<div class="item-header"><div><span class="item-heading">${heading}</span>${company ? `<span class="item-company">${company}</span>` : ""}</div>${subheading ? `<span class="item-meta">${subheading}</span>` : ""}</div>`
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

export function buildHtml(
  cv: OptimizedCV,
  photoDataUrl?: string,
  accentColor: string = "#1f4bff",
  template: Template = "classic"
): string {
  const contactHtml = buildContactHtml(cv.contact);
  const sectionsHtml = cv.sections.map(renderSection).join("");
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accentColor) ? accentColor : "#1f4bff";
  const containerClass = `container template-${template}`;

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
    --accent-soft: ${safeAccent}1a;
  }
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
    padding: 18px 24px;
  }
  .container {
    max-width: 794px;
    margin: 0 auto;
  }
  .header {
    margin-bottom: 12px;
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
    color: var(--accent);
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
    margin: 12px 0;
    border-top: 1.5pt solid #111111;
  }
  .cv-section {
    margin-bottom: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.4pt;
    color: #111111;
    margin-bottom: 7px;
    padding-bottom: 3px;
    border-bottom: 1px solid #111111;
  }
  .item {
    margin-bottom: 9px;
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
  .item-company {
    font-size: 10pt;
    font-weight: 700;
    color: var(--accent);
    margin-left: 4px;
  }
  .item-company::before {
    content: " · ";
    color: #b0aea5;
    font-weight: 400;
  }
  .item-meta {
    font-size: 9pt;
    color: #5d5b56;
    text-align: right;
    min-width: 120px;
  }
  .item-bullets {
    margin-top: 5px;
    padding-left: 16px;
    color: #222222;
    font-size: 9.5pt;
    line-height: 1.45;
  }
  .item-bullets li {
    margin-bottom: 3px;
  }
  .skills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .skills span {
    display: inline-flex;
    background: var(--accent-soft);
    color: var(--accent);
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 8.8pt;
  }
  .accroche {
    font-size: 9.8pt;
    color: #222222;
    line-height: 1.5;
  }
  /* === Variations de template === */
  .template-sidebar-left .header,
  .template-sidebar-right .header {
    border-left: 4pt solid var(--accent);
    padding-left: 12px;
  }
  .template-sidebar-right .header {
    border-left: none;
    border-right: 4pt solid var(--accent);
    padding-left: 0;
    padding-right: 12px;
    text-align: right;
  }
  .template-sidebar-right .top-line {
    flex-direction: row-reverse;
  }
  .template-sidebar-right .contact {
    justify-content: flex-end;
  }
  .template-single .section-title {
    text-align: center;
    border-bottom: 1.5pt solid var(--accent);
  }
  .template-single .header {
    text-align: center;
  }
  .template-single .top-line {
    justify-content: center;
    flex-direction: column;
    align-items: center;
  }
  .template-single .contact {
    justify-content: center;
  }
  .photo {
    width: 80px;
    height: 96px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
  }
</style>
</head>
<body>
  <div class="${containerClass}">
    <header class="header">
      <div class="top-line">
        <div>
          <p class="title">${escapeHtml(cv.fullName)}</p>
          ${cv.title ? `<p class="subtitle">${escapeHtml(cv.title)}</p>` : ""}
        </div>
        ${photoDataUrl ? `<img class="photo" src="${escapeHtml(photoDataUrl)}" alt="" />` : ""}
      </div>
      ${contactHtml ? `<div class="contact">${contactHtml}</div>` : ""}
    </header>
    <div class="divider"></div>
    ${
      cv.accroche?.trim()
        ? `<section class="cv-section"><h2 class="section-title">À propos</h2><p class="accroche">${escapeHtml(cv.accroche.trim())}</p></section>`
        : ""
    }
    ${sectionsHtml}
  </div>
</body>
</html>`;
}
