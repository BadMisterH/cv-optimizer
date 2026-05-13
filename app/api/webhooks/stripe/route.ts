import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET non configurée");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature absente" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook/stripe] signature invalide:", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // On ignore les autres events sans erreur (200 OK pour que Stripe arrête de retry)
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const credits = Number(session.metadata?.credits ?? 0);
  const pack = session.metadata?.pack;
  const amount = session.amount_total ?? 0;
  const currency = (session.currency ?? "eur").toLowerCase();
  const stripeSessionId = session.id;

  if (!userId || !credits || !pack) {
    console.error("[webhook/stripe] metadata manquantes:", session.metadata);
    return NextResponse.json({ error: "Metadata invalides" }, { status: 400 });
  }

  if (session.payment_status !== "paid") {
    console.warn(
      `[webhook/stripe] session ${stripeSessionId} not paid (status=${session.payment_status})`
    );
    return NextResponse.json({ received: true });
  }

  // Idempotence : insertion dans purchases avec session_id UNIQUE.
  // Si déjà présent → on skip la créditation (webhook rejoué par Stripe).
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertResult = await client.query(
      `INSERT INTO purchases (user_id, stripe_session_id, pack, credits, amount_cents, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (stripe_session_id) DO NOTHING
       RETURNING id`,
      [userId, stripeSessionId, pack, credits, amount, currency]
    );

    if (insertResult.rowCount === 0) {
      // Déjà traité
      await client.query("ROLLBACK");
      console.log(`[webhook/stripe] session ${stripeSessionId} déjà traitée, skip`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    await client.query(
      'UPDATE "user" SET credits = credits + $1 WHERE id = $2',
      [credits, userId]
    );

    await client.query("COMMIT");
    console.log(
      `[webhook/stripe] +${credits} crédits pour user=${userId} (session=${stripeSessionId})`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[webhook/stripe] échec créditation:", err);
    return NextResponse.json({ error: "Échec créditation" }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ received: true });
}
