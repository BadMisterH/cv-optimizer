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
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/sign-in?redirect=/account");
    }
  }, [isPending, session, router]);

  if (isPending || !session?.user) {
    return (
      <main className="min-h-screen bg-paper">
        <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
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
            className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
          >
            ← Retour
          </Link>
        </div>

        <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-ink-muted">
          ● Mon compte
        </span>

        <h1 className="mt-6 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
          Paramètres du compte
        </h1>

        <section className="mt-12 border border-rule bg-paper-deep p-6 sm:p-8">
          <h2 className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
            Profil
          </h2>
          <dl className="mt-4 space-y-3">
            {user.name && (
              <div className="flex flex-wrap items-baseline gap-3">
                <dt className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                  Nom
                </dt>
                <dd className="text-base text-ink">{user.name}</dd>
              </div>
            )}
            <div className="flex flex-wrap items-baseline gap-3">
              <dt className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                Email
              </dt>
              <dd className="text-base text-ink">{user.email}</dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <dt className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                Crédits
              </dt>
              <dd className="text-base text-ink">
                {isAdmin ? "∞ (admin)" : `${credits} crédit${credits > 1 ? "s" : ""}`}
              </dd>
            </div>
          </dl>
        </section>

        <div className="mt-16 border-t border-rule pt-8">
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted transition hover:text-danger"
            >
              Supprimer mon compte →
            </button>
          ) : (
            <div className="max-w-xl">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                  Suppression du compte
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowDelete(false);
                    setConfirmText("");
                    setError(null);
                  }}
                  disabled={deleting}
                  className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faint hover:text-ink disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                Action <span className="text-danger">irréversible</span>. Profil
                et historique supprimés. Tu pourras te réinscrire, mais sans les
                crédits de bienvenue.
              </p>

              <label className="mt-5 block">
                <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
                  Tape <span className="text-danger">{CONFIRM_WORD}</span> pour confirmer
                </span>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={deleting}
                  autoComplete="off"
                  autoFocus
                  className="mt-2 w-full max-w-xs border border-rule bg-paper px-3 py-2 font-mono text-sm tracking-[0.04em] text-ink outline-none transition focus:border-danger disabled:opacity-50"
                  placeholder={CONFIRM_WORD}
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="mt-3 font-mono text-[13px] uppercase tracking-[0.16em] text-danger"
                >
                  ✕ {error}
                </p>
              )}

              <button
                onClick={handleDelete}
                disabled={!canDelete}
                className="mt-5 inline-flex items-center gap-2 border border-danger px-4 py-2 font-mono text-[13px] uppercase tracking-[0.18em] text-danger transition hover:bg-danger hover:text-paper disabled:cursor-not-allowed disabled:border-ink-faint disabled:text-ink-faint disabled:hover:bg-transparent"
              >
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
