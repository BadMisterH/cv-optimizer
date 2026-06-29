import type Stripe from "stripe";
import { pool } from "./db";
import { isPackKey, type PackKey } from "./stripe-packs";

export type StripeCreditGrantResult = {
  status: "credited" | "duplicate" | "not_paid";
  credits: number;
  balance: number | null;
  stripeSessionId: string;
  userId: string;
};

export class StripeCreditError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "StripeCreditError";
    this.code = code;
    this.status = status;
  }
}

type CheckoutCreditPayload = {
  userId: string;
  credits: number;
  pack: PackKey;
  amount: number;
  currency: string;
  stripeSessionId: string;
};

function getCheckoutCreditPayload(
  session: Stripe.Checkout.Session,
  expectedUserId?: string
): CheckoutCreditPayload {
  const userId = session.metadata?.userId;
  const credits = Number(session.metadata?.credits ?? 0);
  const pack = session.metadata?.pack;

  if (!userId) {
    throw new StripeCreditError("missing_user_id", "Metadata userId manquante.");
  }

  if (expectedUserId && userId !== expectedUserId) {
    throw new StripeCreditError(
      "user_mismatch",
      "Cette session Stripe ne correspond pas à l'utilisateur connecté.",
      403
    );
  }

  if (!Number.isInteger(credits) || credits <= 0) {
    throw new StripeCreditError("invalid_credits", "Metadata credits invalide.");
  }

  if (!pack || !isPackKey(pack)) {
    throw new StripeCreditError("invalid_pack", "Metadata pack invalide.");
  }

  return {
    userId,
    credits,
    pack,
    amount: session.amount_total ?? 0,
    currency: (session.currency ?? "eur").toLowerCase(),
    stripeSessionId: session.id,
  };
}

export async function grantCreditsForStripeCheckoutSession(
  session: Stripe.Checkout.Session,
  opts: { expectedUserId?: string } = {}
): Promise<StripeCreditGrantResult> {
  const payload = getCheckoutCreditPayload(session, opts.expectedUserId);

  if (session.payment_status !== "paid") {
    return {
      status: "not_paid",
      credits: payload.credits,
      balance: null,
      stripeSessionId: payload.stripeSessionId,
      userId: payload.userId,
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertResult = await client.query<{ id: number }>(
      `INSERT INTO purchases (user_id, stripe_session_id, pack, credits, amount_cents, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (stripe_session_id) DO NOTHING
       RETURNING id`,
      [
        payload.userId,
        payload.stripeSessionId,
        payload.pack,
        payload.credits,
        payload.amount,
        payload.currency,
      ]
    );

    if (insertResult.rowCount === 0) {
      const balanceResult = await client.query<{ credits: number }>(
        'SELECT credits FROM "user" WHERE id = $1',
        [payload.userId]
      );
      await client.query("COMMIT");

      return {
        status: "duplicate",
        credits: payload.credits,
        balance: balanceResult.rows[0]?.credits ?? null,
        stripeSessionId: payload.stripeSessionId,
        userId: payload.userId,
      };
    }

    const updateResult = await client.query<{ credits: number }>(
      'UPDATE "user" SET credits = credits + $1 WHERE id = $2 RETURNING credits',
      [payload.credits, payload.userId]
    );

    if (updateResult.rowCount === 0) {
      throw new StripeCreditError(
        "user_not_found",
        "Utilisateur introuvable pendant la créditation.",
        500
      );
    }

    await client.query("COMMIT");

    return {
      status: "credited",
      credits: payload.credits,
      balance: updateResult.rows[0]?.credits ?? null,
      stripeSessionId: payload.stripeSessionId,
      userId: payload.userId,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
