"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
import { Logo } from "../components/Logo";

type SessionUser = {
  name?: string;
  email?: string;
  credits?: number;
};

const CONFIRM_WORD = "SUPPRIMER";

export default function AccountPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/sign-in?redirect=/account");
    }
  }, [isPending, session, router]);

  if (isPending || !session?.user) {
    return (
      <main className="min-h-screen bg-paper">
        <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
            Chargement…
          </p>
        </div>
      </main>
    );
  }

  const user = session.user as SessionUser;
  const isAdmin = isAdminEmail(user.email);
  const credits = user.credits ?? 0;

  const canDelete = confirmText === CONFIRM_WORD && !deleting;

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur inconnue");
      // Force un reload complet pour clear le state client et la session
      window.location.href = "/?account_deleted=true";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setDeleting(false);
    }
  }

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

        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-muted">
          ● Mon compte
        </span>

        <h1 className="mt-6 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
          Paramètres du compte
        </h1>

        <section className="mt-12 border border-rule bg-paper-deep p-6 sm:p-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
            Profil
          </h2>
          <dl className="mt-4 space-y-3">
            {user.name && (
              <div className="flex flex-wrap items-baseline gap-3">
                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                  Nom
                </dt>
                <dd className="text-base text-ink">{user.name}</dd>
              </div>
            )}
            <div className="flex flex-wrap items-baseline gap-3">
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                Email
              </dt>
              <dd className="text-base text-ink">{user.email}</dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                Crédits
              </dt>
              <dd className="text-base text-ink">
                {isAdmin ? "∞ (admin)" : `${credits} crédit${credits > 1 ? "s" : ""}`}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-8 border-l-2 border-danger bg-paper-deep p-6 sm:p-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-danger">
            ● Zone de danger
          </h2>

          <h3 className="mt-4 font-display text-2xl font-medium tracking-tight text-ink">
            Supprimer mon compte
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Cette action est <strong>irréversible</strong>. Tes données de profil et
            ton historique sont supprimés définitivement. Tu pourras te réinscrire
            plus tard, mais tu ne pourras plus bénéficier des crédits de bienvenue.
          </p>

          <label className="mt-6 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Tape <span className="text-danger">{CONFIRM_WORD}</span> pour confirmer
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              className="mt-2 w-full max-w-xs border border-rule bg-paper px-4 py-3 font-mono text-sm tracking-[0.04em] text-ink outline-none transition focus:border-danger disabled:opacity-50"
              placeholder={CONFIRM_WORD}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-danger"
            >
              ✕ {error}
            </p>
          )}

          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="mt-6 inline-flex items-center gap-3 bg-danger px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-ink-faint disabled:opacity-60"
          >
            {deleting ? "Suppression en cours…" : "Supprimer définitivement"}
          </button>
        </section>
      </div>
    </main>
  );
}
