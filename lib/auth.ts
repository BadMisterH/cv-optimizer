import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { pool } from "./db";
import { claimWelcomeBonus } from "./welcome-bonus";
import { sendEmail, buildEmailHtml } from "./email";

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

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

async function sendWelcomeEmail(email: string) {
  const siteUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.BETTER_AUTH_URL ?? "https://cv-optimizer.fr";
  await sendEmail({
    to: email,
    subject: "2 crédits offerts — bienvenue sur CV Optimizer",
    fallbackLabel: "WELCOME EMAIL",
    html: buildEmailHtml({
      title: "Tu as 2 crédits gratuits.",
      intro:
        "Bienvenue sur CV Optimizer ! Ton compte est actif et tu disposes de 2 crédits offerts pour commencer. Utilise-les pour optimiser ton CV face à une offre d'emploi ou générer une lettre de motivation.",
      ctaLabel: "Optimiser mon CV maintenant",
      url: `${siteUrl}/optimiser`,
      footer:
        "Tu reçois cet email car tu viens de créer un compte sur cv-optimizer.fr. Aucune action requise si tu n'es pas à l'origine de cette inscription.",
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

const productionUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

const BASE_URL =
  process.env.BETTER_AUTH_URL ??
  (productionUrl ? `https://${productionUrl}` : "http://localhost:3000");

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
  // Rate limit interne de better-auth désactivé — on s'appuie sur proxy.ts
  // (plus de contrôle, et évite un conflit d'init constaté en dev avec Next 16).
  user: {
    additionalFields: {
      credits: {
        type: "number",
        defaultValue: 0,
        required: false,
        input: false, // empêche un user de set ses propres crédits à l'inscription
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Après création du user, on tente de réclamer le bonus de bienvenue.
        // Si l'email a déjà bénéficié du bonus (compte supprimé puis recréé),
        // on remet le solde à 0 — anti-fraude.
        after: async (user) => {
          const email = typeof user.email === "string" ? user.email : null;
          if (!email) return;
          try {
            const granted = await claimWelcomeBonus(user.id, email);
            if (!granted) {
              console.log(
                `[welcome-bonus] email déjà consommé pour ${user.id} → credits=0`
              );
            } else {
              // Nouveau compte : envoyer l'email de bienvenue (non bloquant)
              sendWelcomeEmail(email).catch((err) =>
                console.error("[welcome-email] échec envoi:", err)
              );
            }
          } catch (err) {
            console.error("[welcome-bonus] échec claim:", err);
            // On ne bloque pas l'inscription si la table est inaccessible
          }
        },
      },
    },
  },
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
