# Essai gratuit 7 jours avec CB requise → abonnement récurrent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new acquisition path on `/buy-credits` — a 7-day free trial requiring a card upfront, granting 5 credits immediately, auto-converting to an 11,99€/month recurring subscription (15 credits/month) unless canceled before day 7 — coexisting with the existing one-shot credit packs.

**Architecture:** Stripe Checkout in `mode: "subscription"` with `subscription_data.trial_period_days`, handled by a new `/api/checkout-trial` route mirroring the existing `/api/checkout` pattern. Three new Postgres tables track anti-fraud claims, subscription lifecycle, and renewal idempotency. New webhook branches in the existing Stripe webhook route grant credits on trial start and on each paid renewal invoice. Cancellation goes through the Stripe Customer Portal — no custom cancellation UI.

**Tech Stack:** Next.js (App Router), TypeScript, `stripe` npm package v22 (verify field paths against `node_modules/stripe` — this API version moved `invoice.subscription` to `invoice.parent.subscription_details.subscription` and `subscription.current_period_end` to `subscription.items.data[0].current_period_end`, do not use training-data assumptions), raw `pg` Pool (no ORM), Vitest.

## Global Constraints

- Durée d'essai : 7 jours. Crédits offerts pendant l'essai : 5. Prix après essai : 11,99 €/mois pour 15 crédits/mois (aligné sur le pack Pro existant).
- Carte bancaire obligatoire dès le départ (comportement natif de Stripe Checkout `mode: "subscription"` — ne pas configurer `payment_method_collection`).
- Coexiste avec les 3 packs one-shot existants (`lib/stripe-packs.ts`) — ne pas les modifier ni les supprimer.
- L'éligibilité anti-fraude (email non déjà utilisé pour un essai) doit être vérifiée **dans la route API, avant** la création de la session Stripe — pas seulement au webhook.
- Résiliation exclusivement via le Stripe Customer Portal — pas de flow d'annulation custom.
- Pas de reprise de crédits ("clawback") si l'abonnement passe à `canceled` ou `past_due`.
- Hors scope : emails de rappel custom (l'email natif Stripe suffit), gating de fonctionnalités par statut d'abonnement, offres de rétention à l'annulation.
- `lib/trial-plan.ts` (constantes pures) doit rester importable côté client (aucune dépendance à `pg`/`pool`) ; `lib/trial-subscription.ts` (logique DB) est server-only et ne doit jamais être importé depuis un composant `"use client"`.

---

## Task 1: Migration DB — tables `consumed_trial_subscriptions`, `subscriptions`, `subscription_invoices`

**Files:**
- Create: `scripts/migrate-trial-subscription-tables.mjs`

**Interfaces:**
- Produces: tables `consumed_trial_subscriptions(email_hash TEXT PK)`, `subscriptions(id SERIAL PK, user_id TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT UNIQUE, status TEXT, current_period_end TIMESTAMPTZ, created_at, updated_at)`, `subscription_invoices(stripe_invoice_id TEXT PK, user_id TEXT, credits INTEGER, amount_cents INTEGER, created_at)`. Tasks 3, 6, 7 read/write these tables via `lib/trial-subscription.ts`.

Ce projet n'a pas d'ORM ni de dossier de migrations versionné — le pattern existant (`scripts/migrate-account-table.mjs`, `scripts/migrate-waitlist-table.mjs`) est un script Node one-off exécuté manuellement contre `DATABASE_URL`. On suit le même pattern.

- [ ] **Step 1: Écrire le script de migration**

```js
/**
 * Creates the tables required by the trial-subscription flow (essai gratuit
 * 7 jours avec CB requise → abonnement récurrent).
 * Run with: node --env-file=.env.local scripts/migrate-trial-subscription-tables.mjs
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const SQL = `
CREATE TABLE IF NOT EXISTS "consumed_trial_subscriptions" (
  "email_hash"  TEXT        NOT NULL PRIMARY KEY,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id"                       SERIAL       PRIMARY KEY,
  "user_id"                  TEXT         NOT NULL REFERENCES "user"("id"),
  "stripe_customer_id"       TEXT         NOT NULL,
  "stripe_subscription_id"   TEXT         NOT NULL UNIQUE,
  "status"                   TEXT         NOT NULL,
  "current_period_end"       TIMESTAMPTZ,
  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");

CREATE TABLE IF NOT EXISTS "subscription_invoices" (
  "stripe_invoice_id"  TEXT         NOT NULL PRIMARY KEY,
  "user_id"            TEXT         NOT NULL REFERENCES "user"("id"),
  "credits"            INTEGER      NOT NULL,
  "amount_cents"       INTEGER      NOT NULL,
  "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
`;

try {
  await pool.query(SQL);
  console.log(
    '✓ Tables "consumed_trial_subscriptions", "subscriptions", "subscription_invoices" créées (ou déjà existantes).'
  );
} catch (err) {
  console.error("✗ Erreur lors de la migration :", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
```

- [ ] **Step 2: Exécuter la migration contre la base locale (Supabase, accessible en local)**

Run: `node --env-file=.env.local scripts/migrate-trial-subscription-tables.mjs`
Expected: `✓ Tables "consumed_trial_subscriptions", "subscriptions", "subscription_invoices" créées (ou déjà existantes).`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-trial-subscription-tables.mjs
git commit -m "feat(db): tables pour l'essai gratuit avec abonnement récurrent"
```

---

## Task 2: `lib/trial-plan.ts` — constantes produit (client-safe)

**Files:**
- Create: `lib/trial-plan.ts`

**Interfaces:**
- Produces: `TRIAL_DAYS: number`, `TRIAL_CREDITS: number`, `TRIAL_RENEWAL_CREDITS: number`, `TRIAL_MONTHLY_PRICE: string`. Consommé par Task 3 (`lib/trial-subscription.ts`), Task 5 (`app/api/checkout-trial/route.ts`) et Task 8 (`app/buy-credits/page.tsx`, composant client).

Ce fichier ne doit importer ni `pg` ni `@/lib/db` — il est importé depuis un composant `"use client"` (Task 8), sur le modèle de `lib/stripe-packs.ts` (constantes pures) qui reste séparé de `lib/stripe-crediting.ts` (logique DB, server-only).

- [ ] **Step 1: Écrire le fichier**

```ts
/**
 * Constantes produit de l'essai gratuit — 7 jours, CB requise, bascule en
 * abonnement mensuel récurrent. Fichier client-safe : aucune dépendance DB.
 */
export const TRIAL_DAYS = 7;
export const TRIAL_CREDITS = 5;
export const TRIAL_RENEWAL_CREDITS = 15;
export const TRIAL_MONTHLY_PRICE = "11,99 €";
```

- [ ] **Step 2: Commit**

```bash
git add lib/trial-plan.ts
git commit -m "feat(pricing): constantes de l'essai gratuit"
```

---

## Task 3: `lib/trial-subscription.ts` — anti-fraude et crédit (server-only)

**Files:**
- Create: `lib/trial-subscription.ts`
- Test: `lib/trial-subscription.test.ts`

**Interfaces:**
- Consumes: `pool` from `./db` (`pg.Pool`, méthodes `.connect()` → client avec `.query()`/`.release()`, et `.query()` direct) ; `hashEmail(email: string): string` from `./welcome-bonus` ; `TRIAL_CREDITS`, `TRIAL_RENEWAL_CREDITS` from `./trial-plan`.
- Produces: `hasConsumedTrial(email: string): Promise<boolean>`, `claimTrialSubscription(params: { userId: string; email: string; stripeCustomerId: string; stripeSubscriptionId: string }): Promise<boolean>`, `creditSubscriptionRenewal(params: { stripeInvoiceId: string; userId: string; amountCents: number }): Promise<"credited" | "duplicate">`, `updateSubscriptionStatus(params: { stripeSubscriptionId: string; status: string; currentPeriodEnd: Date | null }): Promise<void>`, `findUserIdByStripeSubscriptionId(stripeSubscriptionId: string): Promise<string | null>`, `getActiveSubscriptionForUser(userId: string): Promise<{ stripeCustomerId: string; status: string } | null>`. Consommé par Task 5 (route checkout-trial), Task 6 (webhook), Task 7 (customer-portal + account/subscription).

- [ ] **Step 1: Écrire les tests (anti-fraude claim + crédit de renouvellement, les deux points critiques côté argent)**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockClient, mockPool } = vi.hoisted(() => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  const mockPool = {
    connect: vi.fn(async () => mockClient),
    query: vi.fn(),
  };
  return { mockClient, mockPool };
});

vi.mock("./db", () => ({ pool: mockPool }));

import {
  claimTrialSubscription,
  creditSubscriptionRenewal,
  hasConsumedTrial,
} from "./trial-subscription";

beforeEach(() => {
  mockClient.query.mockReset();
  mockClient.release.mockReset();
  mockPool.connect.mockClear();
  mockPool.query.mockReset();
});

describe("claimTrialSubscription", () => {
  it("crédite l'utilisateur et enregistre l'abonnement au premier claim", async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO \"consumed_trial_subscriptions\"")) {
        return { rowCount: 1, rows: [{ email_hash: "abc" }] };
      }
      return { rowCount: 1, rows: [] };
    });

    const granted = await claimTrialSubscription({
      userId: "u1",
      email: "test@example.com",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });

    expect(granted).toBe(true);
    const updateCall = mockClient.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE "user"')
    );
    expect(updateCall?.[1]).toEqual([5, "u1"]);
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("ne crédite rien si l'email a déjà consommé l'essai (email normalisé)", async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO \"consumed_trial_subscriptions\"")) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    });

    const granted = await claimTrialSubscription({
      userId: "u2",
      email: "test+trial2@example.com",
      stripeCustomerId: "cus_2",
      stripeSubscriptionId: "sub_2",
    });

    expect(granted).toBe(false);
    const updateCall = mockClient.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE "user"')
    );
    expect(updateCall).toBeUndefined();
  });
});

describe("creditSubscriptionRenewal", () => {
  it("crédite 15 crédits à la première facture d'un cycle donné", async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO \"subscription_invoices\"")) {
        return { rowCount: 1, rows: [{ stripe_invoice_id: "in_1" }] };
      }
      return { rowCount: 1, rows: [] };
    });

    const result = await creditSubscriptionRenewal({
      stripeInvoiceId: "in_1",
      userId: "u1",
      amountCents: 1199,
    });

    expect(result).toBe("credited");
    const updateCall = mockClient.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE "user"')
    );
    expect(updateCall?.[1]).toEqual([15, "u1"]);
  });

  it("ne recrédite pas une facture déjà traitée (retry webhook Stripe)", async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO \"subscription_invoices\"")) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    });

    const result = await creditSubscriptionRenewal({
      stripeInvoiceId: "in_1",
      userId: "u1",
      amountCents: 1199,
    });

    expect(result).toBe("duplicate");
    const updateCall = mockClient.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE "user"')
    );
    expect(updateCall).toBeUndefined();
  });
});

describe("hasConsumedTrial", () => {
  it("retourne true si le hash email est déjà présent", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1, rows: [{ email_hash: "abc" }] });
    await expect(hasConsumedTrial("test@example.com")).resolves.toBe(true);
  });

  it("retourne false si le hash email est absent", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(hasConsumedTrial("new@example.com")).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent (le module n'existe pas encore)**

Run: `npx vitest run lib/trial-subscription.test.ts`
Expected: FAIL — `Cannot find module './trial-subscription'`

- [ ] **Step 3: Implémenter `lib/trial-subscription.ts`**

```ts
import { pool } from "./db";
import { hashEmail } from "./welcome-bonus";
import { TRIAL_CREDITS, TRIAL_RENEWAL_CREDITS } from "./trial-plan";

export async function hasConsumedTrial(email: string): Promise<boolean> {
  const hash = hashEmail(email);
  const result = await pool.query<{ email_hash: string }>(
    `SELECT "email_hash" FROM "consumed_trial_subscriptions" WHERE "email_hash" = $1`,
    [hash]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function claimTrialSubscription(params: {
  userId: string;
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}): Promise<boolean> {
  const hash = hashEmail(params.email);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const claim = await client.query<{ email_hash: string }>(
      `INSERT INTO "consumed_trial_subscriptions" ("email_hash") VALUES ($1)
       ON CONFLICT ("email_hash") DO NOTHING
       RETURNING "email_hash"`,
      [hash]
    );
    const granted = (claim.rowCount ?? 0) > 0;

    if (granted) {
      await client.query(`UPDATE "user" SET credits = credits + $1 WHERE id = $2`, [
        TRIAL_CREDITS,
        params.userId,
      ]);
      await client.query(
        `INSERT INTO "subscriptions"
           ("user_id", "stripe_customer_id", "stripe_subscription_id", "status")
         VALUES ($1, $2, $3, 'trialing')
         ON CONFLICT ("stripe_subscription_id") DO NOTHING`,
        [params.userId, params.stripeCustomerId, params.stripeSubscriptionId]
      );
    }

    await client.query("COMMIT");
    return granted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function creditSubscriptionRenewal(params: {
  stripeInvoiceId: string;
  userId: string;
  amountCents: number;
}): Promise<"credited" | "duplicate"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const claim = await client.query<{ stripe_invoice_id: string }>(
      `INSERT INTO "subscription_invoices"
         ("stripe_invoice_id", "user_id", "credits", "amount_cents")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("stripe_invoice_id") DO NOTHING
       RETURNING "stripe_invoice_id"`,
      [params.stripeInvoiceId, params.userId, TRIAL_RENEWAL_CREDITS, params.amountCents]
    );
    const credited = (claim.rowCount ?? 0) > 0;

    if (credited) {
      await client.query(`UPDATE "user" SET credits = credits + $1 WHERE id = $2`, [
        TRIAL_RENEWAL_CREDITS,
        params.userId,
      ]);
    }

    await client.query("COMMIT");
    return credited ? "credited" : "duplicate";
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateSubscriptionStatus(params: {
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  await pool.query(
    `UPDATE "subscriptions"
     SET "status" = $1, "current_period_end" = $2, "updated_at" = now()
     WHERE "stripe_subscription_id" = $3`,
    [params.status, params.currentPeriodEnd, params.stripeSubscriptionId]
  );
}

export async function findUserIdByStripeSubscriptionId(
  stripeSubscriptionId: string
): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT "user_id" FROM "subscriptions" WHERE "stripe_subscription_id" = $1 LIMIT 1`,
    [stripeSubscriptionId]
  );
  return result.rows[0]?.user_id ?? null;
}

export async function getActiveSubscriptionForUser(
  userId: string
): Promise<{ stripeCustomerId: string; status: string } | null> {
  const result = await pool.query<{ stripe_customer_id: string; status: string }>(
    `SELECT "stripe_customer_id", "status" FROM "subscriptions"
     WHERE "user_id" = $1 AND "status" IN ('trialing', 'active', 'past_due')
     ORDER BY "created_at" DESC
     LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  return row ? { stripeCustomerId: row.stripe_customer_id, status: row.status } : null;
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run lib/trial-subscription.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/trial-subscription.ts lib/trial-subscription.test.ts
git commit -m "feat(trial): anti-fraude et crédit de l'essai gratuit"
```

---

## Task 4: `lib/feature-flags.ts` — `isTrialConfigured()`

**Files:**
- Modify: `lib/feature-flags.ts`

**Interfaces:**
- Produces: `isTrialConfigured(): boolean`. Consommé par Task 5 (`app/api/checkout-trial/route.ts`).

- [ ] **Step 1: Ajouter la fonction**

```ts
export function isTrialConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_PRO_MONTHLY
  );
}
```

Ajouter ce bloc à la suite de `isStripeConfigured()` dans `lib/feature-flags.ts`.

- [ ] **Step 2: Vérifier que le fichier compile**

Run: `npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add lib/feature-flags.ts
git commit -m "feat(pricing): garde-fou de config pour l'essai gratuit"
```

---

## Task 5: `app/api/checkout-trial/route.ts`

**Files:**
- Create: `app/api/checkout-trial/route.ts`

**Interfaces:**
- Consumes: `getStripe()` from `@/lib/stripe` ; `STRIPE_ENABLED`, `isTrialConfigured()` from `@/lib/feature-flags` ; `requireVerifiedSession(req)` from `@/lib/auth-verification` ; `hasConsumedTrial(email)` from `@/lib/trial-subscription` ; `TRIAL_DAYS` from `@/lib/trial-plan`.
- Produces: `POST /api/checkout-trial` → `{ url: string }` ou `{ error: string }`. Consommé par Task 8 (`app/buy-credits/page.tsx`).

Route serveur, pas de test unitaire dédié (même convention que `app/api/checkout/route.ts`, qui n'en a pas — la logique métier testée est dans `lib/trial-subscription.ts`, Task 3). Vérifié manuellement en Task 5 Step 2 et via Stripe test clocks (voir note de fin de plan).

- [ ] **Step 1: Écrire la route**

```ts
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { STRIPE_ENABLED, isTrialConfigured } from "@/lib/feature-flags";
import { requireVerifiedSession } from "@/lib/auth-verification";
import { hasConsumedTrial } from "@/lib/trial-subscription";
import { TRIAL_DAYS } from "@/lib/trial-plan";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!STRIPE_ENABLED) {
    return NextResponse.json(
      { error: "Le paiement n'est pas encore disponible. Réessaie plus tard." },
      { status: 503 }
    );
  }
  if (!isTrialConfigured()) {
    console.error(
      "[api/checkout-trial] env Stripe incomplet — vérifier STRIPE_PRICE_PRO_MONTHLY sur Vercel"
    );
    return NextResponse.json(
      {
        error:
          "L'essai gratuit est temporairement indisponible. Réessaie dans quelques minutes ou contacte-nous à contact@cv-optimizer.fr.",
      },
      { status: 503 }
    );
  }

  try {
    const { session, response } = await requireVerifiedSession(req);
    if (response) {
      if (response.status === 401) {
        return NextResponse.json(
          {
            error: "Tu dois être connecté pour démarrer ton essai gratuit.",
            redirect: "/sign-in?redirect=/buy-credits",
          },
          { status: 401 }
        );
      }
      return response;
    }

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          error: "Tu dois être connecté pour démarrer ton essai gratuit.",
          redirect: "/sign-in?redirect=/buy-credits",
        },
        { status: 401 }
      );
    }

    if (await hasConsumedTrial(session.user.email)) {
      return NextResponse.json(
        {
          error:
            "Tu as déjà utilisé ton essai gratuit — choisis un pack ou abonne-toi directement.",
        },
        { status: 403 }
      );
    }

    const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
    if (!priceId) {
      return NextResponse.json(
        { error: "L'essai gratuit n'est pas configuré (env var STRIPE_PRICE_PRO_MONTHLY manquante)." },
        { status: 500 }
      );
    }

    const origin =
      req.headers.get("origin") ??
      process.env.BETTER_AUTH_URL ??
      "http://localhost:3000";

    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: TRIAL_DAYS },
      customer_email: session.user.email,
      metadata: { userId: session.user.id },
      success_url: `${origin}/buy-credits?trial_success=true`,
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
    console.error("[api/checkout-trial] failed:", err);

    const e = err as { type?: string; raw?: { message?: string }; message?: string };
    const rawMsg = e?.raw?.message ?? e?.message ?? "";

    let userMessage =
      "Une erreur est survenue lors de la création de l'essai. Réessaie dans un instant.";
    let status = 500;

    if (rawMsg.includes("cannot currently make live charges")) {
      userMessage =
        "Le paiement n'est pas encore activé. On revient très vite — réessaie dans quelques instants.";
      status = 503;
    } else if (e?.type === "StripeInvalidRequestError") {
      userMessage = "L'essai gratuit est temporairement indisponible. Réessaie plus tard.";
      status = 503;
    } else if (e?.type === "StripeAuthenticationError") {
      userMessage = "Le service de paiement est mal configuré. Contacte-nous à contact@cv-optimizer.fr.";
      status = 503;
    } else if (e?.type === "StripeConnectionError" || e?.type === "StripeAPIError") {
      userMessage = "Service de paiement injoignable. Réessaie dans un instant.";
      status = 502;
    }

    return NextResponse.json({ error: userMessage }, { status });
  }
}
```

- [ ] **Step 2: Vérifier que le projet compile**

Run: `npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add app/api/checkout-trial/route.ts
git commit -m "feat(trial): route de démarrage de l'essai gratuit (Stripe Checkout subscription)"
```

---

## Task 6: Webhook Stripe — branches essai et renouvellement

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Test: `app/api/webhooks/stripe/route.test.ts`

**Interfaces:**
- Consumes: `claimTrialSubscription`, `creditSubscriptionRenewal`, `updateSubscriptionStatus`, `findUserIdByStripeSubscriptionId` from `@/lib/trial-subscription` (Task 3) ; `grantCreditsForStripeCheckoutSession`, `StripeCreditError` from `@/lib/stripe-crediting` (existant, inchangé).
- Produces: la route continue d'exposer `POST` — comportement inchangé pour les événements packs (`checkout.session.completed` en `mode: "payment"`), nouveau comportement pour `checkout.session.completed` en `mode: "subscription"`, `invoice.paid`, `customer.subscription.updated`/`.deleted`.

Vérifié contre `node_modules/stripe` (v22, OpenAPI v2252) : `invoice.subscription` n'existe plus au niveau racine — utiliser `invoice.parent.subscription_details.subscription`. `subscription.current_period_end` n'existe plus au niveau racine — utiliser `subscription.items.data[0].current_period_end` (timestamp Unix en secondes).

- [ ] **Step 1: Écrire les tests des nouvelles branches**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  constructEvent,
  grantCreditsForStripeCheckoutSession,
  claimTrialSubscription,
  creditSubscriptionRenewal,
  updateSubscriptionStatus,
  findUserIdByStripeSubscriptionId,
} = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  grantCreditsForStripeCheckoutSession: vi.fn(),
  claimTrialSubscription: vi.fn(),
  creditSubscriptionRenewal: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  findUserIdByStripeSubscriptionId: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

class FakeStripeCreditError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

vi.mock("@/lib/stripe-crediting", () => ({
  grantCreditsForStripeCheckoutSession,
  StripeCreditError: FakeStripeCreditError,
}));

vi.mock("@/lib/trial-subscription", () => ({
  claimTrialSubscription,
  creditSubscriptionRenewal,
  updateSubscriptionStatus,
  findUserIdByStripeSubscriptionId,
}));

import { POST } from "./route";

function makeRequest(): Request {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

describe("checkout.session.completed", () => {
  it("mode subscription → crédite l'essai via claimTrialSubscription", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_trial_1",
          mode: "subscription",
          metadata: { userId: "u1" },
          customer_email: "a@b.com",
          customer_details: null,
          customer: "cus_1",
          subscription: "sub_1",
        },
      },
    });
    claimTrialSubscription.mockResolvedValue(true);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(claimTrialSubscription).toHaveBeenCalledWith({
      userId: "u1",
      email: "a@b.com",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
    expect(grantCreditsForStripeCheckoutSession).not.toHaveBeenCalled();
  });

  it("mode payment → passe par le flux packs existant", async () => {
    const session = { id: "cs_pack_1", mode: "payment" };
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });
    grantCreditsForStripeCheckoutSession.mockResolvedValue({
      status: "credited",
      credits: 5,
      balance: 10,
      stripeSessionId: "cs_pack_1",
      userId: "u1",
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(grantCreditsForStripeCheckoutSession).toHaveBeenCalledWith(session);
    expect(claimTrialSubscription).not.toHaveBeenCalled();
  });
});

describe("invoice.paid", () => {
  it("billing_reason=subscription_cycle → crédite le renouvellement", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          billing_reason: "subscription_cycle",
          amount_paid: 1199,
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      },
    });
    findUserIdByStripeSubscriptionId.mockResolvedValue("u1");
    creditSubscriptionRenewal.mockResolvedValue("credited");

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(creditSubscriptionRenewal).toHaveBeenCalledWith({
      stripeInvoiceId: "in_1",
      userId: "u1",
      amountCents: 1199,
    });
  });

  it("autre billing_reason → ignoré", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_2",
          billing_reason: "subscription_create",
          amount_paid: 0,
          parent: { subscription_details: { subscription: "sub_2" } },
        },
      },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(creditSubscriptionRenewal).not.toHaveBeenCalled();
    expect(findUserIdByStripeSubscriptionId).not.toHaveBeenCalled();
  });
});

describe("customer.subscription.deleted", () => {
  it("met à jour le statut et la fin de période", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_1",
          status: "canceled",
          items: { data: [{ current_period_end: 1700000000 }] },
        },
      },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(updateSubscriptionStatus).toHaveBeenCalledWith({
      stripeSubscriptionId: "sub_1",
      status: "canceled",
      currentPeriodEnd: new Date(1700000000 * 1000),
    });
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run app/api/webhooks/stripe/route.test.ts`
Expected: FAIL (les nouvelles branches n'existent pas encore — `claimTrialSubscription` jamais appelé, etc.)

- [ ] **Step 3: Réécrire `app/api/webhooks/stripe/route.ts`**

```ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  grantCreditsForStripeCheckoutSession,
  StripeCreditError,
} from "@/lib/stripe-crediting";
import {
  claimTrialSubscription,
  creditSubscriptionRenewal,
  findUserIdByStripeSubscriptionId,
  updateSubscriptionStatus,
} from "@/lib/trial-subscription";

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

  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
    case "invoice.paid":
      return handleInvoicePaid(event.data.object as Stripe.Invoice);
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionStatusChange(event.data.object as Stripe.Subscription);
    default:
      // On ignore les autres events sans erreur (200 OK pour que Stripe arrête de retry)
      return NextResponse.json({ received: true });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "subscription") {
    return handleTrialCheckoutCompleted(session);
  }

  try {
    const result = await grantCreditsForStripeCheckoutSession(session);

    if (result.status === "not_paid") {
      console.warn(
        `[webhook/stripe] session ${result.stripeSessionId} not paid (status=${session.payment_status})`
      );
      return NextResponse.json({ received: true });
    }

    if (result.status === "duplicate") {
      console.log(`[webhook/stripe] session ${result.stripeSessionId} déjà traitée, skip`);
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

async function handleTrialCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const email = session.customer_email ?? session.customer_details?.email ?? undefined;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (!userId || !email || !customerId || !subscriptionId) {
    console.error(
      `[webhook/stripe] session essai ${session.id} incomplète (userId=${userId}, email=${email}, customer=${customerId}, subscription=${subscriptionId})`
    );
    return NextResponse.json({ error: "Session essai incomplète" }, { status: 400 });
  }

  const granted = await claimTrialSubscription({
    userId,
    email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  if (!granted) {
    console.error(
      `[webhook/stripe] essai déjà consommé pour user=${userId} (session=${session.id}) — carte enregistrée mais aucun crédit accordé`
    );
    return NextResponse.json({ received: true, duplicate: true });
  }

  console.log(`[webhook/stripe] essai démarré pour user=${userId} (subscription=${subscriptionId})`);
  return NextResponse.json({ received: true });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== "subscription_cycle") {
    return NextResponse.json({ received: true });
  }

  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;

  if (!subscriptionId) {
    return NextResponse.json({ received: true });
  }

  const userId = await findUserIdByStripeSubscriptionId(subscriptionId);
  if (!userId) {
    console.error(
      `[webhook/stripe] invoice ${invoice.id}: aucun user trouvé pour subscription=${subscriptionId}`
    );
    return NextResponse.json({ error: "Abonnement inconnu" }, { status: 400 });
  }

  const result = await creditSubscriptionRenewal({
    stripeInvoiceId: invoice.id,
    userId,
    amountCents: invoice.amount_paid,
  });

  if (result === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  console.log(`[webhook/stripe] renouvellement crédité pour user=${userId} (invoice=${invoice.id})`);
  return NextResponse.json({ received: true });
}

async function handleSubscriptionStatusChange(subscription: Stripe.Subscription) {
  const periodEndSeconds = subscription.items.data[0]?.current_period_end;
  await updateSubscriptionStatus({
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: periodEndSeconds ? new Date(periodEndSeconds * 1000) : null,
  });

  console.log(`[webhook/stripe] subscription ${subscription.id} → status=${subscription.status}`);
  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run app/api/webhooks/stripe/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Lancer toute la suite pour vérifier l'absence de régression sur le flux packs**

Run: `npx vitest run`
Expected: PASS (tous les tests existants, y compris ceux qui touchent `stripe-packs`)

- [ ] **Step 6: Commit**

```bash
git add app/api/webhooks/stripe/route.ts app/api/webhooks/stripe/route.test.ts
git commit -m "feat(trial): webhook — essai, renouvellement, changement de statut d'abonnement"
```

---

## Task 7: Routes `customer-portal` et `account/subscription`

**Files:**
- Create: `app/api/customer-portal/route.ts`
- Create: `app/api/account/subscription/route.ts`

**Interfaces:**
- Consumes: `getStripe()` from `@/lib/stripe` ; `requireVerifiedSession(req)` from `@/lib/auth-verification` ; `getActiveSubscriptionForUser(userId)` from `@/lib/trial-subscription` (Task 3).
- Produces: `POST /api/customer-portal` → `{ url: string }` ou `{ error }` (404 si pas d'abonnement) ; `GET /api/account/subscription` → `{ active: boolean }`. Consommé par Task 9 (`app/account/page.tsx`).

- [ ] **Step 1: Écrire `app/api/customer-portal/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireVerifiedSession } from "@/lib/auth-verification";
import { getActiveSubscriptionForUser } from "@/lib/trial-subscription";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { session, response } = await requireVerifiedSession(req);
  if (response) {
    if (response.status === 401) {
      return NextResponse.json(
        { error: "Tu dois être connecté pour gérer ton abonnement." },
        { status: 401 }
      );
    }
    return response;
  }

  if (!session?.user) {
    return NextResponse.json(
      { error: "Tu dois être connecté pour gérer ton abonnement." },
      { status: 401 }
    );
  }

  const subscription = await getActiveSubscriptionForUser(session.user.id);
  if (!subscription) {
    return NextResponse.json({ error: "Aucun abonnement actif trouvé." }, { status: 404 });
  }

  const origin =
    req.headers.get("origin") ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";

  try {
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${origin}/account`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("[api/customer-portal] failed:", err);
    return NextResponse.json(
      { error: "Impossible d'ouvrir la gestion de l'abonnement. Réessaie dans un instant." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Écrire `app/api/account/subscription/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireVerifiedSession } from "@/lib/auth-verification";
