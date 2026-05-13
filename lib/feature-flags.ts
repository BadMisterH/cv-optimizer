/**
 * Flags pour activer/désactiver des features.
 * Mets à `true` quand le setup côté tiers (Stripe, etc.) est complet.
 */

// Mets à `true` quand :
//   1. Les Products + Prices sont créés dans le Dashboard Stripe
//   2. Les env vars STRIPE_* sont configurées sur Vercel
//   3. Le webhook Stripe pointe vers https://www.cv-optimizer.fr/api/webhooks/stripe
//   4. La migration SQL `purchases` est appliquée
export const STRIPE_ENABLED = false;
