"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
import { STRIPE_ENABLED } from "@/lib/feature-flags";
import {
  getPackBonusCredits,
  getPackTotalCredits,
  isPackKey,
  isLaunchOfferActive,
  LAUNCH_OFFER,
  PACKS,
  type PackKey,
} from "@/lib/stripe-packs";
import { Logo } from "../components/Logo";

type SessionUser = {
  id?: string;
  email?: string;
  credits?: number;
};

type SyncStatus = "idle" | "syncing" | "done" | "error";

const PACK_CONTEXT: Record<PackKey, string> = {
  starter: "Pour quelques candidatures ciblées",
  pro: "Pour une recherche active",
  premium: "Pour candidater sur la durée",
};

function formatUnitPrice(amountCents: number, credits: number) {
  return `${(amountCents / 100 / credits).toFixed(2).replace(".", ",")} €`;
}

export default function BuyCreditsPage() {
  return (
    <Suspense fallback={null}>
      <BuyCreditsContent />
    </Suspense>
  );
}

function BuyCreditsContent() {
  const { data: session, isPending, refetch } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncedBalance, setSyncedBalance] = useState<number | null>(null);

  const user = session?.user as SessionUser | undefined;
  const credits = user?.credits ?? 0;
  const displayedCredits = syncedBalance ?? credits;
  const isAdmin = isAdminEmail(user?.email);
  const launchOfferActive = isLaunchOfferActive();

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";
  const checkoutSessionId = searchParams.get("session_id");
  const requestedPack = searchParams.get("pack");
  const selectedPack = requestedPack && isPackKey(requestedPack) ? requestedPack : null;

  async function handleBuy(pack: PackKey) {
    if (!STRIPE_ENABLED) return;
    if (!user) {
      const redirect = encodeURIComponent(`/buy-credits?pack=${pack}`);
      window.location.href = `/sign-in?redirect=${redirect}`;
      return;
    }
    setError(null);
    setLoadingPack(pack);
    try {
      const bonusCredits = getPackBonusCredits(pack);
      const totalCredits = getPackTotalCredits(pack);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur checkout");
      if (data?.url) {
        // Garde une trace du pack acheté pour personnaliser le message de succès
        try {
          sessionStorage.setItem(
            "cv-optimizer:pending-purchase",
            JSON.stringify({
              pack,
              label: PACKS[pack].label,
              credits: PACKS[pack].credits,
              bonusCredits,
              totalCredits,
              price: PACKS[pack].price,
            })
          );
        } catch {}
        window.location.href = data.url;
        return;
      }
      throw new Error("URL de paiement absente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoadingPack(null);
    }
  }

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

  // Récupère le détail du pack acheté (côté client) après retour de Stripe
  type PendingPurchase = {
    pack: PackKey;
    label: string;
    credits?: number;
    bonusCredits?: number;
    totalCredits?: number;
    price: string;
  };
  const [purchased, setPurchased] = useState<PendingPurchase | null>(null);

  useEffect(() => {
    if (!success || purchased !== null || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("cv-optimizer:pending-purchase");
      if (!raw) return;
      setPurchased(JSON.parse(raw));
      window.sessionStorage.removeItem("cv-optimizer:pending-purchase");
    } catch {}
  }, [success, purchased]);

  useEffect(() => {
    if (!success || !STRIPE_ENABLED || !checkoutSessionId || !user?.id) return;

    let cancelled = false;

    async function syncCheckoutSession() {
      setSyncStatus("syncing");
      setSyncError(null);
      try {
        const res = await fetch("/api/checkout/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: checkoutSessionId }),
        });
        const data = await res.json().catch(() => null) as {
          balance?: number;
          error?: string;
        } | null;

        if (!res.ok) {
          throw new Error(data?.error ?? "Impossible de synchroniser le paiement.");
        }

        if (cancelled) return;
        if (typeof data?.balance === "number") {
          setSyncedBalance(data.balance);
        }
        setSyncStatus("done");
        await refetch({ query: { disableCookieCache: true } });
      } catch (err) {
        if (cancelled) return;
        setSyncStatus("error");
        setSyncError(
          err instanceof Error
            ? err.message
            : "Paiement confirmé, mais synchronisation des crédits impossible."
        );
      }
    }

    syncCheckoutSession();
    return () => {
      cancelled = true;
    };
  }, [success, checkoutSessionId, user?.id, refetch]);

  // ========== VUE SUCCÈS DÉDIÉE ==========
  if (success && STRIPE_ENABLED) {
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

          {/* Bandeau de succès */}
          <div className="border-l-2 border-success bg-success-soft px-6 py-5">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-success">
              ✓ Paiement confirmé
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              Ton paiement a été traité avec succès. Merci !
            </p>
          </div>

          {/* Carte de récap */}
          <section className="mt-10 border border-rule bg-card p-8 sm:p-10">
            <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-success">
              ● Crédits ajoutés
            </span>
            <h1 className="mt-4 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[0.95] tracking-tight text-ink">
              {purchased ? (
                <>
                  + {purchased.totalCredits ?? purchased.credits ?? 0}{" "}
                  <span className="italic font-normal text-accent">crédits</span>
                </>
              ) : (
                <>
                  Crédits <span className="italic font-normal text-accent">ajoutés</span>
                </>
              )}
            </h1>
            {purchased && (
              <div className="mt-4 space-y-2">
                <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                  Pack {purchased.label} · {purchased.price}
                </p>
                {(purchased.bonusCredits ?? 0) > 0 && (
                  <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-success">
                    +{purchased.bonusCredits} crédits offerts avec l'offre de lancement
                  </p>
                )}
              </div>
            )}
            <div className="mt-8 flex items-baseline justify-between border-t border-rule pt-6">
              <span className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                Nouveau solde
              </span>
              <span className="font-display text-3xl font-medium tracking-tight text-ink">
                {isAdmin
                  ? "∞"
                  : syncStatus === "syncing" && syncedBalance === null
                    ? "..."
                    : displayedCredits}
                <span className="ml-2 text-base font-normal text-ink-muted">
                  crédit{displayedCredits > 1 ? "s" : ""}
                </span>
              </span>
            </div>
            {syncStatus === "syncing" && (
              <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">
                ● Synchronisation des crédits...
              </p>
            )}
            {syncStatus === "error" && (
              <p
                role="alert"
                className="mt-4 font-mono text-[12px] uppercase tracking-[0.16em] text-danger"
              >
                ✕ {syncError}
              </p>
            )}
          </section>

          {/* CTAs */}
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
              href="/lettre"
              className="inline-flex items-center justify-center border border-rule px-6 py-4 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted transition hover:border-ink hover:text-ink"
            >
              Rédiger une lettre
            </Link>
          </div>

          <p className="mt-10 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faint">
            ● Un reçu Stripe t&apos;a été envoyé par email
          </p>
        </div>
      </main>
    );
  }

  // ========== VUE NORMALE (pricing) ==========
  return (
    <main className="min-h-screen bg-paper">
      <section className="hero-bg border-b border-rule">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-10 lg:pb-20 lg:pt-14">
          <div className="flex items-center justify-between gap-6">
            <Logo size="md" />
            <button
              type="button"
              onClick={() => router.back()}
              className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted transition hover:text-ink"
            >
              ← Retour
            </button>
          </div>

          {canceled && (
            <div className="mt-8 border-l-2 border-warm bg-warm-soft px-5 py-4">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-warm">
                ● Paiement annulé
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                Aucun montant n&apos;a été débité. Ton pack reste disponible ci-dessous.
              </p>
            </div>
          )}

          {!STRIPE_ENABLED && (
            <div className="mt-8 border-l-2 border-warm bg-warm-soft px-5 py-4">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-warm">
                ● Paiements bientôt disponibles
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                Choisis le pack qui t&apos;intéresse et laisse ton email pour être prévenu en priorité.
              </p>
            </div>
          )}

          <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-warm">
                {isAdmin
                  ? "● Compte admin — accès illimité"
                  : user
                    ? credits <= 0
                      ? "● Prêt à recharger"
                      : "● Compléter ton solde"
                    : "● Packs sans abonnement"}
              </p>
              <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.8rem,6vw,5.2rem)] font-light leading-[0.94] tracking-[-0.03em] text-ink">
                Choisis ton rythme.{" "}
                <span className="italic font-normal text-accent">Garde le contrôle.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
                Un crédit génère un CV optimisé ou une lettre de motivation.
                Tu paies une fois, puis tu utilises tes crédits quand tu en as besoin.
              </p>
              {!isPending && user && (
                <p className="mt-6 inline-flex border border-rule bg-card px-4 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">
                  Solde actuel&nbsp;: {isAdmin ? "∞ (admin)" : `${credits} crédit${credits > 1 ? "s" : ""}`}
                </p>
              )}
            </div>

            <aside className="border border-rule bg-card p-6 lg:col-span-5 lg:p-8">
              {launchOfferActive ? (
                <>
                  <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-warm">
                    ● {LAUNCH_OFFER.label}
                  </p>
                  <p className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight text-ink">
                    {LAUNCH_OFFER.headline}
                  </p>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                    Jusqu&apos;au {LAUNCH_OFFER.endsOnLabel}. Le bonus est ajouté
                    automatiquement au paiement.
                  </p>
                </>
              ) : (
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
              )}
              <div className="mt-6 grid grid-cols-2 gap-px bg-rule">
                <div className="bg-paper p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">Paiement</p>
                  <p className="mt-2 font-medium text-ink">Stripe</p>
                </div>
                <div className="bg-paper p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">Validité</p>
                  <p className="mt-2 font-medium text-ink">Sans expiration</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-ink-muted">
              1 crédit = 1 génération
            </p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] font-light leading-none tracking-tight text-ink">
              Trois packs. Aucune surprise.
            </h2>
          </div>
          <p className="max-w-sm text-[14px] leading-relaxed text-ink-soft">
            Le pack Pro offre le meilleur équilibre pour une recherche active.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-6 font-mono text-[13px] uppercase tracking-[0.16em] text-danger">
            ✕ {error}
          </p>
        )}
        {waitlistError && (
          <p role="alert" className="mt-6 font-mono text-[13px] uppercase tracking-[0.16em] text-danger">
            ✕ {waitlistError}
          </p>
        )}

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {(Object.keys(PACKS) as PackKey[]).map((key) => {
            const pack = PACKS[key];
            const recommended = "featured" in pack && pack.featured;
            const highlighted = selectedPack ? selectedPack === key : recommended;
            const isLoading = loadingPack === key;
            const bonusCredits = getPackBonusCredits(key);
            const totalCredits = getPackTotalCredits(key);
            const unitPrice = formatUnitPrice(pack.amountCents, totalCredits);

            return (
              <article
                key={key}
                className={`relative flex min-h-full flex-col border p-7 transition lg:p-8 ${
                  highlighted
                    ? "order-first border-action bg-accent-soft shadow-[0_28px_80px_-46px_rgba(33,71,232,0.8)] lg:order-none"
                    : "border-rule bg-card hover:border-ink-faint"
                }`}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-7 bg-action px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-on-action">
                    {selectedPack === key ? "Ton choix" : "Recommandé"}
                  </span>
                )}
                <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-ink-muted">
                  {pack.label}
                </p>
                <p className="mt-5 font-display text-5xl font-medium leading-none tracking-tight text-ink">
                  {totalCredits}
                  <span className="ml-2 text-base font-normal text-ink-muted">crédits</span>
                </p>
                {bonusCredits > 0 && (
                  <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.16em] text-success">
                    {pack.credits} + {bonusCredits} offerts
                  </p>
                )}
                <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
                  {PACK_CONTEXT[key]}
                </p>

                <div className="mt-7 border-t border-rule pt-6">
                  <div className="flex items-end justify-between gap-4">
                    <p className="font-display text-3xl font-medium tracking-tight text-ink">
                      {pack.price}
                    </p>
                    <p className="pb-1 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-muted">
                      {unitPrice} / génération
                    </p>
                  </div>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                    Paiement unique · crédits sans expiration
                  </p>
                </div>

                {STRIPE_ENABLED ? (
                  <button
                    type="button"
                    onClick={() => handleBuy(key)}
                    disabled={isLoading || loadingPack !== null}
                    className={`mt-7 min-h-13 w-full px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-55 ${
                      highlighted
                        ? "cta-primary"
                        : "border border-ink bg-transparent text-ink transition hover:bg-ink hover:text-paper"
                    }`}
                  >
                    {isLoading ? "Ouverture de Stripe…" : `Choisir ${pack.label}`}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleWaitlistClick(key)}
                      disabled={waitlistStatus[key] !== "idle"}
                      className={`mt-7 min-h-13 w-full px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-55 ${
                        waitlistStatus[key] === "done"
                          ? "border border-success bg-success-soft text-success"
                          : highlighted
                            ? "cta-primary"
                            : "border border-ink text-ink transition hover:bg-ink hover:text-paper"
                      }`}
                    >
                      {waitlistStatus[key] === "done"
                        ? "✓ Tu es sur la liste"
                        : waitlistStatus[key] === "loading"
                          ? "Envoi…"
                          : `Choisir ${pack.label}`}
                    </button>
                    {waitlistEmailOpen === key && (
                      <div className="mt-3 flex flex-col gap-2">
                        <input
                          type="email"
                          value={waitlistEmailDraft[key]}
                          onChange={(e) =>
                            setWaitlistEmailDraft((draft) => ({ ...draft, [key]: e.target.value }))
                          }
                          placeholder="ton@email.com"
                          className="border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => handleWaitlistConfirm(key)}
                          disabled={waitlistStatus[key] === "loading"}
                          className="cta-primary px-4 py-2 font-mono text-[12px] uppercase tracking-[0.16em] disabled:opacity-60"
                        >
                          Confirmer
                        </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          {[
            ["text-success", "Paiement sécurisé", "Stripe traite la carte. Aucune donnée bancaire n'est stockée ici."],
            ["text-accent", "Sans abonnement", "Tu achètes un pack une fois. Aucun renouvellement automatique."],
            ["text-warm", "Crédits durables", "Ils sont ajoutés automatiquement et n'expirent pas."],
          ].map(([tone, label, text]) => (
            <article key={label} className="bg-card p-6">
              <p className={`font-mono text-[12px] uppercase tracking-[0.18em] ${tone}`}>
                ● {label}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{text}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-rule pt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            {STRIPE_ENABLED
              ? "Paiement sécurisé par Stripe · Reçu envoyé par email"
              : "On t'écrit dès l'ouverture des paiements"}
          </p>
          <div className="flex flex-wrap gap-5">
            <Link href="/cgu" className="transition hover:text-ink">CGU</Link>
            <Link href="/remboursement" className="transition hover:text-ink">Remboursement</Link>
            <a href="mailto:contact@cv-optimizer.fr" className="transition hover:text-ink">Une question ?</a>
          </div>
        </div>
      </section>
    </main>
  );
}
