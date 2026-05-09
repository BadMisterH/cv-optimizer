import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

// Pool créé même sans DATABASE_URL pour ne pas casser `next build`
// (la validation des env vars se fait au runtime via les routes).
// Si DATABASE_URL est absent à l'exécution, pg renverra une erreur de connexion claire.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

function buildEmailHtml(opts: {
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

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fallbackLabel: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log("\n========================================");
    console.log(`📧 ${opts.fallbackLabel} (Resend non configuré)`);
    console.log(`   To: ${opts.to}`);
    console.log(`   Subject: ${opts.subject}`);
    console.log("========================================\n");
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "CV Optimizer <onboarding@resend.dev>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (result.error) {
    console.error(`[${opts.fallbackLabel}] Resend error:`, result.error);
    throw new Error(result.error.message ?? "Échec envoi email");
  }
}

async function sendResetPasswordEmail(email: string, url: string) {
  await sendEmail({
    to: email,
    subject: "Réinitialise ton mot de passe — CV Optimizer",
    fallbackLabel: "PASSWORD RESET",
    html: buildEmailHtml({
      title: "Réinitialisation",
      intro:
        "On a reçu une demande de réinitialisation pour ton compte CV Optimizer. Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe (lien valable 1h).",
      ctaLabel: "Réinitialiser mon mot de passe",
      url,
      footer:
        "Si tu n'as pas demandé ça, ignore cet email — ton mot de passe actuel reste inchangé.",
    }),
  });
}

async function sendVerificationEmail(email: string, url: string) {
  await sendEmail({
    to: email,
    subject: "Confirme ton email — CV Optimizer",
    fallbackLabel: "EMAIL VERIFICATION",
    html: buildEmailHtml({
      title: "Bienvenue sur CV Optimizer",
      intro:
        "Plus qu'une étape : confirme ton adresse email en cliquant sur le bouton ci-dessous. Tu seras connecté automatiquement.",
      ctaLabel: "Confirmer mon email",
      url,
      footer:
        "Si tu n'as pas créé ce compte, ignore simplement ce message.",
    }),
  });
}

const BASE_URL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const isDev = process.env.NODE_ENV !== "production";

// Origines statiques toujours acceptées (prod + preview Vercel)
const staticOrigins: string[] = [BASE_URL];
if (process.env.VERCEL_URL) {
  staticOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  staticOrigins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

// En dev, on accepte aussi l'origine d'où vient la requête
// (localhost:autre-port, IP LAN type 192.168.x.x, etc.)
const trustedOriginsConfig = isDev
  ? (req?: Request) => {
      const origin = req?.headers.get("origin");
      return origin ? [...staticOrigins, origin] : staticOrigins;
    }
  : staticOrigins;

export const auth = betterAuth({
  database: pool,
  baseURL: BASE_URL,
  trustedOrigins: trustedOriginsConfig,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1h
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1h
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies()],
});

export const config = {
  googleEnabled,
};
