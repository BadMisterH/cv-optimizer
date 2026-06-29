import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  grantCreditsForStripeCheckoutSession,
  StripeCreditError,
} from "@/lib/stripe-crediting";

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
  try {
    const result = await grantCreditsForStripeCheckoutSession(session);

    if (result.status === "not_paid") {
      console.warn(
        `[webhook/stripe] session ${result.stripeSessionId} not paid (status=${session.payment_status})`
      );
      return NextResponse.json({ received: true });
    }

    if (result.status === "duplicate") {
      console.log(
        `[webhook/stripe] session ${result.stripeSessionId} déjà traitée, skip`
      );
      return NextResponse.json({ received: true, duplicate: true });
    }

    console.log(
      `[webhook/stripe] +${result.credits} crédits pour user=${result.userId} (session=${result.stripeSessionId})`
    );
  } catch (err) {
    if (err instanceof StripeCreditError && err.status < 500) {
      console.error("[webhook/stripe] metadata invalides:", err.message);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("[webhook/stripe] échec créditation:", err);
    return NextResponse.json({ error: "Échec créditation" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
