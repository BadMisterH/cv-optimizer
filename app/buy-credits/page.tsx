"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
import { STRIPE_ENABLED } from "@/lib/feature-flags";
import { PACKS, type PackKey } from "@/lib/stripe-packs";
import { Logo } from "../components/Logo";

type SessionUser = {
  email?: string;
  credits?: number;
};

export default function BuyCreditsPage() {
  return (
    <Suspense fallback={null}>
      <BuyCreditsContent />
    </Suspense>
  );
}

function BuyCreditsContent() {
  const { data: session, isPending } = useSession();
  const searchParams = useSearchParams();
  const [loadingPack, setLoadingPack] = useState<PackKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const user = session?.user as SessionUser | undefined;
  const credits = user?.credits ?? 0;
  const isAdmin = isAdminEmail(user?.email);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  async function handleBuy(pack: PackKey) {
    if (!STRIPE_ENABLED) return;
    if (!user) {
      window.location.href = "/sign-in?redirect=/buy-credits";
      return;
    }
    setError(null);
    setLoadingPack(pack);
    try {
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
            JSON.stringify({ pack, label: PACKS[pack].label, credits: PACKS[pack].credits, price: PACKS[pack].price })
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

  // Récupère le détail du pack acheté (côté client) après retour de Stripe
  type PendingPurchase = { pack: PackKey; label: string; credits: number; price: string };
  const [purchased, setPurchased] = useState<PendingPurchase | null>(null);
  if (success && purchased === null && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("cv-optimizer:pending-purchase");
      if (raw) {
        setPurchased(JSON.parse(raw));
        sessionStorage.removeItem("cv-optimizer:pending-purchase");
      }
    } catch {}
  }

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
                  + {purchased.credits}{" "}
                  <span className="italic font-normal text-accent">crédits</span>
                </>
              ) : (
                <>
                  Crédits <span className="italic font-normal text-accent">ajoutés</span>
                </>
              )}
            </h1>
            {purchased && (
              <p className="mt-4 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                Pack {purchased.label} · {purchased.price}
              </p>
            )}
            <div className="mt-8 flex items-baseline justify-between border-t border-rule pt-6">
              <span className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                Nouveau solde
              </span>
              <span className="font-display text-3xl font-medium tracking-tight text-ink">
                {isAdmin ? "∞" : credits}
                <span className="ml-2 text-base font-normal text-ink-muted">
                  crédit{credits > 1 ? "s" : ""}
                </span>
              </span>
            </div>
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
              ● Paiement par carte bientôt disponible
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              On finalise l'intégration Stripe. Les packs ci-dessous montrent les
              tarifs prévus — l'achat sera activé sous peu.
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

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {(Object.keys(PACKS) as PackKey[]).map((key) => {
            const pack = PACKS[key];
            const featured = "featured" in pack && pack.featured;
            const isLoading = loadingPack === key;
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
                  {pack.credits}
                  <span className="ml-2 text-base font-normal text-ink-muted">
                    crédits
                  </span>
                </p>
                <p className="mt-2 text-2xl font-medium text-ink">{pack.price}</p>
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
              </div>
            );
          })}
        </section>

        <p className="mt-10 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
          ● Paiement sécurisé par Stripe · Aucune donnée carte stockée
        </p>
      </div>
    </main>
  );
}