import { getActiveSubscriptionForUser } from "@/lib/trial-subscription";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { session, response } = await requireVerifiedSession(req);
  if (response) return response;
  if (!session?.user) {
    return NextResponse.json({ active: false });
  }

  const subscription = await getActiveSubscriptionForUser(session.user.id);
  return NextResponse.json({ active: subscription !== null });
}
```

- [ ] **Step 3: Vérifier que le projet compile**

Run: `npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 4: Commit**

```bash
git add app/api/customer-portal/route.ts app/api/account/subscription/route.ts
git commit -m "feat(trial): routes de gestion d'abonnement (Stripe Customer Portal)"
```

---

## Task 8: UI — `/buy-credits` — carte essai + correction du copy "sans abonnement"

**Files:**
- Modify: `app/buy-credits/page.tsx`

**Interfaces:**
- Consumes: `TRIAL_DAYS`, `TRIAL_CREDITS`, `TRIAL_MONTHLY_PRICE`, `TRIAL_RENEWAL_CREDITS` from `@/lib/trial-plan` (Task 2, client-safe) ; `POST /api/checkout-trial` (Task 5).

Trois corrections de copy sont nécessaires car la page affirme actuellement "sans abonnement" à plusieurs endroits, ce qui devient inexact une fois l'essai ajouté (l'essai bascule en abonnement récurrent). Ces trois blocs restent vrais pour les packs one-shot spécifiquement, mais pas pour la page dans son ensemble — reformuler sans mentir dans un sens ni dans l'autre.

