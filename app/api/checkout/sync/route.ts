import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  grantCreditsForStripeCheckoutSession,
  StripeCreditError,
} from "@/lib/stripe-crediting";
import { requireVerifiedSession } from "@/lib/auth-verification";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { session, response } = await requireVerifiedSession(req);
  if (response) {
    if (response.status === 401) {
      return NextResponse.json(
        { error: "Tu dois être connecté pour synchroniser ce paiement." },
        { status: 401 }
      );
    }
    return response;
  }

  if (!session?.user) {
    return NextResponse.json(
      { error: "Tu dois être connecté pour synchroniser ce paiement." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return NextResponse.json(
      { error: "Session Stripe invalide." },
      { status: 400 }
    );
  }

  try {
    const checkoutSession = await getStripe().checkout.sessions.retrieve(sessionId);
    const result = await grantCreditsForStripeCheckoutSession(checkoutSession, {
      expectedUserId: session.user.id,
    });

    if (result.status === "not_paid") {
      return NextResponse.json(
        { error: "Le paiement Stripe n'est pas confirmé." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      credits: result.credits,
      balance: result.balance,
    });
  } catch (err) {
    if (err instanceof StripeCreditError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      );
    }

    const stripeErr = err as { type?: string; statusCode?: number };
    if (stripeErr?.type === "StripeInvalidRequestError") {
      return NextResponse.json(
        { error: "Session Stripe introuvable." },
        { status: 404 }
      );
    }

    console.error("[api/checkout/sync] failed:", err);
    return NextResponse.json(
      { error: "Impossible de synchroniser le paiement." },
      { status: 500 }
    );
  }
}
