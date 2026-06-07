import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPaddle } from "@/lib/paddle";
import { PADDLE_PACK_PRICE_ENV } from "@/lib/paddle-packs";
import { PACKS, isPackKey } from "@/lib/stripe-packs";
import { PADDLE_ENABLED, isPaddleConfigured } from "@/lib/feature-flags";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!PADDLE_ENABLED) {
    return NextResponse.json(
      { error: "Le paiement n'est pas encore disponible. Réessaie plus tard." },
      { status: 503 }
    );
  }
  if (!isPaddleConfigured()) {
    console.error("[api/checkout] env Paddle incomplet — vérifier les variables sur Vercel");
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
      return NextResponse.json({ error: "Pack invalide." }, { status: 400 });
    }

    const pack = PACKS[packKey];
    const priceId = process.env[PADDLE_PACK_PRICE_ENV[packKey]];
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Le pack "${pack.label}" n'est pas configuré (env var ${PADDLE_PACK_PRICE_ENV[packKey]} manquante).`,
        },
        { status: 500 }
      );
    }

    const origin =
      req.headers.get("origin") ??
      process.env.BETTER_AUTH_URL ??
      "http://localhost:3000";

    const paddle = getPaddle();
    const transaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customData: {
        userId: session.user.id,
        pack: packKey,
        credits: String(pack.credits),
      },
      checkout: {
        url: `${origin}/buy-credits?success=true`,
      },
    });

    const checkoutUrl = transaction.checkout?.url;
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Impossible de créer la session Paddle." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[api/checkout] Paddle failed:", err);

    const e = err as { code?: string; message?: string };
    let userMessage =
      "Une erreur est survenue lors de la création du paiement. Réessaie dans un instant.";
    let status = 500;

    if (e?.code === "not_found") {
      userMessage = "Le paiement est temporairement indisponible. Réessaie plus tard.";
      status = 503;
    }

    return NextResponse.json({ error: userMessage }, { status });
  }
}
