"use client";

import { useEffect, useState } from "react";
import type { ATSScore as ATSScoreType } from "@/app/types";

type Props = {
  score: ATSScoreType;
};

/** Clamp 0..100, par sécurité au cas où le modèle renverrait hors bornes. */
function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Carte d'affichage du score ATS — placée au-dessus du résultat CV.
 * Animations : compteur 0→N à l'apparition, barres qui s'animent.
 * Couleurs sémantiques : rouge < 60, orange 60-79, vert 80+.
 */
export function ATSScore({ score }: Props) {
  const overall = clamp(score.overall);
  const keywords = clamp(score.keywords);
  const skills = clamp(score.skills);
  const structure = clamp(score.structure);
  const tone = scoreTone(overall);

  return (
    <section
      className="border border-rule bg-card p-6 shadow-[0_1px_0_0_rgba(15,15,16,0.04)] sm:p-8"
      aria-label="Score ATS du CV"
    >
      <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
        {/* Big score */}
        <div className="flex items-center gap-6 md:flex-col md:items-start md:gap-3 md:border-r md:border-rule md:pr-8">
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
              Score ATS
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <AnimatedNumber to={overall} className={`font-display text-[80px] font-light leading-none tracking-tight ${tone.text}`} />
              <span className="font-mono text-[14px] text-ink-faint">/ 100</span>
            </div>
            <span className={`mt-2 font-mono text-[12px] uppercase tracking-[0.22em] ${tone.text}`}>
              <span aria-hidden>● </span>
              {tone.label}
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          <ScoreBar label="Mots-clés" value={keywords} />
          <ScoreBar label="Compétences" value={skills} />
          <ScoreBar label="Structure" value={structure} />
        </div>
      </div>

      {/* Tips + missing keywords */}
      {(score.tips.length > 0 || score.missingKeywords.length > 0) && (
        <details className="group/score mt-6 border-t border-rule pt-5">
          <summary className="flex cursor-pointer items-baseline justify-between gap-3 list-none">
            <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink">
              ▾ Comment passer à 95+
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted transition group-open/score:rotate-180 group-open/score:opacity-0">
              Cliquer pour développer
            </span>
          </summary>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {score.tips.length > 0 && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                  ● Suggestions
                </p>
                <ul className="mt-3 space-y-2">
                  {score.tips.map((tip, i) => (
                    <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-ink-soft">
                      <span
                        aria-hidden
                        className="mt-2 inline-block h-px w-3 shrink-0 bg-accent"
                      />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {score.missingKeywords.length > 0 && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-warm">
                  ● Mots-clés à intégrer
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {score.missingKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-sm border border-dashed border-warm bg-warm-soft px-2 py-0.5 font-mono text-[12px] text-warm"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
                  Ces mots de l&apos;offre apparaissent peu ou pas dans ton CV.
                  Ajoute-les si tu as l&apos;expérience correspondante.
                </p>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

/* ============ Utilities ============ */

function scoreTone(value: number): { text: string; bg: string; bar: string; label: string } {
  if (value >= 80) {
    return {
      text: "text-success",
      bg: "bg-success-soft",
      bar: "bg-success",
      label: value >= 95 ? "Excellent match" : "Très bon match",
    };
  }
  if (value >= 60) {
    return {
      text: "text-warm",
      bg: "bg-warm-soft",
      bar: "bg-warm",
      label: "Match correct",
    };
  }
  return {
    text: "text-danger",
    bg: "bg-danger-soft",
    bar: "bg-danger",
    label: "À améliorer",
  };
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = scoreTone(value);
  return (
    <div className="flex items-center gap-4">
      <span className="w-24 shrink-0 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </span>
      <div className="relative h-1.5 flex-1 overflow-hidden bg-rule">
        <div
          className={`h-full ${tone.bar} transition-[width] duration-1000 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`w-12 shrink-0 text-right font-mono text-[13px] font-medium tabular-nums ${tone.text}`}>
        <AnimatedNumber to={value} />
      </span>
    </div>
  );
}

/** Compteur 0 → N avec easing 1s. Respecte prefers-reduced-motion. */
function AnimatedNumber({ to, className }: { to: number; className?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    // Respecte reduced-motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    const duration = 1000;
    const start = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);

  return <span className={className}>{value}</span>;
}
