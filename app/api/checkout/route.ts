import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { PACK_PRICE_ENV, PACKS, isPackKey } from "@/lib/stripe-packs";
import { STRIPE_ENABLED, isStripeConfigured } from "@/lib/feature-flags";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!STRIPE_ENABLED) {
    return NextResponse.json(
      { error: "Le paiement n'est pas encore disponible. Réessaie plus tard." },
      { status: 503 }
    );
  }
  // Garde-fou : si une env var manque, on évite le crash de la SDK Stripe
  if (!isStripeConfigured()) {
    console.error("[api/checkout] env Stripe incomplet — vérifier les variables sur Vercel");
    return NextResponse.json(
      {
        error:
          "Le paiement est temporairement indisponible (configuration en cours). Réessaie dans quelques minutes ou contacte-nous à contact@cv-optimizer.fr.",
      },
      { status: 503 }
    );
  }
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Tu dois être connecté pour acheter des crédits.",
          redirect: "/sign-in?redirect=/buy-credits",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const packKey = body?.pack;
    if (typeof packKey !== "string" || !isPackKey(packKey)) {
      return NextResponse.json(
        { error: "Pack invalide." },
        { status: 400 }
      );
    }

    const pack = PACKS[packKey];
    const priceId = process.env[PACK_PRICE_ENV[packKey]];
    if (!priceId) {
      return NextResponse.json(
        { error: `Le pack "${pack.label}" n'est pas configuré (env var ${PACK_PRICE_ENV[packKey]} manquante).` },
        { status: 500 }
      );
    }

    const origin =
      req.headers.get("origin") ??
      process.env.BETTER_AUTH_URL ??
      "http://localhost:3000";

    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id,
        pack: packKey,
        credits: String(pack.credits),
      },
      success_url: `${origin}/buy-credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/buy-credits?canceled=true`,
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Impossible de créer la session Stripe." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[api/checkout] failed:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
