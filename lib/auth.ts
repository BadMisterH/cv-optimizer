import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL n'est pas configurée. Ajoute la connection string Supabase dans .env.local."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

async function sendResetPasswordEmail(email: string, url: string) {
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "CV Optimizer <onboarding@resend.dev>",
      to: email,
      subject: "Réinitialise ton mot de passe — CV Optimizer",
      html: `<!doctype html><html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#fbfaf6;padding:32px;color:#0f0f10;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:32px;border-top:3px solid #1f4bff;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.4px;">Réinitialisation</h1>
    <p style="margin:0 0 16px;line-height:1.55;font-size:15px;">Salut, on a reçu une demande de réinitialisation de mot de passe pour ton compte CV Optimizer.</p>
    <p style="margin:0 0 24px;line-height:1.55;font-size:15px;">Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe (lien valable 1h).</p>
    <a href="${url}" style="display:inline-block;background:#0f0f10;color:#fbfaf6;padding:14px 24px;text-decoration:none;font-weight:500;font-size:14px;">Réinitialiser mon mot de passe →</a>
    <p style="margin:32px 0 0;line-height:1.55;font-size:12px;color:#5d5b56;">Si tu n'as pas demandé ça, ignore cet email — ton mot de passe actuel reste inchangé.</p>
    <p style="margin:8px 0 0;line-height:1.55;font-size:11px;color:#a09d94;font-family:monospace;">${url}</p>
  </div>
</body></html>`,
    });
  } else {
    // Dev fallback : la clé Resend n'est pas configurée
    console.log("\n========================================");
    console.log("📧 PASSWORD RESET (Resend non configuré)");
    console.log(`   To: ${email}`);
    console.log(`   URL: ${url}`);
    console.log("========================================\n");
  }
}

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1h
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
