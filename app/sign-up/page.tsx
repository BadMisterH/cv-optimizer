"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GoogleButton } from "@/app/components/GoogleButton";
import { Logo } from "@/app/components/Logo";
import { signUp } from "@/lib/auth-client";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const search = useSearchParams();
  const redirectTo = search.get("redirect") ?? "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await signUp.email({
      email,
      password,
      name: name.trim() || email.split("@")[0],
      callbackURL: redirectTo,
    });
    if (err) {
      setError(err.message ?? "Échec d'inscription");
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen hero-bg">
      <div className="mx-auto flex max-w-md flex-col px-6 pt-20 pb-16">
        <Logo size="md" className="mb-10 self-start" />

        <h1 className="font-display text-5xl font-light leading-[0.95] tracking-tight text-ink">
          Crée ton <span className="italic font-normal text-warm">compte</span>.
        </h1>

        {sent ? (
          <div className="mt-8 border-l-2 border-success bg-success-soft/40 p-5">
            <p className="font-display text-lg font-medium text-ink">
              ✓ Email envoyé
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Un lien de confirmation a été envoyé à{" "}
              <strong className="text-ink">{email}</strong>. Clique dessus pour
              activer ton compte (lien valable 1h).
            </p>
            <p className="mt-3 font-mono text-[13px] uppercase tracking-[0.16em] text-ink-muted">
              Pense à vérifier les spams. Tu seras connecté automatiquement après confirmation.
            </p>
          </div>
        ) : (
          <>
        <p className="mt-4 text-base text-ink-soft">
          Optimise tes CV et lettres autant que tu veux. Pas de carte bancaire pour démarrer.
        </p>

        <div className="mt-10 space-y-4">
          <GoogleButton
            callbackURL={redirectTo}
            label="S'inscrire avec Google"
          />
          <div className="flex items-center gap-3 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-faint">
            <span className="h-px flex-1 bg-rule" />
            ou avec email
            <span className="h-px flex-1 bg-rule" />
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
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
            <label className="mb-2 block font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
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
            <label className="mb-2 block font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
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
            <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-danger">
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

        <p className="mt-8 font-mono text-[13px] uppercase tracking-[0.16em] text-ink-muted">
          Déjà un compte ?{" "}
          <Link
            href={`/sign-in${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="text-accent hover:underline"
          >
            Se connecter →
          </Link>
        </p>
          </>
        )}
      </div>
    </main>
  );
}
