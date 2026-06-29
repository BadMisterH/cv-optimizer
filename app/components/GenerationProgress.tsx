"use client";

import { useEffect, useState } from "react";

type Variant = "cv" | "letter";

type Step = {
  label: string;
  delayMs: number; // moment où on coche cette étape
};

const STEPS_BY_VARIANT: Record<Variant, Step[]> = {
  cv: [
    { label: "Lecture du CV (extraction du PDF)", delayMs: 3000 },
    { label: "Analyse de l'offre d'emploi", delayMs: 8000 },
    { label: "Optimisation des mots-clés ATS", delayMs: 22000 },
    { label: "Mise en page sur une page A4", delayMs: 35000 },
  ],
  letter: [
    { label: "Analyse du CV et de l'offre", delayMs: 3000 },
    { label: "Rédaction des paragraphes (ton humain)", delayMs: 10000 },
    { label: "Personnalisation et choix des mots", delayMs: 22000 },
    { label: "Relecture finale", delayMs: 32000 },
  ],
};

const TIPS_BY_VARIANT: Record<Variant, string[]> = {
  cv: [
    "L'IA reformule les bullets pour les ATS sans rien inventer dans ton parcours.",
    "Les compétences sont réorganisées pour matcher l'offre, pas modifiées.",
    "Le score ATS dépend des mots-clés exacts présents dans l'offre.",
    "Tout est généré pour tenir sur une seule page A4.",
  ],
  letter: [
    "On évite les tirets cadratins, les formules creuses et l'auto-flagornerie.",
    "Chaque lettre cite un élément précis de ton CV et de l'offre.",
    "Le ton est calibré pour un recruteur français, ni guindé ni familier.",
    "Entre 280 et 340 mots, structurés en 3 ou 4 paragraphes.",
  ],
};

export function GenerationProgress({
  active,
  variant,
}: {
  active: boolean;
  variant: Variant;
}) {
  const steps = STEPS_BY_VARIANT[variant];
  const tips = TIPS_BY_VARIANT[variant];

  const [currentStep, setCurrentStep] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!active) {
      setCurrentStep(0);
      setTipIndex(0);
      setElapsedSec(0);
      return;
    }

    // Avance les étapes selon leurs delayMs
    const stepTimers = steps.map((step, idx) =>
      setTimeout(() => setCurrentStep(idx + 1), step.delayMs)
    );

    // Rotation des tips toutes les 6s
    const tipsInterval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 6000);

    // Compteur de secondes écoulées
    const tickInterval = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    return () => {
      stepTimers.forEach(clearTimeout);
      clearInterval(tipsInterval);
      clearInterval(tickInterval);
    };
  }, [active, steps, tips.length]);

  if (!active) return null;

  // Progress = ratio currentStep / total, mais on cap à 95% tant qu'on n'a pas la réponse
  // (la réponse fera disparaître le composant entièrement)
  const progressPct = Math.min(95, (currentStep / steps.length) * 100);
  const estimatedSec = 30;
  const remainingSec = Math.max(0, estimatedSec - elapsedSec);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-10 border border-rule bg-paper-deep p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-4">
        <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink">
          <span className="inline-block h-2 w-2 animate-pulse bg-accent" />{" "}
          {variant === "cv" ? "Optimisation du CV" : "Rédaction de la lettre"} en cours
        </p>
        <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
          {remainingSec > 0
            ? `~${remainingSec}s restantes`
            : "Encore quelques secondes…"}
        </p>
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <li
              key={idx}
              className="flex items-start gap-3 font-mono text-[12px] tracking-[0.02em]"
            >
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isDone
                    ? "border-success bg-success text-paper"
                    : isActive
                      ? "border-accent text-accent"
                      : "border-rule text-ink-faint"
                }`}
              >
                {isDone ? (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current">
                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                ) : null}
              </span>
              <span
                className={
                  isDone
                    ? "text-ink-muted line-through decoration-success/30"
                    : isActive
                      ? "text-ink"
                      : "text-ink-faint"
                }
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 h-1 w-full overflow-hidden bg-rule">
        <div
          className="h-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
        <span aria-hidden className="mt-0.5 text-warm">●</span>
        <span>{tips[tipIndex]}</span>
      </p>
    </div>
  );
}
