"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";

type SessionUser = {
  name?: string;
  email?: string;
  credits?: number;
};

export function AuthBanner() {
  const { data: session, isPending } = useSession();
  const pathname = usePathname() ?? "/";
  const redirect = encodeURIComponent(pathname);

  if (isPending) return null;

  // Utilisateur connecté → affiche le solde de crédits
  if (session?.user) {
    const user = session.user as SessionUser;
    const isAdmin = isAdminEmail(user.email);
    const credits = user.credits ?? 0;
    const isEmpty = !isAdmin && credits <= 0;

    return (
      <div className="border-b border-rule bg-paper-deep">
        <div className="mx-auto flex max-w-360 flex-wrap items-center justify-between gap-3 px-6 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            <span className={isEmpty ? "text-danger" : "text-success"}>●</span>{" "}
            {user.name ?? user.email ?? "Connecté"} ·{" "}
            {isAdmin ? (
              <span className="text-accent">∞ crédits (admin)</span>
            ) : (
              <>
                <span className={isEmpty ? "text-danger" : "text-ink"}>
                  {credits} crédit{credits > 1 ? "s" : ""}
                </span>{" "}
                {isEmpty ? "· solde épuisé" : "restant" + (credits > 1 ? "s" : "")}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/account"
              className="inline-flex h-10 items-center rounded-full px-4 font-mono text-xs uppercase tracking-[0.18em] text-ink-muted transition hover:bg-paper hover:text-ink"
            >
              Mon compte
            </Link>
            {!isAdmin && (
              <Link
                href="/buy-credits"
                className={`group inline-flex h-10 items-center gap-2 rounded-full px-5 font-mono text-xs uppercase tracking-[0.18em] transition ${
                  isEmpty
                    ? "bg-ink text-paper hover:bg-accent"
                    : "border border-rule text-ink-muted hover:border-ink hover:text-ink"
                }`}
              >
                {isEmpty ? "Acheter des crédits" : "Recharger"}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Utilisateur anonyme → bannière d'inscription
  return (
    <div className="border-b border-rule bg-paper-deep">
      <div className="mx-auto flex max-w-360 flex-wrap items-center justify-between gap-3 px-6 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
          <span className="text-warm">●</span> Crée un compte gratuit · 1 génération offerte à l&apos;inscription
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/sign-in?redirect=${redirect}`}
            className="inline-flex h-10 items-center rounded-full px-4 font-mono text-xs uppercase tracking-[0.18em] text-ink-muted transition hover:bg-paper hover:text-ink"
          >
            Se connecter
          </Link>
          <Link
            href={`/sign-up?redirect=${redirect}`}
            className="group inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 font-mono text-xs uppercase tracking-[0.18em] text-paper transition hover:bg-accent"
          >
            Créer un compte
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
