import { NextResponse } from "next/server";
import { EventName, type TransactionCompletedEvent } from "@paddle/paddle-node-sdk";
import { getPaddle } from "@/lib/paddle";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/paddle] PADDLE_WEBHOOK_SECRET non configurée");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }

  const signature = req.headers.get("paddle-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature absente" }, { status: 400 });
  }

  const rawBody = await req.text();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let eventData: any;
  try {
    eventData = await getPaddle().webhooks.unmarshal(rawBody, webhookSecret, signature);
  } catch (err) {
    console.error("[webhook/paddle] signature invalide:", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (eventData.eventType !== EventName.TransactionCompleted) {
    return NextResponse.json({ received: true });
  }

  const tx = (eventData as TransactionCompletedEvent).data;
  const customData = tx.customData as Record<string, string> | null;
  const userId = customData?.userId;
  const credits = Number(customData?.credits ?? 0);
  const pack = customData?.pack;
  const transactionId = tx.id;
  const amount = Number(tx.details?.totals?.grandTotal ?? 0);
  const currency = (tx.currencyCode ?? "EUR").toLowerCase();

  if (!userId || !credits || !pack || !transactionId) {
    console.error("[webhook/paddle] données manquantes:", customData);
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertResult = await client.query(
      `INSERT INTO purchases (user_id, stripe_session_id, pack, credits, amount_cents, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (stripe_session_id) DO NOTHING
       RETURNING id`,
      [userId, transactionId, pack, credits, amount, currency]
    );

    if (insertResult.rowCount === 0) {
      await client.query("ROLLBACK");
      console.log(`[webhook/paddle] transaction ${transactionId} déjà traitée, skip`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    await client.query(
      'UPDATE "user" SET credits = credits + $1 WHERE id = $2',
      [credits, userId]
    );

    await client.query("COMMIT");
    console.log(
      `[webhook/paddle] +${credits} crédits pour user=${userId} (tx=${transactionId})`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[webhook/paddle] échec créditation:", err);
    return NextResponse.json({ error: "Échec créditation" }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ received: true });
}
