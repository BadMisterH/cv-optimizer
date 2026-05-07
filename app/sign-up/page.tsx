"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { signUp } from "@/lib/auth-client";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get("redirect") ?? "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await signUp.email({
      email,
      password,
      name: name.trim() || email.split("@")[0],
    });
    if (err) {
      setError(err.message ?? "Échec d'inscription");
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
          Crée ton <span className="italic font-normal text-warm">compte</span>.
        </h1>
        <p className="mt-4 text-base text-ink-soft">
          Optimise tes CV et lettres autant que tu veux. Pas de carte bancaire pour démarrer.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <div>
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              Prénom <span className="text-ink-faint">(optionnel)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-warm focus:shadow-[0_0_0_4px_var(--color-warm-soft)]"
              placeholder="Badr"
            />
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-warm focus:shadow-[0_0_0_4px_var(--color-warm-soft)]"
              placeholder="badr@exemple.com"
            />
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              Mot de passe <span className="text-ink-faint">(min. 8 caractères)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-warm focus:shadow-[0_0_0_4px_var(--color-warm-soft)]"
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
            className="group inline-flex w-full items-center justify-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-warm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{loading ? "Création…" : "Créer mon compte"}</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </button>
        </form>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
          Déjà un compte ?{" "}
          <Link
            href={`/sign-in${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="text-accent hover:underline"
          >
            Se connecter →
          </Link>
        </p>
      </div>
    </main>
  );
}
