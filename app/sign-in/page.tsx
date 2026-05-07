"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get("redirect") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await signIn.email({ email, password });
    if (err) {
      setError(err.message ?? "Échec de connexion");
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main className="min-h-screen hero-bg">
      <div className="mx-auto flex max-w-md flex-col px-6 pt-20 pb-16">
        <Link
          href="/"
          className="mb-10 self-start font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
        >
          ← CV Optimizer
        </Link>

        <h1 className="font-display text-5xl font-light leading-[0.95] tracking-tight text-ink">
          Bon <span className="italic font-normal text-accent">retour</span>.
        </h1>
        <p className="mt-4 text-base text-ink-soft">
          Connecte-toi pour optimiser ton CV et générer ta lettre.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <div>
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
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

          <div>
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-danger">
              ✕ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group inline-flex w-full items-center justify-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{loading ? "Connexion…" : "Se connecter"}</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </button>
        </form>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
          Pas de compte ?{" "}
          <Link
            href={`/sign-up${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="text-accent hover:underline"
          >
            Créer un compte →
          </Link>
        </p>
      </div>
    </main>
  );
}
