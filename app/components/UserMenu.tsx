"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (isPending || !session?.user) return null;

  const display = session.user.name?.trim() || session.user.email.split("@")[0];
  const initial = display.charAt(0).toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setOpen(false);
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu utilisateur"
        className="group inline-flex h-10 items-center gap-2.5 rounded-full border border-rule bg-card pl-1 pr-3 transition hover:border-ink focus:border-ink focus:outline-none focus:ring-4 focus:ring-accent-soft"
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-paper"
          aria-hidden
        >
          {initial}
        </span>
        <span className="hidden md:inline font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
          {display.length > 14 ? `${display.slice(0, 12)}…` : display}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 origin-top-right border border-rule bg-card shadow-[0_18px_44px_-22px_rgba(15,15,16,0.28)]"
        >
          <div className="border-b border-rule px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Connecté
            </p>
            <p className="mt-1.5 truncate font-display text-base font-medium text-ink">
              {display}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-ink-muted">
              {session.user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            role="menuitem"
            className="group flex w-full items-center justify-between px-5 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink transition hover:bg-paper-deep hover:text-danger disabled:opacity-50"
          >
            <span>{signingOut ? "Déconnexion…" : "Se déconnecter"}</span>
            <span
              aria-hidden
              className="text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-danger"
            >
              ↗
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}
