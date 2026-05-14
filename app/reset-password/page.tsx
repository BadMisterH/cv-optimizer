"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/app/components/Logo";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setLoading(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Lien invalide ou expiré");
      return;
    }
    router.push("/sign-in?reset=ok");
    router.refresh();
  }

  if (!token) {
    return (
      <main className="min-h-screen hero-bg">
        <div className="mx-auto flex max-w-md flex-col px-6 pt-20 pb-16">
          <Logo size="md" className="mb-10 self-start" />
          <h1 className="font-display text-4xl font-light leading-[1] tracking-tight text-ink">
            Lien <span className="italic font-normal text-danger">invalide</span>.
          </h1>
          <p className="mt-4 text-base text-ink-soft">
            Ce lien de réinitialisation est incomplet ou a déjà été utilisé.
          </p>
          <Link
            href="/forgot-password"
            className="mt-8 inline-flex items-center gap-2 font-mono text-[13px] uppercase tracking-[0.2em] text-accent hover:underline"
          >
            Demander un nouveau lien →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen hero-bg">
      <div className="mx-auto flex max-w-md flex-col px-6 pt-20 pb-16">
        <Logo size="md" className="mb-6 self-start" />
        <Link
          href="/sign-in"
          className="mb-10 self-start font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
        >
          ← Connexion
        </Link>

        <h1 className="font-display text-5xl font-light leading-[0.95] tracking-tight text-ink">
          Nouveau <span className="italic font-normal text-accent">mot de passe</span>.
        </h1>
        <p className="mt-4 text-base text-ink-soft">
          Choisis un mot de passe d&apos;au moins 8 caractères.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <div>
            <label className="mb-2 block font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="mb-2 block font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
              Confirme
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
              placeholder="••••••••"
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
            <span>{loading ? "Mise à jour…" : "Mettre à jour mon mot de passe"}</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </button>
        </form>
      </div>
    </main>
  );
}