- [ ] **Step 1: Ajouter l'état et le handler du parcours essai**

Dans `BuyCreditsContent`, à la suite de la déclaration de `loadingPack`/`error` (après la ligne `const [error, setError] = useState<string | null>(null);`) :

```tsx
  const [loadingTrial, setLoadingTrial] = useState(false);
```

Et à la suite de la fonction `handleBuy` :

```tsx
  async function handleStartTrial() {
    if (!STRIPE_ENABLED) return;
    if (!user) {
      window.location.href = "/sign-in?redirect=/buy-credits";
      return;
    }
    setError(null);
    setLoadingTrial(true);
    try {
      const res = await fetch("/api/checkout-trial", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur checkout");
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("URL de paiement absente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoadingTrial(false);
    }
  }
```

Ajouter l'import en haut du fichier, à côté de l'import de `stripe-packs` :

```tsx
import {
  TRIAL_CREDITS,
  TRIAL_DAYS,
  TRIAL_MONTHLY_PRICE,
  TRIAL_RENEWAL_CREDITS,
} from "@/lib/trial-plan";
```

- [ ] **Step 2: Ajouter la vue de succès de l'essai**

Juste avant le bloc `// ========== VUE SUCCÈS DÉDIÉE ==========` (qui gère `success && STRIPE_ENABLED`), ajouter la détection et la vue dédiée à l'essai :

