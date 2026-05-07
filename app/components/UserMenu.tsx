"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (isPending) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
        …
      </span>
    );
  }

  if (!session?.user) {
    return (
      <Link
        href="/sign-in"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted hover:text-ink"
      >
        Se connecter →
      </Link>
    );
  }

  const display = session.user.name?.trim() || session.user.email;
  const initial = display.charAt(0).toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-paper"
        aria-hidden
      >
        {initial}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted hidden md:inline">
        {display.length > 18 ? `${display.slice(0, 16)}…` : display}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint hover:text-danger disabled:opacity-50"
        title="Se déconnecter"
      >
        {signingOut ? "…" : "↗"}
      </button>
    </div>
  );
}
