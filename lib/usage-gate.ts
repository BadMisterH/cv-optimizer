import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";

// Cookie unique partagé entre CV et Lettre — 1 seul essai gratuit global
export const ANON_COOKIE_NAME = "anon_used";
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export type UsageGateResult =
  | {
      allowed: true;
      isAuthenticated: false;
      cookieToSet?: string;
    }
  | {
      allowed: true;
      isAuthenticated: true;
      userId: string;
      isAdmin: boolean;
    }
  | {
      allowed: false;
      redirect: string;
      reason: "anon_limit" | "no_credits";
    };

/**
 * Décide si la requête peut générer.
 * - requireAuth=true : les anonymes sont redirigés vers /sign-up (pas d'essai gratuit)
 * - requireAuth=false (défaut) : Anon, 1er essai → allowed + cookie à set ; suivant → bloqué
 * - Connecté, credits > 0 → allowed (déduction faite par deductCredit après succès)
 * - Connecté, credits = 0 → bloqué, redirect /buy-credits
 */
export async function checkUsageGate(
  req: Request,
  opts: { requireAuth?: boolean; anonRedirectPath?: string } = {}
): Promise<UsageGateResult> {
  const session = await auth.api.getSession({ headers: req.headers });

  if (session?.user) {
    const userId = session.user.id;

    // Admin → bypass complet : pas de check, pas de déduction
    if (isAdminEmail(session.user.email)) {
      return { allowed: true, isAuthenticated: true, userId, isAdmin: true };
    }

    const result = await pool.query<{ credits: number }>(
      'SELECT credits FROM "user" WHERE id = $1',
      [userId]
    );
    const credits = result.rows[0]?.credits ?? 0;
    if (credits <= 0) {
      return {
        allowed: false,
        redirect: "/buy-credits",
        reason: "no_credits",
      };
    }
    return { allowed: true, isAuthenticated: true, userId, isAdmin: false };
  }

  if (opts.requireAuth) {
    const path = opts.anonRedirectPath ?? "/";
    return {
      allowed: false,
      redirect: `/sign-up?redirect=${encodeURIComponent(path)}`,
      reason: "anon_limit",
    };
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const hasUsed = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${ANON_COOKIE_NAME}=`));

  if (hasUsed) {
    return {
      allowed: false,
      redirect: `/sign-up?redirect=${encodeURIComponent("/")}`,
      reason: "anon_limit",
    };
  }

  return { allowed: true, isAuthenticated: false, cookieToSet: ANON_COOKIE_NAME };
}

/**
 * Déduit 1 crédit de manière atomique. À appeler APRÈS une génération réussie.
 * Renvoie le nouveau solde, ou null si race condition (déjà à 0).
 */
export async function deductCredit(userId: string): Promise<number | null> {
  const result = await pool.query<{ credits: number }>(
    'UPDATE "user" SET credits = credits - 1 WHERE id = $1 AND credits > 0 RETURNING credits',
    [userId]
  );
  return result.rows[0]?.credits ?? null;
}

export async function getCredits(userId: string): Promise<number> {
  const result = await pool.query<{ credits: number }>(
    'SELECT credits FROM "user" WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.credits ?? 0;
}
