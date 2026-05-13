"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Logo } from "../components/Logo";

type SessionUser = {
  credits?: number;
};

export default function BuyCreditsPage() {
  const { data: session } = useSession();
  const credits = (session?.user as SessionUser | undefined)?.credits ?? 0;

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
        <div className="mb-12 flex items-center justify-between">
          <Logo size="md" />
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
          >
            ← Retour
          </Link>
        </div>

        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-warm">
          ● Solde épuisé
        </span>

        <h1 className="mt-6 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[0.95] tracking-[-0.02em] text-ink">
          Achète des{" "}
          <span className="italic font-normal text-accent">crédits</span>.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Tu as épuisé tes crédits gratuits. Pour continuer à générer des CV et
          lettres de motivation, choisis un pack de crédits ci-dessous.
        </p>

        <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
          Solde actuel : {credits} crédit{credits > 1 ? "s" : ""}
        </p>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { label: "Starter", credits: 5, price: "4,99 €" },
            { label: "Standard", credits: 15, price: "11,99 €", featured: true },
            { label: "Pro", credits: 50, price: "29,99 €" },
          ].map((pack) => (
            <div
              key={pack.label}
              className={`relative border ${pack.featured ? "border-accent bg-paper-deep" : "border-rule bg-paper"} p-6`}
            >
              {pack.featured && (
                <span className="absolute -top-3 left-6 bg-accent px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-paper">
                  Recommandé
                </span>
              )}
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
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
                disabled
                className="mt-6 w-full cursor-not-allowed bg-ink-faint px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-paper opacity-60"
              >
                Bientôt disponible
              </button>
            </div>
          ))}
        </section>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          ● Stripe intégré prochainement
        </p>
      </div>
    </main>
  );
}
