# Waitlist Smoke Test on /buy-credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead "Bientôt disponible" button on `/buy-credits` with a lead-capture flow (email + chosen pack) so the site owner can validate payment demand before flipping Stripe to live.

**Architecture:** One Postgres table (`waitlist_signups`) behind one rate-limited API route (`POST /api/waitlist`), driven by the existing `STRIPE_ENABLED` flag. The route resolves the lead's email from session when logged in, validates a posted email otherwise, inserts idempotently, and fires a best-effort admin notification email through a `sendEmail` helper extracted from `lib/auth.ts` into a new `lib/email.ts`. The buy-credits page gets a per-pack `idle/loading/done` state machine that replaces the disabled-button branch.

**Tech Stack:** Next.js App Router (route handlers), `pg` (`lib/db.ts` pool), Resend (`lib/email.ts`), existing `lib/rate-limit.ts`, existing `better-auth` session (`lib/auth.ts`).

## Global Constraints

- `STRIPE_ENABLED` flips to `false` in `lib/feature-flags.ts` — this is what activates waitlist mode on `/buy-credits`. The Stripe checkout code path must remain untouched and reachable again by flipping it back to `true`.
- Rate limit on `/api/waitlist`: 5 requests / 10 minutes / IP (reuse `checkRateLimit` + `getClientIp` from `lib/rate-limit.ts`, exact signature: `checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult`, `getClientIp(req: Request): string`).
- Idempotency: `UNIQUE (email, pack)` + `ON CONFLICT (email, pack) DO NOTHING` — a repeat signup must return success, never an error.
- Admin notification email must never block or fail the user-facing response — wrap in `try/catch`, log on failure only (mirrors the existing welcome-email pattern in `lib/auth.ts:211-213`).
- Admin email recipient: `badraitoufel5@gmail.com` (already exported as the sole entry of `ADMIN_EMAILS` in `lib/admin.ts` — import the set, don't hardcode a second copy of the literal; iterate `ADMIN_EMAILS` to get the address(es)).
- No admin UI/page for listing leads — out of scope.
- French copy throughout, matching the existing tone in `app/buy-credits/page.tsx` (informal "tu", no corporate fluff).

---

### Task 1: `waitlist_signups` table + migration script

**Files:**
- Create: `scripts/migrate-waitlist-table.mjs`

**Interfaces:**
- Produces: a Postgres table `waitlist_signups(id SERIAL PK, email TEXT, pack TEXT, user_id TEXT NULL, created_at TIMESTAMP)` with `UNIQUE (email, pack)`. All later tasks that touch this table assume this exact shape and constraint name.

- [ ] **Step 1: Write the migration script**

```js
/**
 * Creates the `waitlist_signups` table used by the /api/waitlist smoke-test route.
 * Run with: node --env-file=.env.local scripts/migrate-waitlist-table.mjs
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const SQL = `
CREATE TABLE IF NOT EXISTS "waitlist_signups" (
  "id"         SERIAL      PRIMARY KEY,
  "email"      TEXT        NOT NULL,
  "pack"       TEXT        NOT NULL,
  "user_id"    TEXT        REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE ("email", "pack")
);
`;

try {
  await pool.query(SQL);
  console.log('✓ Table "waitlist_signups" créée (ou déjà existante).');
} catch (err) {
  console.error("✗ Erreur lors de la migration :", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
```

- [ ] **Step 2: Run the migration against the local database**

Run: `node --env-file=.env.local scripts/migrate-waitlist-table.mjs`
Expected: `✓ Table "waitlist_signups" créée (ou déjà existante).`

- [ ] **Step 3: Verify the table shape**

Run: `node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?{rejectUnauthorized:false}:undefined});p.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='waitlist_signups'\").then(r=>{console.log(r.rows);return p.end();})"`
Expected: rows for `id`, `email`, `pack`, `user_id`, `created_at`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-waitlist-table.mjs
git commit -m "feat(waitlist): add waitlist_signups migration script"
```

---

### Task 2: Extract `sendEmail`/`buildEmailHtml` into `lib/email.ts`

**Files:**
- Create: `lib/email.ts`
- Modify: `lib/auth.ts:10-89` (remove local definitions, import instead)

**Interfaces:**
- Produces: `export function buildEmailHtml(opts: { title: string; intro: string; ctaLabel: string; url: string; footer: string }): string` and `export async function sendEmail(opts: { to: string; subject: string; html: string; fallbackLabel: string }): Promise<void>`. Task 4 (the waitlist route) imports both from `@/lib/email`.
- Consumes: nothing new — pure move of existing code, same `process.env.RESEND_API_KEY` / `process.env.RESEND_FROM` env vars already used today.

- [ ] **Step 1: Create `lib/email.ts` with the extracted functions**

```ts
export function buildEmailHtml(opts: {
  title: string;
  intro: string;
  ctaLabel: string;
  url: string;
  footer: string;
}): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#fbfaf6;padding:32px;color:#0f0f10;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:32px;border-top:3px solid #1f4bff;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.4px;">${opts.title}</h1>
    <p style="margin:0 0 24px;line-height:1.55;font-size:15px;">${opts.intro}</p>
    <a href="${opts.url}" style="display:inline-block;background:#0f0f10;color:#fbfaf6;padding:14px 24px;text-decoration:none;font-weight:500;font-size:14px;">${opts.ctaLabel} →</a>
    <p style="margin:32px 0 0;line-height:1.55;font-size:12px;color:#5d5b56;">${opts.footer}</p>
    <p style="margin:8px 0 0;line-height:1.55;font-size:11px;color:#a09d94;font-family:monospace;">${opts.url}</p>
  </div>
</body></html>`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fallbackLabel: string;
}) {
  const defaultFrom = "CV Optimizer <onboarding@resend.dev>";
  const configuredFrom = process.env.RESEND_FROM?.trim() || defaultFrom;

  if (!process.env.RESEND_API_KEY) {
    const msg = `RESEND_API_KEY non configurée. Impossible d'envoyer ${opts.fallbackLabel}.`;
    console.error(msg);
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.log("\n========================================");
    console.log(`📧 ${opts.fallbackLabel} (Resend non configuré)`);
    console.log(`   To: ${opts.to}`);
    console.log(`   Subject: ${opts.subject}`);
    console.log(`   HTML: ${opts.html}`);
    console.log("========================================\n");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  async function trySend(fromAddress: string) {
    return resend.emails.send({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  }

  try {
    await trySend(configuredFrom);
    console.log(
      `[${opts.fallbackLabel}] Email envoyé à ${opts.to} via Resend from=${configuredFrom}`
    );
  } catch (firstError) {
    console.error(`[${opts.fallbackLabel}] Erreur Resend avec from=${configuredFrom}:`, firstError);
    if (configuredFrom !== defaultFrom) {
      try {
        console.log(`[${opts.fallbackLabel}] Réessai avec from=${defaultFrom}`);
        await trySend(defaultFrom);
        console.log(
          `[${opts.fallbackLabel}] Email envoyé à ${opts.to} via Resend from=${defaultFrom}`
        );
        return;
      } catch (secondError) {
        console.error(
          `[${opts.fallbackLabel}] Échec du réessai Resend avec from=${defaultFrom}:`,
          secondError
        );
      }
    }
    const message = firstError instanceof Error ? firstError.message : String(firstError);
    throw new Error(`Échec envoi email (${opts.fallbackLabel}): ${message}`);
  }
}
```

- [ ] **Step 2: Update `lib/auth.ts` to import from `lib/email.ts` instead of defining locally**

Replace lines 10-89 of `lib/auth.ts` (the `buildEmailHtml` and `sendEmail` function definitions) with nothing — delete them — and add the import at the top of the file:

```ts
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { pool } from "./db";
import { claimWelcomeBonus } from "./welcome-bonus";
import { sendEmail, buildEmailHtml } from "./email";
```

After this edit, `lib/auth.ts` should go directly from the `googleEnabled` constant to the `sendResetPasswordEmail` function (formerly at line 91), with no local `buildEmailHtml`/`sendEmail` definitions remaining in the file.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke check — password reset email still logs correctly in dev**

Run: `npm run dev`, then in another terminal:
```bash
curl -s -X POST http://localhost:3000/api/auth/forget-password \
  -H "Content-Type: application/json" \
  -d '{"email":"badraitoufel5@gmail.com","redirectTo":"http://localhost:3000/reset-password"}'
```
Expected: terminal running `npm run dev` logs a `📧 PASSWORD RESET (Resend non configuré)` block (assuming no `RESEND_API_KEY` in local `.env.local`) — confirms the extracted `sendEmail` still works through `lib/auth.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts lib/auth.ts
git commit -m "refactor(email): extract sendEmail/buildEmailHtml from auth.ts into lib/email.ts"
```

---

### Task 3: `lib/feature-flags.ts` — flip `STRIPE_ENABLED` to `false`

**Files:**
- Modify: `lib/feature-flags.ts:1`

**Interfaces:**
- Produces: `STRIPE_ENABLED = false`. Task 5 (UI) depends on this being `false` to render the waitlist branch.

- [ ] **Step 1: Flip the flag**

Change line 1 of `lib/feature-flags.ts` from:
```ts
export const STRIPE_ENABLED = true;
```
to:
```ts
export const STRIPE_ENABLED = false;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/feature-flags.ts
git commit -m "chore: flip STRIPE_ENABLED to false — waitlist mode until leads validated"
```

---

### Task 4: `POST /api/waitlist` route

**Files:**
- Create: `app/api/waitlist/route.ts`

**Interfaces:**
- Consumes: `pool` from `@/lib/db` (`pool.query<T>(sql, params): Promise<{ rows: T[] }>`), `auth` from `@/lib/auth` (`auth.api.getSession({ headers }): Promise<{ user: { id: string; email: string } } | null>`), `isPackKey`/`PACKS` from `@/lib/stripe-packs`, `checkRateLimit`/`getClientIp` from `@/lib/rate-limit`, `sendEmail`/`buildEmailHtml` from `@/lib/email`, `ADMIN_EMAILS` from `@/lib/admin`.
- Produces: `POST /api/waitlist` accepting JSON body `{ pack: string; email?: string }`, returning `{ ok: true }` (200) or `{ error: string }` (400/429/500). Task 5 (UI) calls this exact endpoint/shape.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isPackKey, PACKS } from "@/lib/stripe-packs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { ADMIN_EMAILS } from "@/lib/admin";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function notifyAdmin(email: string, pack: string) {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM "waitlist_signups"'
  );
  const total = rows[0]?.count ?? "?";
  const label = PACKS[pack as keyof typeof PACKS].label;
  const price = PACKS[pack as keyof typeof PACKS].price;

  for (const adminEmail of ADMIN_EMAILS) {
    await sendEmail({
      to: adminEmail,
      subject: `Nouveau lead — pack ${label} (${total} au total)`,
      fallbackLabel: "WAITLIST NOTIFY",
      html: buildEmailHtml({
        title: "Nouveau lead sur la liste d'attente",
        intro: `${email} veut acheter le pack ${label} (${price}). Total liste d'attente : ${total} inscrit(s).`,
        ctaLabel: "Voir la page de vente",
        url: "https://cv-optimizer.fr/buy-credits",
        footer: "Notification automatique — liste d'attente /buy-credits.",
      }),
    });
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`waitlist:${ip}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives, réessaie dans quelques minutes." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const packKey = body?.pack;
  if (typeof packKey !== "string" || !isPackKey(packKey)) {
    return NextResponse.json({ error: "Pack invalide." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  let email: string;
  let userId: string | null = null;

  if (session?.user) {
    email = session.user.email;
    userId = session.user.id;
  } else {
    const bodyEmail = typeof body?.email === "string" ? body.email.trim() : "";
    if (!EMAIL_RE.test(bodyEmail)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    email = bodyEmail;
  }

  try {
    await pool.query(
      `INSERT INTO "waitlist_signups" (email, pack, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (email, pack) DO NOTHING`,
      [email, packKey, userId]
    );
  } catch (err) {
    console.error("[api/waitlist] insert failed:", err);
    return NextResponse.json(
      { error: "Une erreur est survenue, réessaie." },
      { status: 500 }
    );
  }

  notifyAdmin(email, packKey).catch((err) =>
    console.error("[api/waitlist] admin notify failed:", err)
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual test — anonymous signup**

Run: `npm run dev`, then:
```bash
curl -s -X POST http://localhost:3000/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"pack":"starter","email":"test@example.com"}'
```
Expected: `{"ok":true}`. Dev server log shows a `📧 WAITLIST NOTIFY (Resend non configuré)` block (no `RESEND_API_KEY` locally) mentioning `test@example.com` and pack `Starter`.

- [ ] **Step 4: Manual test — idempotency**

Run the exact same `curl` command from Step 3 again.
Expected: `{"ok":true}` again, no error. Then verify only one row exists:
```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?{rejectUnauthorized:false}:undefined});p.query(\"SELECT count(*) FROM waitlist_signups WHERE email='test@example.com' AND pack='starter'\").then(r=>{console.log(r.rows);return p.end();})"
```
Expected: `count` is `1`.

- [ ] **Step 5: Manual test — invalid pack and invalid email rejected**

```bash
curl -s -X POST http://localhost:3000/api/waitlist -H "Content-Type: application/json" -d '{"pack":"nope","email":"test@example.com"}'
curl -s -X POST http://localhost:3000/api/waitlist -H "Content-Type: application/json" -d '{"pack":"starter","email":"not-an-email"}'
```
Expected: both return `{"error":"..."}` with 400 status (check via `curl -i` if you want to see the status line).

- [ ] **Step 6: Clean up test row**

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?{rejectUnauthorized:false}:undefined});p.query(\"DELETE FROM waitlist_signups WHERE email='test@example.com'\").then(()=>p.end())"
```

- [ ] **Step 7: Commit**

```bash
git add app/api/waitlist/route.ts
git commit -m "feat(waitlist): add POST /api/waitlist lead-capture route"
```

---

### Task 5: `/buy-credits` UI — waitlist mode

**Files:**
- Modify: `app/buy-credits/page.tsx`

**Interfaces:**
- Consumes: `POST /api/waitlist` with body `{ pack: PackKey, email?: string }` returning `{ ok: true } | { error: string }` (Task 4).
- Produces: nothing new consumed by later tasks — this is the leaf UI task.

- [ ] **Step 1: Add waitlist state and submit handler**

In `app/buy-credits/page.tsx`, inside `BuyCreditsContent`, replace the existing state block:

```tsx
const [loadingPack, setLoadingPack] = useState<PackKey | null>(null);
const [error, setError] = useState<string | null>(null);
```

with:

```tsx
const [loadingPack, setLoadingPack] = useState<PackKey | null>(null);
const [error, setError] = useState<string | null>(null);
const [waitlistStatus, setWaitlistStatus] = useState<Record<PackKey, "idle" | "loading" | "done">>({
  starter: "idle",
  pro: "idle",
  premium: "idle",
});
const [waitlistEmailDraft, setWaitlistEmailDraft] = useState<Record<PackKey, string>>({
  starter: "",
  pro: "",
  premium: "",
});
const [waitlistEmailOpen, setWaitlistEmailOpen] = useState<PackKey | null>(null);
const [waitlistError, setWaitlistError] = useState<string | null>(null);
```

Then add, right after the existing `handleBuy` function:

```tsx
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function submitWaitlist(pack: PackKey, email?: string) {
  setWaitlistError(null);
  setWaitlistStatus((s) => ({ ...s, [pack]: "loading" }));
  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack, email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Erreur inconnue");
    setWaitlistStatus((s) => ({ ...s, [pack]: "done" }));
    setWaitlistEmailOpen(null);
  } catch (err) {
    setWaitlistError(err instanceof Error ? err.message : "Erreur inconnue");
    setWaitlistStatus((s) => ({ ...s, [pack]: "idle" }));
  }
}

function handleWaitlistClick(pack: PackKey) {
  if (user?.email) {
    submitWaitlist(pack);
    return;
  }
  setWaitlistEmailOpen(pack);
}

function handleWaitlistConfirm(pack: PackKey) {
  const email = waitlistEmailDraft[pack].trim();
  if (!EMAIL_RE.test(email)) {
    setWaitlistError("Email invalide.");
    return;
  }
  submitWaitlist(pack, email);
}
```

- [ ] **Step 2: Update the banner copy for waitlist mode**

Replace:
```tsx
        {!STRIPE_ENABLED && (
          <div className="mb-8 border-l-2 border-warm bg-paper-deep px-5 py-4">
            <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-warm">
              ● Paiement par carte bientôt disponible
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              On finalise l'intégration Stripe. Les packs ci-dessous montrent les
              tarifs prévus — l'achat sera activé sous peu.
            </p>
          </div>
        )}
```
with:
```tsx
        {!STRIPE_ENABLED && (
          <div className="mb-8 border-l-2 border-warm bg-paper-deep px-5 py-4">
            <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-warm">
              ● Bêta — places limitées
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              On ouvre les paiements dès qu'on a assez de monde dessus. Dis-nous
              que tu es chaud, on te recontacte en priorité.
            </p>
          </div>
        )}
```

- [ ] **Step 3: Replace the per-pack button with the waitlist state machine**

Replace the existing button block:
```tsx
                <button
                  onClick={() => handleBuy(key)}
                  disabled={!STRIPE_ENABLED || isLoading || loadingPack !== null}
                  className={`mt-6 w-full px-5 py-3 font-mono text-[13px] uppercase tracking-[0.18em] transition ${
                    featured
                      ? "bg-ink text-paper hover:bg-accent disabled:bg-ink-faint disabled:opacity-60"
                      : "border border-ink text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
                  } disabled:cursor-not-allowed`}
                >
                  {!STRIPE_ENABLED
                    ? "Bientôt disponible"
                    : isLoading
                      ? "Redirection…"
                      : "Acheter"}
                </button>
```
with:
```tsx
                {STRIPE_ENABLED ? (
                  <button
                    onClick={() => handleBuy(key)}
                    disabled={isLoading || loadingPack !== null}
                    className={`mt-6 w-full px-5 py-3 font-mono text-[13px] uppercase tracking-[0.18em] transition ${
                      featured
                        ? "bg-ink text-paper hover:bg-accent disabled:bg-ink-faint disabled:opacity-60"
                        : "border border-ink text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
                    } disabled:cursor-not-allowed`}
                  >
                    {isLoading ? "Redirection…" : "Acheter"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleWaitlistClick(key)}
                      disabled={waitlistStatus[key] !== "idle"}
                      className={`mt-6 w-full px-5 py-3 font-mono text-[13px] uppercase tracking-[0.18em] transition ${
                        waitlistStatus[key] === "done"
                          ? "border border-success bg-success-soft text-success"
                          : featured
                            ? "bg-ink text-paper hover:bg-accent disabled:bg-ink-faint disabled:opacity-60"
                            : "border border-ink text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
                      } disabled:cursor-not-allowed`}
                    >
                      {waitlistStatus[key] === "done"
                        ? "✓ Tu es sur la liste"
                        : waitlistStatus[key] === "loading"
                          ? "Envoi…"
                          : "Je veux l'acheter"}
                    </button>
                    {waitlistStatus[key] === "done" && (
                      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-success">
                        On te recontacte dès l'ouverture.
                      </p>
                    )}
                    {waitlistEmailOpen === key && (
                      <div className="mt-3 flex flex-col gap-2">
                        <input
                          type="email"
                          value={waitlistEmailDraft[key]}
                          onChange={(e) =>
                            setWaitlistEmailDraft((d) => ({ ...d, [key]: e.target.value }))
                          }
                          placeholder="ton@email.com"
                          className="border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                        />
                        <button
                          onClick={() => handleWaitlistConfirm(key)}
                          disabled={waitlistStatus[key] === "loading"}
                          className="bg-ink px-4 py-2 font-mono text-[12px] uppercase tracking-[0.16em] text-paper transition hover:bg-accent disabled:opacity-60"
                        >
                          Confirmer
                        </button>
                      </div>
                    )}
                  </>
                )}
```

- [ ] **Step 4: Surface waitlist errors and update the footer copy**

Add a waitlist error display right after the existing `{error && (...)}` block:
```tsx
        {waitlistError && (
          <p
            role="alert"
            className="mt-4 font-mono text-[13px] uppercase tracking-[0.16em] text-danger"
          >
            ✕ {waitlistError}
          </p>
        )}
```

Replace the footer line:
```tsx
        <p className="mt-10 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
          ● Paiement sécurisé par Stripe · Aucune donnée carte stockée
        </p>
```
with:
```tsx
        <p className="mt-10 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
          {STRIPE_ENABLED
            ? "● Paiement sécurisé par Stripe · Aucune donnée carte stockée"
            : "● On t'écrit par email dès l'ouverture des paiements"}
        </p>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual browser test — logged-in flow**

Run: `npm run dev`, sign in with an existing test account, navigate to `http://localhost:3000/buy-credits`.
Expected: banner reads "● Bêta — places limitées". Each pack button reads "Je veux l'acheter". Click one → button flips to "Envoi…" then "✓ Tu es sur la liste" with the "On te recontacte dès l'ouverture." note. Click another pack's button → same flow independently (first pack stays in "done" state).

- [ ] **Step 7: Manual browser test — anonymous flow**

Open the page in an incognito window (no session), navigate to `/buy-credits`.
Expected: clicking "Je veux l'acheter" reveals an email input + "Confirmer" button under that pack. Submitting with an invalid email (e.g. `abc`) shows "✕ Email invalide." inline and sends no request (check Network tab). Submitting a valid email flips the button to "✓ Tu es sur la liste".

- [ ] **Step 8: Manual browser test — duplicate click**

While still on the page from Step 6/7, refresh and click the same pack again with the same identity (same logged-in user, or re-enter the same email in the anonymous flow).
Expected: still flips to "✓ Tu es sur la liste", no error surfaced.

- [ ] **Step 9: Commit**

```bash
git add app/buy-credits/page.tsx
git commit -m "feat(waitlist): replace disabled buy button with lead-capture flow on /buy-credits"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), email refactor (Task 2), flag flip (Task 3), API route incl. rate limit/idempotency/notification (Task 4), UI states/copy (Task 5) — all five spec sections have a task.
- **Type consistency:** `PackKey` used identically across Task 4 (`isPackKey`, `PACKS[pack as keyof typeof PACKS]`) and Task 5 (`waitlistStatus: Record<PackKey, ...>`, `handleWaitlistClick(pack: PackKey)`) — matches `lib/stripe-packs.ts`'s existing exported type.
- **No placeholders:** every step has literal code/commands; no "add validation" or "TBD" left in.
