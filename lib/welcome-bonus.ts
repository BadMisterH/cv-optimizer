import crypto from "node:crypto";
import { pool } from "@/lib/db";

export const WELCOME_BONUS_CREDITS = 1;

/**
 * Normalise une adresse email pour la détection anti-fraude du bonus de bienvenue :
 * - lower + trim ("Foo@Bar.com" === " foo@bar.com ")
 * - retire le tag "+xxx" du local-part (alias type "user+1@gmail.com" === "user@gmail.com"),
 *   sinon il suffit de changer de tag pour réclamer le bonus à l'infini sur la même boîte.
 * - ignore les points du local-part pour gmail.com/googlemail.com (Gmail les ignore aussi).
 */
function normalizeEmailForFraudCheck(email: string): string {
  const trimmed = email.toLowerCase().trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return trimmed;

  let local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  const plusIndex = local.indexOf("+");
  if (plusIndex !== -1) local = local.slice(0, plusIndex);

  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
  }

  return `${local}@${domain}`;
}

/**
 * Hash anonyme d'une adresse email pour la table consumed_signup_bonuses.
 */
export function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizeEmailForFraudCheck(email))
    .digest("hex");
}

/**
 * Tente de marquer l'email comme ayant consommé le bonus et crédite l'utilisateur
 * en conséquence, dans une seule transaction (claim + crédit atomiques).
 * - Renvoie `true` si c'est la première fois : l'utilisateur reçoit WELCOME_BONUS_CREDITS crédits.
 * - Renvoie `false` si l'email était déjà dans la table (compte supprimé puis recréé) :
 *   aucun crédit n'est ajouté, anti-fraude.
 *
 * Le claim (INSERT ... ON CONFLICT) et l'ajout de crédits sont dans la même transaction,
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
    if (granted) {
      await client.query('UPDATE "user" SET credits = credits + $1 WHERE id = $2', [
        WELCOME_BONUS_CREDITS,
        userId,
      ]);
    }
    await client.query("COMMIT");
    return granted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
