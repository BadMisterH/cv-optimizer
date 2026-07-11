# Essai gratuit 7 jours avec CB requise → abonnement récurrent

Date : 2026-07-12
Statut : validé (brainstorming), en attente de plan d'implémentation

## 1. Contexte et objectif

Aujourd'hui, `cv-optimizer` fonctionne uniquement en **packs de crédits one-shot** (`lib/stripe-packs.ts`, Stripe Checkout `mode: "payment"`). Le seul mécanisme gratuit existant est le welcome bonus signup-gated (1 crédit, anti-fraude par hash email — `lib/welcome-bonus.ts`).

Objectif : ajouter un nouveau parcours d'acquisition **coexistant** avec les packs actuels — un essai gratuit de 7 jours nécessitant une carte bancaire dès l'inscription, avec bascule automatique vers un abonnement mensuel récurrent si l'utilisateur n'annule pas avant la fin de l'essai.

Ce document ne couvre que ce nouveau parcours. Les packs one-shot existants ne sont pas modifiés.

## 2. Paramètres produit

| Paramètre | Valeur |
|---|---|
| Durée d'essai | 7 jours |
| Crédits offerts pendant l'essai | 5 |
| Prix après essai | 11,99 €/mois |
| Crédits accordés à chaque renouvellement mensuel | 15 |
| CB requise dès le départ | Oui (bloquant, obligatoire pour démarrer l'essai) |
| Résiliation | Libre, à tout moment, via Stripe Customer Portal |
| Coexistence avec les packs one-shot | Oui — les deux options restent visibles sur `/buy-credits` |

### Pourquoi 5 crédits et non 15 (alignement pack Pro) ?

Exposition financière : au tarif mesuré (~0,23–0,35 $/génération, cf. mémoire `business-model-state`), offrir 15 crédits gratuits exposerait jusqu'à ~5,25 € de coût API par personne qui annule avant J7, sans aucun revenu en face — un risque significativement plus élevé que le welcome bonus actuel (1 crédit, ~0,35 $ d'exposition). 5 crédits ramène l'exposition max à ~1,75 € tout en restant suffisant pour tester sérieusement l'outil (5 CV/lettres), et le tarif de reconduction (11,99€/15 crédits) reste aligné sur le pack Pro existant.

## 3. Approche technique retenue

**Stripe Checkout, `mode: "subscription"`, avec `subscription_data.trial_period_days: 7`.**

Alternatives écartées :
- *SetupIntent + charge manuelle via cron à J+7* : réimplémente ce que Stripe fait déjà nativement (dunning, retries, emails de rappel), avec un point de défaillance supplémentaire (fiabilité du cron).
- *Stripe Elements embarqué* : contrôle du branding du formulaire de paiement, mais surface de code/tests bien plus large (3D Secure, erreurs de carte) pour un gain mineur, alors que le Checkout hosté est déjà le pattern en place pour les packs.

Stripe Checkout en mode `subscription` collecte la carte par défaut (comportement natif, pas de configuration `payment_method_collection` à changer), gère le décompte de l'essai, la facturation automatique à J+7, les relances (Smart Retries) en cas d'échec de paiement, l'email natif "trial ending soon", et le Customer Portal pour la résiliation — sans logique de facturation custom à écrire.

## 4. Modèle de données

Trois nouvelles tables Postgres (Supabase), sur le modèle des tables `purchases` / `consumed_signup_bonuses` existantes :

