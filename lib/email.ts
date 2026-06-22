export function buildEmailHtml(opts: {
  title: string;
  intro: string;
  ctaLabel: string;
  url: string;
  footer: string;
}): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#fbfaf6;padding:32px;color:#0f0f10;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:32px;border-top:3px solid #1f4bff;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.4px;">${opts.title}</h1>
    <p style="margin:0 0 24px;line-height:1.55;font-size:15px;">${opts.intro}</p>
    <a href="${opts.url}" style="display:inline-block;background:#0f0f10;color:#fbfaf6;padding:14px 24px;text-decoration:none;font-weight:500;font-size:14px;">${opts.ctaLabel} →</a>
    <p style="margin:32px 0 0;line-height:1.55;font-size:12px;color:#5d5b56;">${opts.footer}</p>
    <p style="margin:8px 0 0;line-height:1.55;font-size:11px;color:#a09d94;font-family:monospace;">${opts.url}</p>
  </div>
</body></html>`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fallbackLabel: string;
}) {
  const defaultFrom = "CV Optimizer <onboarding@resend.dev>";
  const configuredFrom = process.env.RESEND_FROM?.trim() || defaultFrom;

  if (!process.env.RESEND_API_KEY) {
    const msg = `RESEND_API_KEY non configurée. Impossible d'envoyer ${opts.fallbackLabel}.`;
    console.error(msg);
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.log("\n========================================");
    console.log(`📧 ${opts.fallbackLabel} (Resend non configuré)`);
    console.log(`   To: ${opts.to}`);
    console.log(`   Subject: ${opts.subject}`);
    console.log(`   HTML: ${opts.html}`);
    console.log("========================================\n");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  async function trySend(fromAddress: string) {
    return resend.emails.send({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  }

  try {
    await trySend(configuredFrom);
    console.log(
      `[${opts.fallbackLabel}] Email envoyé à ${opts.to} via Resend from=${configuredFrom}`
    );
  } catch (firstError) {
    console.error(`[${opts.fallbackLabel}] Erreur Resend avec from=${configuredFrom}:`, firstError);
    if (configuredFrom !== defaultFrom) {
      try {
        console.log(`[${opts.fallbackLabel}] Réessai avec from=${defaultFrom}`);
        await trySend(defaultFrom);
        console.log(
          `[${opts.fallbackLabel}] Email envoyé à ${opts.to} via Resend from=${defaultFrom}`
        );
        return;
      } catch (secondError) {
        console.error(
          `[${opts.fallbackLabel}] Échec du réessai Resend avec from=${defaultFrom}:`,
          secondError
        );
      }
    }
    const message = firstError instanceof Error ? firstError.message : String(firstError);
    throw new Error(`Échec envoi email (${opts.fallbackLabel}): ${message}`);
  }
}
