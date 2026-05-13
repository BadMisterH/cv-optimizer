/**
 * Source de vérité des packs de crédits.
 * Utilisée par la page /buy-credits ET l'API /api/checkout.
 */
export const PACKS = {
  starter: {
    label: "Starter",
    credits: 5,
    price: "4,99 €",
    amountCents: 499,
  },
  standard: {
    label: "Standard",
    credits: 15,
    price: "11,99 €",
    amountCents: 1199,
    featured: true,
  },
  pro: {
    label: "Pro",
    credits: 50,
    price: "29,99 €",
    amountCents: 2999,
  },
} as const;

export type PackKey = keyof typeof PACKS;

export function isPackKey(value: string): value is PackKey {
  return value in PACKS;
}

/**
 * Map pack → variable d'env contenant le `price_id` Stripe correspondant.
 * Les valeurs sont créées dans le Dashboard Stripe (Products → Prices).
 */
export const PACK_PRICE_ENV: Record<PackKey, string> = {
  starter: "STRIPE_PRICE_STARTER",
  standard: "STRIPE_PRICE_STANDARD",
  pro: "STRIPE_PRICE_PRO",
};
