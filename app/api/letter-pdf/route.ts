import { NextResponse } from "next/server";
import type { CoverLetter } from "@/app/types";
import { launchBrowser } from "@/lib/browser";

export const runtime = "nodejs";
export const maxDuration = 60;

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ensureProtocol(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildSenderBlock(letter: CoverLetter): string {
  const lines: string[] = [];
  lines.push(`<strong>${escapeHtml(letter.fullName)}</strong>`);
  if (letter.contact.location?.trim()) {
    lines.push(escapeHtml(letter.contact.location.trim()));
  }
  if (letter.contact.phone?.trim()) {
    lines.push(escapeHtml(letter.contact.phone.trim()));
  }
  if (letter.contact.email?.trim()) {
    const v = letter.contact.email.trim();
    lines.push(`<a class="link" href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>`);
  }
  for (const url of [
    letter.contact.linkedin,
    letter.contact.github,
    letter.contact.portfolio,
  ]) {
    if (url?.trim()) {
      const full = ensureProtocol(url);
      lines.push(`<a class="link" href="${escapeHtml(full)}">${escapeHtml(full)}</a>`);
    }
  }
  return lines.join("<br>");
}

function buildRecipientBlock(letter: CoverLetter): string {
  const lines: string[] = [];
  if (letter.recipient.company?.trim()) {
    lines.push(`<strong>${escapeHtml(letter.recipient.company.trim())}</strong>`);
  }
  if (letter.recipient.department?.trim()) {
    lines.push(escapeHtml(letter.recipient.department.trim()));
  }
  if (letter.recipient.address?.trim()) {
    lines.push(escapeHtml(letter.recipient.address.trim()));
  }
  return lines.join("<br>");
}

function buildHtml(letter: CoverLetter): string {
  const sender = buildSenderBlock(letter);
  const recipient = buildRecipientBlock(letter);
  const dateLine = [letter.city, letter.date].filter((v) => v?.trim()).join(", le ");
  const paragraphs = letter.paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Lettre de motivation — ${escapeHtml(letter.fullName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #0f0f10;
    font-size: 11pt;
    line-height: 1.55;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .letter {
    max-width: 100%;
  }
  .heading-rule {
    border-bottom: 1.5pt solid #1f4bff;
    padding-bottom: 6pt;
    margin-bottom: 18pt;
  }
  .heading-name {
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: -0.4pt;
    color: #0f0f10;
  }
  .heading-subject {
    font-size: 11pt;
    color: #2b2a28;
    margin-top: 3pt;
    font-weight: 500;
  }

  .meta-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 24pt;
    margin-bottom: 22pt;
  }
  .meta-block {
    font-size: 10pt;
    line-height: 1.45;
    color: #2b2a28;
  }
  .meta-block strong { color: #0f0f10; font-weight: 600; }
  .meta-block .link {
    color: #1f4bff;
    text-decoration: underline;
    text-decoration-color: rgba(31, 75, 255, 0.35);
    text-underline-offset: 1.5pt;
  }
  .recipient { text-align: right; }

  .date-line {
    font-size: 10pt;
    color: #2b2a28;
    margin-bottom: 18pt;
    text-align: right;
  }

  .subject-block {
    font-size: 11pt;
    margin-bottom: 22pt;
  }
  .subject-label {
    font-weight: 700;
  }

  .salutation {
    margin-bottom: 14pt;
    font-size: 11pt;
  }

  .body p {
    font-size: 11pt;
    line-height: 1.65;
    color: #0f0f10;
    margin-bottom: 12pt;
    text-align: justify;
    hyphens: auto;
  }

  .closing {
    margin-top: 14pt;
    font-size: 11pt;
    line-height: 1.65;
    color: #0f0f10;
    text-align: justify;
  }

  .signature {
    margin-top: 28pt;
    font-size: 11pt;
    text-align: right;
    font-weight: 600;
  }
</style>
</head>
<body>
  <div class="letter">
    <header class="heading-rule">
      <div class="heading-name">${escapeHtml(letter.fullName)}</div>
      ${
        letter.recipient.role
          ? `<div class="heading-subject">Candidature — ${escapeHtml(
              letter.recipient.role
            )}${
              letter.recipient.company
                ? ` · ${escapeHtml(letter.recipient.company)}`
                : ""
            }</div>`
          : ""
      }
    </header>

    <div class="meta-row">
      <div class="meta-block sender">${sender}</div>
      <div class="meta-block recipient">${recipient}</div>
    </div>

    ${dateLine ? `<div class="date-line">${escapeHtml(dateLine)}</div>` : ""}

    ${
      letter.subject
        ? `<div class="subject-block"><span class="subject-label">Objet :</span> ${escapeHtml(
            letter.subject
          )}</div>`
        : ""
    }

    <div class="salutation">${escapeHtml(letter.salutation)}</div>

    <div class="body">${paragraphs}</div>

    ${letter.closing ? `<div class="closing">${escapeHtml(letter.closing)}</div>` : ""}

    <div class="signature">${escapeHtml(letter.signature)}</div>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    const body = await req.json();
    const letter = body?.letter as CoverLetter | undefined;
    if (!letter?.fullName) {
      return NextResponse.json({ error: "Lettre invalide" }, { status: 400 });
    }

    const html = buildHtml(letter);

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Calcul du scale pour fit A4 (même logique que CV)
    const contentHeight = await page.evaluate(() => {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
    });
    const A4_USABLE_HEIGHT_PX = 1017;
    const naturalScale = A4_USABLE_HEIGHT_PX / contentHeight;
    const finalScale = Math.max(0.7, Math.min(1.1, naturalScale));

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      scale: finalScale,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });

    const fileName = `Lettre-${letter.fullName.replace(/\s+/g, "-") || "motivation"}.pdf`;

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/letter-pdf] generation failed:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn("[api/letter-pdf] browser.close() failed:", closeErr);
      }
    }
  }
}
