/**
 * Flags pour activer/désactiver des features.
 *
 * Stripe est désormais ACTIVÉ. Le système est garde-fou'é côté serveur :
 * si les env vars (STRIPE_SECRET_KEY, STRIPE_PRICE_*, STRIPE_WEBHOOK_SECRET)
 * sont manquantes sur Vercel, /api/checkout renvoie un 503 propre au lieu
 * de crash, et l'UI affiche l'erreur. Une fois les env vars renseignées
 * sur Vercel, le paiement fonctionne sans redéploiement.
 */
export const STRIPE_ENABLED = false;

/**
 * Visibilité publique du pricing sur la landing (lien "Tarifs" + section).
 */
export const PRICING_PUBLIC = false;

/**
 * Server-side check : tous les env vars Stripe nécessaires sont-ils présents ?
 * À appeler dans les routes /api/checkout et /api/webhooks/stripe pour fail-fast
 * proprement si la config est incomplète.
 */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_STARTER &&
      process.env.STRIPE_PRICE_PRO &&
      process.env.STRIPE_PRICE_PREMIUM
  );
}