```tsx
  const trialSuccess = searchParams.get("trial_success") === "true";
```

(à ajouter à côté des autres `searchParams.get(...)` existants, après la ligne `const requestedPack = ...`)

Puis, juste avant `if (success && STRIPE_ENABLED) {`, insérer :

```tsx
  if (trialSuccess && STRIPE_ENABLED) {
    return (
      <main className="min-h-screen bg-paper">
        <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
          <div className="mb-12 flex items-center justify-between">
            <Logo size="md" />
            <Link
              href="/optimiser"
              className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
            >
              → Optimiser un CV
            </Link>
          </div>

          <div className="border-l-2 border-success bg-success-soft px-6 py-5">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-success">
              ✓ Essai gratuit démarré
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {TRIAL_CREDITS} crédits ont été ajoutés à ton compte. Ton essai dure {TRIAL_DAYS}{" "}
              jours — résilie à tout moment avant la fin pour ne rien payer.
            </p>
          </div>

          <section className="mt-10 border border-rule bg-card p-8 sm:p-10">
            <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-success">
              ● Après l&apos;essai
            </span>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Si tu ne résilies pas, l&apos;abonnement Pro démarre automatiquement :{" "}
              {TRIAL_MONTHLY_PRICE}/mois pour {TRIAL_RENEWAL_CREDITS} crédits. Gérable à tout
              moment depuis ton compte.
            </p>
          </section>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/optimiser"
              className="group inline-flex flex-1 items-center justify-center gap-2 bg-ink px-6 py-4 font-mono text-[13px] uppercase tracking-[0.22em] text-paper transition hover:bg-accent"
            >
              Générer un CV maintenant
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center justify-center border border-rule px-6 py-4 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted transition hover:border-ink hover:text-ink"
            >
              Gérer mon abonnement
            </Link>
          </div>
        </div>
      </main>
    );
  }
```

