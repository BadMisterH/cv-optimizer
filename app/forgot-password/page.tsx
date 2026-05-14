"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/app/components/Logo";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Échec d'envoi");
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen hero-bg">
      <div className="mx-auto flex max-w-md flex-col px-6 pt-20 pb-16">
        <Logo size="md" className="mb-6 self-start" />
        <Link
          href="/sign-in"
          className="mb-10 self-start font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
        >
          ← Retour à la connexion
        </Link>

        <h1 className="font-display text-5xl font-light leading-[0.95] tracking-tight text-ink">
          Mot de passe <span className="italic font-normal text-accent">oublié</span>.
        </h1>

        {sent ? (
          <div className="mt-8 border-l-2 border-success bg-success-soft/40 p-5">
            <p className="font-display text-lg font-medium text-ink">
              ✓ Email envoyé
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Si un compte est associé à <strong>{email}</strong>, tu vas recevoir un lien pour réinitialiser ton mot de passe (valable 1h).
            </p>
            <p className="mt-3 font-mono text-[13px] uppercase tracking-[0.16em] text-ink-muted">
              Pense à vérifier les spams.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-ink-soft">
              Entre l&apos;email associé à ton compte. On t&apos;enverra un lien pour choisir un nouveau mot de passe.
            </p>

            <form onSubmit={onSubmit} className="mt-10 space-y-5">
              <div>
                <label className="mb-2 block font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
                  placeholder="badr@exemple.com"
                />
              </div>

              {error && (
                <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-danger">
                  ✕ {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group inline-flex w-full items-center justify-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{loading ? "Envoi…" : "Envoyer le lien"}</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