```sql
CREATE TABLE consumed_trial_subscriptions (
  email_hash TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,               -- trialing | active | past_due | canceled
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subscription_invoices (
  stripe_invoice_id TEXT PRIMARY KEY,  -- idempotence (comme stripe_session_id sur purchases)
  user_id TEXT NOT NULL REFERENCES "user"(id),
  credits INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

`consumed_trial_subscriptions` réutilise `hashEmail()` exportée de `lib/welcome-bonus.ts` (normalisation anti-alias `+tag` / points Gmail déjà en place — ne pas dupliquer cette logique).

Pas de clawback de crédits si l'abonnement passe à `canceled` ou `past_due` : les crédits déjà accordés restent utilisables (cohérent avec le modèle actuel où les crédits n'expirent pas).

## 5. Anti-fraude — vérification en amont, pas seulement au webhook

Point critique : l'éligibilité (email non présent dans `consumed_trial_subscriptions`) doit être vérifiée **dans la route API, avant la création de la session Stripe** — pas seulement lors du claim au webhook.

Raison : si un utilisateur qui a déjà consommé un essai relance le parcours, sa session Checkout se créerait quand même (Stripe ne connaît rien de notre anti-fraude), sa carte serait enregistrée sur un nouvel abonnement Stripe, et à J+7 il serait **prélevé sans avoir reçu les 5 crédits gratuits** (le claim webhook échouerait silencieusement via `ON CONFLICT DO NOTHING`). Il faut donc bloquer *avant* : `POST /api/checkout-trial` vérifie le hash email en premier et renvoie `403` avec un message clair ("Tu as déjà utilisé ton essai gratuit — choisis un pack ou abonne-toi directement.") si déjà consommé.

## 6. Nouvelle route API : `app/api/checkout-trial/route.ts`

Miroir de `app/api/checkout/route.ts` existant (mêmes garde-fous `STRIPE_ENABLED`/`isStripeConfigured`, même pattern `requireVerifiedSession`, même mapping d'erreurs Stripe vers messages utilisateur) :

1. Vérifie `STRIPE_ENABLED` / `isStripeConfigured()`
2. Vérifie la session (`requireVerifiedSession`), 401 si non connecté
3. Vérifie l'anti-fraude (`hashEmail` + lookup `consumed_trial_subscriptions`), 403 si déjà consommé
4. Crée la session Stripe Checkout :
   - `mode: "subscription"`
   - `line_items: [{ price: process.env.STRIPE_PRICE_PRO_MONTHLY, quantity: 1 }]`
   - `subscription_data: { trial_period_days: 7 }`
   - `customer_email: session.user.email`
   - `metadata: { userId, type: "trial" }`
   - `success_url` / `cancel_url` vers `/buy-credits`
5. Retourne `{ url: checkoutSession.url }`

Nouveau Price Stripe à créer manuellement dans le Dashboard (Products → Prices) : `STRIPE_PRICE_PRO_MONTHLY`, 11,99 €/mois récurrent — **distinct** du prix one-shot `STRIPE_PRICE_PRO` déjà utilisé par les packs (un Price Stripe est soit récurrent soit one-shot, jamais les deux).

## 7. Webhook — nouveaux event handlers

Dans `app/api/webhooks/stripe/route.ts`, à côté du handler existant `checkout.session.completed` (mode payment, packs) :

- **`checkout.session.completed`** (branche mode `subscription`, discriminée par `session.mode === "subscription"` — les sessions de packs one-shot restent `mode === "payment"`) :
  claim atomique dans `consumed_trial_subscriptions` (même pattern transactionnel que `claimWelcomeBonus` : `INSERT ... ON CONFLICT DO NOTHING` + crédit dans la même transaction) → si claim réussi, crédite 5 crédits et upsert une ligne `subscriptions` (`status: "trialing"`, `stripe_customer_id`, `stripe_subscription_id`). Si claim échoué (déjà consommé malgré la vérification amont — race condition ou contournement), ne crédite rien et logue une alerte.

- **`invoice.paid`** avec `billing_reason === "subscription_cycle"` (renouvellements récurrents, exclut la facture initiale d'essai à 0€) :
  insert idempotent dans `subscription_invoices` (clé `stripe_invoice_id`) → si nouvelle ligne, crédite 15 crédits à l'utilisateur associé.

- **`customer.subscription.updated`** et **`customer.subscription.deleted`** :
  met à jour `status`/`current_period_end` dans `subscriptions`. Aucune reprise de crédits.

## 8. UI

- **`/buy-credits`** : 4ᵉ carte "Essai gratuit 7 jours" à côté des 3 packs existants. Mention claire et non-trompeuse en petit texte : "Carte bancaire requise. 5 crédits offerts pendant 7 jours, puis 11,99€/mois pour 15 crédits. Résiliable à tout moment avant la fin de l'essai pour ne rien payer."
- **Nouvelle route `app/api/customer-portal/route.ts`** : crée une session Stripe Billing Portal (`stripe.billingPortal.sessions.create({ customer, return_url })`) pour l'utilisateur connecté ayant une ligne active dans `subscriptions`.
- Lien "Gérer mon abonnement" affiché sur la page compte utilisateur si une ligne `subscriptions` existe pour cet utilisateur, pointant vers cette nouvelle route.

## 9. Gestion d'erreurs

Réutilise les garde-fous et le mapping d'erreurs Stripe déjà en place dans `app/api/checkout/route.ts` (`STRIPE_ENABLED`, `isStripeConfigured()`, mapping `StripeInvalidRequestError`/`StripeAuthenticationError`/`StripeConnectionError` vers messages utilisateur non techniques).

Échec de paiement à J+7 : géré nativement par Stripe (Smart Retries), pas de code custom. Si tous les retries échouent, Stripe passe l'abonnement à `canceled`, capté par le handler `customer.subscription.deleted`.

## 10. Tests

- Unitaires : claim anti-fraude (`consumed_trial_subscriptions`, cas premier claim / cas doublon), parsing des nouveaux webhook handlers (mock `invoice.paid` avec/sans `billing_reason=subscription_cycle`, `checkout.session.completed` mode subscription, `customer.subscription.deleted`).
- Manuel : Stripe **test clocks** (mode test) pour simuler le passage J0 → J7 sans attendre 7 jours réels, vérifier la facturation automatique et le crédit des 15 crédits.

## 11. Hors scope

- Modification ou suppression des packs one-shot existants.
- Emails de rappel custom (l'email natif Stripe "trial ending soon" suffit pour ce scope).
- Gating de fonctionnalités basé sur le statut d'abonnement (les crédits déjà accordés restent utilisables même après annulation/expiration).
- Offres de rétention à l'annulation (le Customer Portal gère l'annulation sans friction additionnelle).