- [ ] **Step 3: Corriger le badge d'en-tête (fausse promesse "sans abonnement")**

Remplacer :

```tsx
              <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-warm">
                {isAdmin
                  ? "● Compte admin — accès illimité"
                  : user
                    ? credits <= 0
                      ? "● Prêt à recharger"
                      : "● Compléter ton solde"
                    : "● Packs sans abonnement"}
              </p>
```

Par :

```tsx
              <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-warm">
                {isAdmin
                  ? "● Compte admin — accès illimité"
                  : user
                    ? credits <= 0
                      ? "● Prêt à recharger"
                      : "● Compléter ton solde"
                    : "● Packs one-shot ou essai gratuit"}
              </p>
```

- [ ] **Step 4: Corriger l'encart "Aucun abonnement"**

Remplacer :

```tsx
                <>
                  <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-success">
                    ● Simple et transparent
                  </p>
                  <p className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight text-ink">
                    Aucun abonnement.
                  </p>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                    Aucun renouvellement automatique. Tes crédits n&apos;expirent pas.
                  </p>
                </>
```

Par :

```tsx
                <>
                  <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-success">
                    ● Simple et transparent
                  </p>
                  <p className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight text-ink">
                    Tu choisis la formule.
                  </p>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                    Un pack sans engagement, ou un essai gratuit de {TRIAL_DAYS} jours avant
                    abonnement. Dans les deux cas, tes crédits n&apos;expirent pas.
                  </p>
                </>
```

