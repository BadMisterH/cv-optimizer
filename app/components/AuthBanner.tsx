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

  if (isPending) {
    return (
      <div
        aria-hidden
        className="min-h-[116px] border-b border-rule bg-paper-deep sm:min-h-[65px]"
      />
    );
  }

  // Utilisateur connecté → affiche le solde de crédits
  if (session?.user) {
    const user = session.user as SessionUser;
    const isAdmin = isAdminEmail(user.email);
    const credits = user.credits ?? 0;
    const isEmpty = !isAdmin && credits <= 0;

    return (
      <div className="border-b border-rule bg-paper-deep">
        <div className="mx-auto flex max-w-360 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="w-full font-mono text-xs uppercase tracking-[0.16em] text-ink-muted sm:w-auto sm:tracking-[0.18em]">
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
          <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto">
            <Link
              href="/account"
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full px-3 font-mono text-xs uppercase tracking-[0.16em] text-ink-muted transition hover:bg-paper hover:text-ink sm:px-4 sm:tracking-[0.18em]"
            >
              Mon compte
            </Link>
            {!isAdmin && (
              <Link
                href="/buy-credits"
                className={`group inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 font-mono text-xs uppercase tracking-[0.14em] transition sm:px-5 sm:tracking-[0.18em] ${
                  isEmpty
                    ? "cta-primary"
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
      <div className="mx-auto flex max-w-360 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="w-full font-mono text-xs uppercase tracking-[0.16em] text-ink-muted sm:w-auto sm:tracking-[0.18em]">
          <span className="text-warm">●</span> Crée un compte gratuit · 1 génération offerte à l&apos;inscription
        </p>
        <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto">
          <Link
            href={`/sign-in?redirect=${redirect}`}
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full px-3 font-mono text-xs uppercase tracking-[0.16em] text-ink-muted transition hover:bg-paper hover:text-ink sm:px-4 sm:tracking-[0.18em]"
          >
            Se connecter
          </Link>
          <Link
            href={`/sign-up?redirect=${redirect}`}
            className="cta-primary group inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 font-mono text-xs uppercase tracking-[0.14em] sm:px-5 sm:tracking-[0.18em]"
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
