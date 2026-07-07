"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
import { STRIPE_ENABLED } from "@/lib/feature-flags";
import {
  getPackBonusCredits,
  getPackTotalCredits,
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

export default function BuyCreditsPage() {
  return (
    <Suspense fallback={null}>
      <BuyCreditsContent />
    </Suspense>
  );
}

function BuyCreditsContent() {
  const { data: session, isPending, refetch } = useSession();
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

  async function handleBuy(pack: PackKey) {
    if (!STRIPE_ENABLED) return;
    if (!user) {
      window.location.href = "/sign-in?redirect=/buy-credits";
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
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
        <div className="mb-12 flex items-center justify-between">
          <Logo size="md" />
          <Link
            href="/"
            className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
          >
            ← Retour
          </Link>
        </div>

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

        {canceled && (
          <div className="mb-8 border-l-2 border-warm bg-paper-deep px-5 py-4">
            <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-warm">
              ● Paiement annulé
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Aucun montant n'a été débité. Tu peux réessayer ci-dessous.
            </p>
          </div>
        )}

        <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-warm">
          {isAdmin ? "● Compte admin — accès illimité" : credits <= 0 ? "● Solde épuisé" : "● Recharger ton solde"}
        </span>

        <h1 className="mt-6 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[0.95] tracking-[-0.02em] text-ink">
          Achète des{" "}
          <span className="italic font-normal text-accent">crédits</span>.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Chaque crédit te permet de générer un CV ou une lettre de motivation.
          Paiement sécurisé via Stripe. Pas d'abonnement.
        </p>

        {launchOfferActive && (
          <div className="mt-8 border border-warm bg-warm-soft px-5 py-4">
            <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-warm">
              ● {LAUNCH_OFFER.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {LAUNCH_OFFER.headline} sur tous les packs, jusqu'au{" "}
              {LAUNCH_OFFER.endsOnLabel}. Le bonus est ajouté automatiquement
              après paiement.
            </p>
          </div>
        )}

        {!isPending && (
          <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
            Solde actuel : {isAdmin ? "∞ (admin)" : `${credits} crédit${credits > 1 ? "s" : ""}`}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 font-mono text-[13px] uppercase tracking-[0.16em] text-danger"
          >
            ✕ {error}
          </p>
        )}

        {waitlistError && (
          <p
            role="alert"
            className="mt-4 font-mono text-[13px] uppercase tracking-[0.16em] text-danger"
          >
            ✕ {waitlistError}
          </p>
        )}

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {(Object.keys(PACKS) as PackKey[]).map((key) => {
            const pack = PACKS[key];
            const featured = "featured" in pack && pack.featured;
            const isLoading = loadingPack === key;
            const bonusCredits = getPackBonusCredits(key);
            const totalCredits = getPackTotalCredits(key);
            return (
              <div
                key={key}
                className={`relative border ${featured ? "border-accent bg-paper-deep" : "border-rule bg-paper"} p-6`}
              >
                {featured && (
                  <span className="absolute -top-3 left-6 bg-accent px-3 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-paper">
                    Recommandé
                  </span>
                )}
                <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                  {pack.label}
                </p>
                <p className="mt-4 font-display text-4xl font-light tracking-tight text-ink">
                  {totalCredits}
                  <span className="ml-2 text-base font-normal text-ink-muted">
                    crédits
                  </span>
                </p>
                {bonusCredits > 0 && (
                  <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.16em] text-success">
                    {pack.credits} + {bonusCredits} offerts
                  </p>
                )}
                <p className="mt-2 text-2xl font-medium text-ink">{pack.price}</p>
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
                    {isLoading
                      ? "Redirection…"
                      : launchOfferActive
                      ? "Profiter de l'offre"
                      : "Acheter"}
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
              </div>
            );
          })}
        </section>

        <section className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          {[
            {
              tone: "text-success",
              label: "Paiement sécurisé",
              text: "Stripe traite la carte. CV Optimizer ne stocke aucune donnée bancaire.",
            },
            {
              tone: "text-accent",
              label: "Sans abonnement",
              text: "Tu achètes un pack une fois. Aucun renouvellement automatique.",
            },
            {
              tone: "text-warm",
              label: "Crédits automatiques",
              text: "Le solde est ajouté après paiement et utilisable sur CV ou lettre.",
            },
          ].map((item) => (
            <article key={item.label} className="bg-card p-5">
              <p className={`font-mono text-[12px] uppercase tracking-[0.18em] ${item.tone}`}>
                ● {item.label}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.text}</p>
            </article>
          ))}
        </section>

        <p className="mt-10 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
          {STRIPE_ENABLED
            ? "● Paiement sécurisé par Stripe · Aucune donnée carte stockée"
            : "● On t'écrit par email dès l'ouverture des paiements"}
        </p>
      </div>
    </main>
  );
}