- [ ] **Step 5: Corriger la tuile comparative "Sans abonnement"**

Remplacer, dans le tableau de tuiles :

```tsx
            ["text-accent", "Sans abonnement", "Tu achètes un pack une fois. Aucun renouvellement automatique."],
```

Par :

```tsx
            ["text-accent", "Deux formules", "Pack one-shot sans engagement, ou essai gratuit puis abonnement mensuel résiliable."],
```

- [ ] **Step 6: Ajouter la section essai gratuit, après la grille de comparaison des packs**

Juste avant le bloc footer (`<div className="mt-10 flex flex-col gap-4 border-t border-rule pt-6 ...`), insérer :

```tsx
        <div className="mt-16 border border-rule bg-card p-7 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-accent">
                ● Envie de tester avant de t&apos;engager ?
              </p>
              <h2 className="mt-3 font-display text-[clamp(1.75rem,3vw,2.5rem)] font-light leading-tight tracking-tight text-ink">
                {TRIAL_DAYS} jours gratuits, {TRIAL_CREDITS} crédits offerts.
              </h2>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-soft">
                Carte bancaire requise pour démarrer. À la fin de l&apos;essai, bascule
                automatique sur l&apos;abonnement Pro — {TRIAL_MONTHLY_PRICE}/mois pour{" "}
                {TRIAL_RENEWAL_CREDITS} crédits. Résilie à tout moment avant la fin de
                l&apos;essai pour ne rien payer.
              </p>
            </div>
            {STRIPE_ENABLED && (
              <button
                type="button"
                onClick={handleStartTrial}
                disabled={loadingTrial}
                className="cta-primary min-h-13 whitespace-nowrap px-6 py-4 font-mono text-[12px] uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loadingTrial ? "Ouverture de Stripe…" : "Démarrer mon essai gratuit"}
              </button>
            )}
          </div>
        </div>
```

