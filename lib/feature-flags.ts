/**
 * Flags pour activer/désactiver des features.
 * Mets à `true` quand le setup côté tiers (Stripe, etc.) est complet.
 */

/**
 * Contrôle l'EXÉCUTION du paiement (appel Stripe Checkout + webhook).
 *
 * Mets à `true` quand :
 *   1. Les Products + Prices sont créés dans le Dashboard Stripe
 *   2. Les env vars STRIPE_* sont configurées sur Vercel
 *   3. Le webhook Stripe pointe vers https://www.cv-optimizer.fr/api/webhooks/stripe
 *   4. La migration SQL `purchases` est appliquée
 */
export const STRIPE_ENABLED = false;

/**
 * Contrôle la VISIBILITÉ publique du pricing (landing : section Tarifs,
 * lien "Tarifs" dans le header). Indépendant de STRIPE_ENABLED.
 *
 * - `false` → grand public ne voit pas le pricing, mais /buy-credits reste
 *             accessible par URL directe (admin/preview/test).
 * - `true`  → pricing exposé sur la landing (boutons restent désactivés tant
 *             que STRIPE_ENABLED = false).
 */
export const PRICING_PUBLIC = false;
