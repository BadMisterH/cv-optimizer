/**
 * Source de vérité des packs de crédits.
 * Utilisée par la page /buy-credits ET l'API /api/checkout.
 */
export const PACKS = {
  starter: {
    label: "Starter",
    credits: 5,
    launchBonusCredits: 2,
    price: "4,99 €",
    amountCents: 499,
  },
  pro: {
    label: "Pro",
    credits: 15,
    launchBonusCredits: 6,
    price: "11,99 €",
    amountCents: 1199,
    featured: true,
  },
  premium: {
    label: "Premium",
    credits: 50,
    launchBonusCredits: 20,
    price: "24,99 €",
    amountCents: 2499,
  },
} as const;

export type PackKey = keyof typeof PACKS;

export const LAUNCH_OFFER = {
  enabled: true,
  label: "Offre de lancement",
  headline: "+40% de crédits offerts",
  endsAt: "2026-08-01T00:00:00+02:00",
  endsOnLabel: "31 juillet",
} as const;

export function isLaunchOfferActive(now = new Date()): boolean {
  if (!LAUNCH_OFFER.enabled) return false;
  const endTime = Date.parse(LAUNCH_OFFER.endsAt);
  return Number.isFinite(endTime) ? now.getTime() < endTime : true;
}

export function getPackBonusCredits(pack: PackKey, now = new Date()): number {
  return isLaunchOfferActive(now) ? PACKS[pack].launchBonusCredits : 0;
}

export function getPackTotalCredits(pack: PackKey, now = new Date()): number {
  return PACKS[pack].credits + getPackBonusCredits(pack, now);
}

export function isPackKey(value: string): value is PackKey {
  return value in PACKS;
}

/**
 * Map pack → variable d'env contenant le `price_id` Stripe correspondant.
 * Les valeurs sont créées dans le Dashboard Stripe (Products → Prices).
 */
export const PACK_PRICE_ENV: Record<PackKey, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  premium: "STRIPE_PRICE_PREMIUM",
};