- [ ] **Step 7: Vérifier manuellement dans le navigateur**

Run: `npx next dev` (ou réutiliser le serveur dev déjà lancé — un seul serveur `next dev` autorisé par projet)
Ouvrir `http://localhost:3000/buy-credits`, vérifier :
- la nouvelle section essai s'affiche sous les 3 packs
- le badge, l'encart et la tuile ne mentionnent plus "aucun abonnement" de façon absolue
- cliquer "Démarrer mon essai gratuit" redirige vers `/sign-in?redirect=/buy-credits` si non connecté

Expected: rendu correct, pas d'erreur console

- [ ] **Step 8: Commit**

```bash
git add app/buy-credits/page.tsx
git commit -m "feat(trial): carte essai gratuit sur /buy-credits + correction du copy sans-abonnement"
```

---

## Task 9: UI — `/account` — gestion de l'abonnement

**Files:**
- Modify: `app/account/page.tsx`

**Interfaces:**
- Consumes: `GET /api/account/subscription` (Task 7) → `{ active: boolean }` ; `POST /api/customer-portal` (Task 7) → `{ url: string }`.

- [ ] **Step 1: Ajouter l'état et les handlers**

Après la ligne `const [showDelete, setShowDelete] = useState(false);` :

```tsx
  const [hasSubscription, setHasSubscription] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
```

