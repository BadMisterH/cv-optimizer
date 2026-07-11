"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GoogleButton } from "@/app/components/GoogleButton";
import { Logo } from "@/app/components/Logo";
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
  const isCheckoutReturn = redirectTo.startsWith("/buy-credits");
  const justReset = search.get("reset") === "ok";
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
        <Logo size="md" className="mb-10 self-start" />

        <h1 className="font-display text-5xl font-light leading-[0.95] tracking-tight text-ink">
          Bon <span className="italic font-normal text-accent">retour</span>.
        </h1>
        <p className="mt-4 text-base text-ink-soft">
          {isCheckoutReturn
            ? "Connecte-toi pour finaliser ton pack. Ton choix et le tarif sont conservés."
            : "Connecte-toi pour optimiser ton CV et générer ta lettre."}
        </p>

        {justReset && (
          <div className="mt-6 border-l-2 border-success bg-success-soft/40 p-4 font-mono text-[13px] uppercase tracking-[0.16em] text-success">
            ✓ Mot de passe mis à jour — connecte-toi avec le nouveau
          </div>
        )}

        <div className="mt-10 space-y-4">
          <GoogleButton callbackURL={redirectTo} />
          <div className="flex items-center gap-3 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
            <span className="h-px flex-1 bg-rule" />
            ou avec email
            <span className="h-px flex-1 bg-rule" />
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink-muted outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
              placeholder="badr@exemple.com"
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="block font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                Mot de passe
              </label>
              <Link
                href="/forgot-password"
                className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted hover:text-accent"
              >
                Oublié ?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-rule bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink-muted outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
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
            className="cta-primary group inline-flex w-full items-center justify-center gap-3 px-7 py-4 text-sm font-medium tracking-tight disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{loading ? "Connexion…" : "Se connecter"}</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </button>
        </form>

        <p className="mt-8 font-mono text-[13px] uppercase tracking-[0.16em] text-ink-muted">
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
