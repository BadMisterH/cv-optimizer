/**
 * Génération du HTML CV — partagée entre :
 *   - /api/pdf (Puppeteer convertit l'HTML en PDF)
 *   - Preview iframe côté client (rendu live identique au PDF)
 *
 * Fonctions PURES, aucune dépendance Node-specific.
 */
import type { CVSection, OptimizedCV } from "@/app/types";

// Dupliqué volontairement depuis lib/cv-pdf-shared : ce module est importé par
// l'aperçu client (LivePreview) et doit rester exempt de toute dépendance
// server-only. Garder les deux listes de templates synchronisées.
export type Template = "classic" | "single" | "ats";

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

  // Une puce ou une pastille vide (champ jamais rempli, ou vidé par l'utilisateur)
  // ne doit jamais atteindre le rendu : elle apparaîtrait comme un marqueur ou une
  // bulle orpheline.
  const filledBullets = it.bullets.filter((b) => b.trim().length > 0);
  const filledTags = it.tags.filter((t) => t.trim().length > 0);

  const bullets = filledBullets.length
    ? `<ul class="item-bullets">${filledBullets
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join("")}</ul>`
    : "";
  const tags = filledTags.length
    ? `<div class="skills">${filledTags
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

/** Retire le protocole pour l'affichage ("https://github.com/x" → "github.com/x"). */
function stripProtocol(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/^https?:\/\//i, "");
}

/**
 * `bareUrls` affiche les URLs sans protocole (le lien cliquable le garde) et
 * `separator` change le caractère entre deux coordonnées — les deux suivent le
 * template ATS pour que l'aperçu corresponde exactement au PDF généré.
 */
function buildContactHtml(
  contact: OptimizedCV["contact"],
  { bareUrls = false, separator = " · " }: { bareUrls?: boolean; separator?: string } = {}
): string {
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
      const label = bareUrls ? stripProtocol(url) : full;
      parts.push(
        `<a class="link" href="${escapeHtml(full)}">${escapeHtml(label)}</a>`
      );
    }
  }

  return parts.join(`<span class="sep">${escapeHtml(separator)}</span>`);
}

export function buildHtml(
  cv: OptimizedCV,
  photoDataUrl?: string,
  accentColor: string = "#1f4bff",
  template: Template = "classic"
): string {
  const isAts = template === "ats";
  const contactHtml = buildContactHtml(cv.contact, {
    bareUrls: isAts,
    separator: isAts ? " | " : " · ",
  });
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accentColor) ? accentColor : "#1f4bff";
  const containerClass = `container template-${template}`;

  const accrocheHtml = cv.accroche?.trim()
    ? `<section class="cv-section"><h2 class="section-title">Profil</h2><p class="accroche">${escapeHtml(cv.accroche.trim())}</p></section>`
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
        ${photoHtml}
      </div>
      ${contactHtml ? `<div class="contact">${contactHtml}</div>` : ""}
    </header>
  `;

  const layoutHtml = `<div class="cv-flow">${accrocheHtml}${cv.sections.map(renderSection).join("")}</div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CV ${escapeHtml(cv.fullName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
    /* Densité par défaut (niveau 0 — spacieux). Puppeteer peut basculer
       sur .density-1..4 pour comprimer si le contenu dépasse A4. */
    --base-fs: 10.5pt;
    --base-lh: 1.5;
    --section-gap: 14px;
    --section-title-fs: 8.2pt;
    --section-title-mb: 8px;
    --item-gap: 9px;
    --item-fs: 10.5pt;
    --item-bullets-fs: 9.5pt;
    --item-bullets-lh: 1.4;
    --item-bullets-mb: 2px;
    --container-pad-y: 22px;
    --container-pad-x: 26px;
    --header-mb: 14px;
    --header-title-fs: 22pt;
    --header-subtitle-fs: 15pt;
    --photo-w: 78px;
    --photo-h: 96px;
    --tag-fs: 8.4pt;
    --tag-pad: 2.5px 7px;
  }

  /* === Niveaux de densité (Puppeteer applique la classe sur <body>) ===
     Les niveaux 2-4 ont un plancher sur --base-lh/--item-bullets-lh (1.30)
     et --container-pad-y (14px) : on ne les écrase plus jamais pour gagner
     de la place. La compaction supplémentaire vient des espaces entre blocs
     (section-gap, item-gap, header-mb) et de tags plus resserrés (tag-pad). */
  body.density-1 {
    --base-fs: 10.3pt;
    --base-lh: 1.44;
    --section-gap: 11px;
    --item-gap: 7px;
    --item-fs: 10.3pt;
    --item-bullets-fs: 9.3pt;
    --item-bullets-lh: 1.35;
    --container-pad-y: 18px;
    --header-mb: 11px;
    --header-title-fs: 21pt;
    --header-subtitle-fs: 14.5pt;
    --photo-w: 72px;
    --photo-h: 90px;
    --tag-fs: 8.2pt;
    --tag-pad: 2.2px 6.5px;
  }
  body.density-2 {
    --base-fs: 10pt;
    --base-lh: 1.40;
    --section-gap: 8px;
    --section-title-mb: 6px;
    --item-gap: 5.5px;
    --item-fs: 10pt;
    --item-bullets-fs: 9pt;
    --item-bullets-lh: 1.32;
    --item-bullets-mb: 1.5px;
    --container-pad-y: 15px;
    --header-mb: 8px;
    --header-title-fs: 20pt;
    --header-subtitle-fs: 13.5pt;
    --photo-w: 66px;
    --photo-h: 82px;
    --tag-fs: 7.9pt;
    --tag-pad: 1.8px 5.5px;
  }
  body.density-3 {
    --base-fs: 9.6pt;
    --base-lh: 1.35;
    --section-gap: 6px;
    --section-title-fs: 8pt;
    --section-title-mb: 4px;
    --item-gap: 4px;
    --item-fs: 9.7pt;
    --item-bullets-fs: 8.7pt;
    --item-bullets-lh: 1.30;
    --item-bullets-mb: 1px;
    --container-pad-y: 14px;
    --header-mb: 5px;
    --header-title-fs: 19pt;
    --header-subtitle-fs: 12.5pt;
    --photo-w: 60px;
    --photo-h: 74px;
    --tag-fs: 7.7pt;
    --tag-pad: 1.3px 5px;
  }
  body.density-4 {
    --base-fs: 9.3pt;
    --base-lh: 1.30;
    --section-gap: 5px;
    --section-title-fs: 7.8pt;
    --section-title-mb: 3px;
    --item-gap: 3px;
    --item-fs: 9.4pt;
    --item-bullets-fs: 8.4pt;
    --item-bullets-lh: 1.30;
    --item-bullets-mb: 0.5px;
    --container-pad-y: 14px;
    --container-pad-x: 22px;
    --header-mb: 4px;
    --header-title-fs: 18pt;
    --header-subtitle-fs: 11.5pt;
    --photo-w: 56px;
    --photo-h: 70px;
    --tag-fs: 7.5pt;
    --tag-pad: 0.8px 4.5px;
  }

  html, body {
    font-family: "Inter", "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif;
    color: var(--ink);
    font-size: var(--base-fs);
    line-height: var(--base-lh);
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
    padding: var(--container-pad-y) var(--container-pad-x);
  }

  /* ========== HEADER ========== */
  .header {
    margin-bottom: var(--header-mb);
    position: relative;
  }
  /* Accent rule au-dessus du nom — détail éditorial */
  .header::before {
    content: "";
    display: block;
    width: 28pt;
    height: 1.4pt;
    background: var(--accent);
    margin-bottom: 8px;
  }
  .top-line {
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
  }
  .title-block {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: var(--header-title-fs);
    font-weight: 700;
    letter-spacing: -0.7pt;
    color: var(--ink);
    line-height: 1;
    margin-bottom: 5px;
  }
  .subtitle {
    font-size: var(--header-subtitle-fs);
    font-weight: 500;
    color: var(--accent);
    letter-spacing: 0.1pt;
    margin-top: 3px;
    text-transform: uppercase;
    /* Tracking large pour effet éditorial */
    letter-spacing: 1pt;
  }
  .contact {
    font-size: 8.5pt;
    color: var(--ink-muted);
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 0 8px;
    line-height: 1.6;
  }
  .contact .link {
    color: var(--ink-soft);
    text-decoration: none;
  }
  .contact .sep {
    color: var(--ink-faint);
    margin: 0 1px;
  }
  .photo {
    width: var(--photo-w);
    height: var(--photo-h);
    object-fit: cover;
    border-radius: 1px;
    flex-shrink: 0;
    /* Cadre fin + ombre douce */
    box-shadow:
      0 0 0 1pt var(--ink),
      4pt 4pt 0 var(--accent-soft);
  }

  /* ========== LAYOUT ========== */
  .cv-flow {
    position: relative;
  }
  .template-classic .header,
  .template-single .header {
    border-bottom: 1.5pt solid var(--ink);
    padding-bottom: 12px;
  }

  /* ========== SECTIONS ========== */
  .cv-section {
    margin-bottom: var(--section-gap);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: var(--section-title-fs);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--ink);
    margin-bottom: var(--section-title-mb);
    padding-bottom: 5px;
    border-bottom: 0.5pt solid var(--rule);
    display: flex;
    align-items: center;
    gap: 7px;
  }
  /* Carré accent avant le titre (remplace l'underline décoratif) */
  .section-title::before {
    content: "";
    display: inline-block;
    width: 5pt;
    height: 5pt;
    background: var(--accent);
    flex-shrink: 0;
  }

  /* Items */
  .item {
    margin-bottom: var(--item-gap);
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
    font-size: var(--item-fs);
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.15pt;
  }
  .item-company {
    font-size: var(--item-fs);
    font-weight: 700;
    color: var(--accent);
    margin-left: 5px;
    letter-spacing: -0.1pt;
  }
  .item-company::before {
    content: "·";
    color: var(--ink-faint);
    font-weight: 400;
    margin-right: 5px;
    margin-left: -1px;
  }
  .item-meta {
    font-size: 8.3pt;
    color: var(--ink-muted);
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.2pt;
    text-transform: uppercase;
  }

  /* Bullets : marqueur accent en losange creux pour finesse premium */
  .item-bullets {
    margin-top: 4px;
    padding-left: 12px;
    color: var(--ink-soft);
    font-size: var(--item-bullets-fs);
    line-height: var(--item-bullets-lh);
    list-style: none;
  }
  .item-bullets li {
    position: relative;
    padding-left: 4px;
    margin-bottom: var(--item-bullets-mb);
  }
  .item-bullets li::before {
    content: "";
    position: absolute;
    left: -9px;
    top: 0.52em;
    width: 3.5pt;
    height: 3.5pt;
    background: var(--accent);
    border-radius: 0.5pt;
    transform: rotate(45deg);
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

  /* Tags : chip outlined raffinés, look "label" pas "bouton" */
  .skills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 5px;
    margin-top: 5px;
  }
  .skills span {
    display: inline-flex;
    align-items: center;
    background: transparent;
    color: var(--ink-soft);
    padding: var(--tag-pad);
    border: 0.5pt solid var(--accent);
    border-radius: 999px;
    font-size: var(--tag-fs);
    font-weight: 500;
    letter-spacing: 0.15pt;
    line-height: 1;
  }

  /* Accroche : citation éditoriale, sans italique forcé */
  .accroche {
    font-size: 9.8pt;
    color: var(--ink-soft);
    line-height: 1.55;
    padding-left: 10pt;
    border-left: 1.2pt solid var(--accent);
  }

  /* ========== TEMPLATE ATS ==========
     Reproduction du resume classique noir & blanc : aucune couleur, aucune
     photo, aucune pastille. Les compétences redeviennent une liste inline
     ("Catégorie : a, b, c") et les titres de section reprennent une casse
     normale soulignée d'un filet pleine largeur. La couleur d'accent est
     volontairement ignorée — c'est tout l'intérêt de ce template. */
  .template-ats {
    --ink: #000;
    --ink-soft: #000;
    --ink-muted: #000;
    --ink-faint: #000;
  }
  .template-ats .header {
    text-align: center;
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: var(--header-mb);
  }
  .template-ats .header::before { display: none; }
  .template-ats .top-line { justify-content: center; }
  .template-ats .title-block { text-align: center; }
  .template-ats .photo { display: none; }
  .template-ats .title { color: #000; letter-spacing: -0.4pt; }
  .template-ats .subtitle {
    color: #000;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    font-size: calc(var(--header-subtitle-fs) * 0.72);
  }
  .template-ats .contact { justify-content: center; color: #000; gap: 0 6px; }
  .template-ats .contact .link { color: #000; }
  .template-ats .contact .sep { color: #000; }

  .template-ats .section-title {
    display: block;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    font-size: calc(var(--section-title-fs) * 1.45);
    color: #000;
    border-bottom: 0.75pt solid #000;
    padding-bottom: 1.5px;
  }
  .template-ats .section-title::before { display: none; }

  .template-ats .item-heading,
  .template-ats .item-company,
  .template-ats .item-meta {
    color: #000;
    letter-spacing: 0;
  }
  .template-ats .item-company::before { content: ","; margin-right: 4px; color: #000; }
  .template-ats .item-company { font-weight: 400; margin-left: 0; }
  .template-ats .item-meta { text-transform: none; }

  .template-ats .item-bullets { color: #000; }
  .template-ats .item-bullets li::before {
    background: #000;
    border-radius: 50%;
    transform: none;
    width: 2.6pt;
    height: 2.6pt;
    top: 0.55em;
  }

  /* Accroche : paragraphe simple, sans filet latéral coloré */
  .template-ats .accroche {
    border-left: none;
    padding-left: 0;
    color: #000;
  }

  /* Compétences : "Catégorie : a, b, c" sur une ligne de texte continue */
  .template-ats .item-skill-cat {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 4px;
    margin-bottom: 2px;
  }
  .template-ats .skill-cat-header { display: inline; margin: 0; gap: 0; }
  .template-ats .skill-cat-header::after { content: none; }
  .template-ats .skill-cat-heading {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 700;
    font-size: var(--item-fs);
    color: #000;
  }
  .template-ats .skill-cat-heading::after { content: " :"; }
  .template-ats .skills { display: inline; margin: 0; gap: 0; }
  .template-ats .skills span {
    display: inline;
    border: none;
    background: none;
    padding: 0;
    border-radius: 0;
    font-weight: 400;
    letter-spacing: 0;
    font-size: var(--item-fs);
    color: #000;
  }
  /* Espace insécable : une espace littérale dans content est rognée au rendu */
  .template-ats .skills span:not(:last-child)::after { content: ",\\00a0"; }

  /* ========== VARIATIONS TEMPLATE ========== */
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
