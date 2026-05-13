import crypto from "node:crypto";
import { pool } from "@/lib/db";

/**
 * Hash anonyme d'une adresse email pour la table consumed_signup_bonuses.
 * Normalise (lower + trim) pour que "Foo@Bar.com" et " foo@bar.com " hashent pareil.
 */
export function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Tente de marquer l'email comme ayant consommé le bonus.
 * - Renvoie `true` si c'est la première fois (le user mérite ses 2 crédits)
 * - Renvoie `false` si l'email était déjà dans la table (le bonus a déjà été consommé)
 *
 * L'opération est atomique via INSERT ... ON CONFLICT, donc pas de race condition.
 */
export async function claimWelcomeBonus(email: string): Promise<boolean> {
  const hash = hashEmail(email);
  const result = await pool.query<{ email_hash: string }>(
    `INSERT INTO consumed_signup_bonuses (email_hash) VALUES ($1)
     ON CONFLICT (email_hash) DO NOTHING
     RETURNING email_hash`,
    [hash]
  );
  return (result.rowCount ?? 0) > 0;
}
