"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export function AuthBanner() {
  const { data: session, isPending } = useSession();
  const pathname = usePathname() ?? "/";
  const redirect = encodeURIComponent(pathname);

  if (isPending || session?.user) return null;

  return (
    <div className="border-b border-rule bg-paper-deep">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
          <span className="text-warm">●</span> Connecte-toi pour optimiser et télécharger tes CV / lettres
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
