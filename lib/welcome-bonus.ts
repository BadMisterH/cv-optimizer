import crypto from "node:crypto";
import { pool } from "@/lib/db";

export const WELCOME_BONUS_CREDITS = 2;

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
 * Tente de marquer l'email comme ayant consommé le bonus et crédite l'utilisateur
 * en conséquence, dans une seule transaction (claim + crédit atomiques).
 * - Renvoie `true` si c'est la première fois : l'utilisateur reçoit WELCOME_BONUS_CREDITS crédits.
 * - Renvoie `false` si l'email était déjà dans la table (compte supprimé puis recréé) :
 *   le solde est remis à 0, anti-fraude.
 *
 * Le claim (INSERT ... ON CONFLICT) et le crédit sont dans la même transaction,
 * donc pas de race condition ni d'état incohérent entre les deux.
 */
export async function claimWelcomeBonus(
  userId: string,
  email: string
): Promise<boolean> {
  const hash = hashEmail(email);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ email_hash: string }>(
      `INSERT INTO consumed_signup_bonuses (email_hash) VALUES ($1)
       ON CONFLICT (email_hash) DO NOTHING
       RETURNING email_hash`,
      [hash]
    );
    const granted = (result.rowCount ?? 0) > 0;
    await client.query('UPDATE "user" SET credits = $1 WHERE id = $2', [
      granted ? WELCOME_BONUS_CREDITS : 0,
      userId,
    ]);
    await client.query("COMMIT");
    return granted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