Après le `useEffect` existant (redirection si non connecté), ajouter :

```tsx
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    fetch("/api/account/subscription")
      .then((res) => res.json())
      .then((data: { active?: boolean }) => {
        if (!cancelled) setHasSubscription(Boolean(data?.active));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  async function handleManageSubscription() {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/customer-portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur inconnue");
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Erreur inconnue");
      setPortalLoading(false);
    }
  }
```

- [ ] **Step 2: Ajouter la section "Abonnement" dans le JSX**

Juste après la fermeture de la `<section>` "Profil" (`</section>`) et avant le `<div className="mt-16 border-t border-rule pt-8">` (section suppression de compte), insérer :

```tsx
        {hasSubscription && (
          <section className="mt-8 border border-rule bg-paper-deep p-6 sm:p-8">
            <h2 className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
              Abonnement
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              Essai gratuit ou abonnement Pro en cours. Gère ton moyen de paiement, consulte tes
              factures ou résilie depuis l&apos;espace Stripe.
            </p>
            {portalError && (
              <p role="alert" className="mt-3 font-mono text-[13px] uppercase tracking-[0.16em] text-danger">
                ✕ {portalError}
              </p>
            )}
            <button
              type="button"
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="mt-5 inline-flex items-center gap-2 border border-ink px-4 py-2 font-mono text-[13px] uppercase tracking-[0.18em] text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-55"
            >
              {portalLoading ? "Ouverture…" : "Gérer mon abonnement →"}
            </button>
          </section>
        )}
```

- [ ] **Step 3: Vérifier manuellement dans le navigateur**

Run: réutiliser le serveur dev déjà lancé
Ouvrir `http://localhost:3000/account` connecté avec un compte sans abonnement : la section "Abonnement" ne doit pas apparaître.
Expected: aucune section "Abonnement" visible, aucune erreur console

- [ ] **Step 4: Commit**

```bash
git add app/account/page.tsx
git commit -m "feat(trial): gestion de l'abonnement depuis /account (Stripe Customer Portal)"
```

---

## Task 10: Configuration manuelle Stripe + variables d'environnement

**Files:** aucun fichier de code — étapes de configuration externe requises avant que le parcours fonctionne de bout en bout.

- [ ] **Step 1: Créer le Price récurrent dans le Dashboard Stripe**

Dashboard Stripe → Products → nouveau produit "Abonnement Pro (essai 7 jours)" → Price récurrent, 11,99 €, mensuel. Noter le `price_id` (`price_...`).

- [ ] **Step 2: Ajouter la variable d'environnement**

Ajouter `STRIPE_PRICE_PRO_MONTHLY=price_...` :
- en local dans `.env.local`
- sur Vercel (Project Settings → Environment Variables), pour production ET preview si utilisées

- [ ] **Step 3: Activer le Stripe Customer Portal**

Dashboard Stripe → Settings → Billing → Customer Portal : activer le portail, autoriser l'annulation d'abonnement (obligatoire — c'est le seul mécanisme de résiliation de ce parcours).

- [ ] **Step 4: Test de bout en bout avec un Stripe test clock**

Dashboard Stripe (mode test) → Test clocks → créer un clock → attacher le customer de test créé par un essai → avancer le clock de 7 jours → vérifier que l'invoice `subscription_cycle` se déclenche, que le webhook `invoice.paid` est reçu (voir Dashboard → Developers → Webhooks → logs), et que le solde de crédits de l'utilisateur de test augmente de 15.

---

## Note hors plan (à considérer séparément)

Les CGU (`app/cgu/page.tsx`) mentionnent aujourd'hui le welcome bonus mais pas d'abonnement récurrent. Le droit de la consommation français impose une information claire sur la reconduction automatique et les modalités de résiliation pour ce type d'offre. Ce n'était pas dans le scope de la spec validée — à traiter dans une tâche séparée avant la mise en production de cette fonctionnalité.
