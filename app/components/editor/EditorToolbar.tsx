"use client";

import { useEffect, useState } from "react";
import type { AccentKey, EditorAction, TemplateKey } from "@/app/lib/editorState";
import { ACCENT_HEX, TEMPLATE_HINT, TEMPLATE_LABEL } from "@/app/lib/editorState";

type Props = {
  accent: AccentKey;
  template: TemplateKey;
  dispatch: React.Dispatch<EditorAction>;
  onReset: () => void;
};

const ACCENT_ORDER: AccentKey[] = ["blue", "warm", "green", "ink"];
const ACCENT_LABEL: Record<AccentKey, string> = {
  blue: "Bleu",
  warm: "Orange",
  green: "Vert",
  ink: "Noir",
};
const TEMPLATE_ORDER: TemplateKey[] = ["classic", "single", "ats"];

function TemplateIcon({ template, active }: { template: TemplateKey; active: boolean }) {
  const stroke = active ? "currentColor" : "currentColor";
  return (
    <svg viewBox="0 0 24 18" className="h-3.5 w-4.5" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="17" fill="none" stroke={stroke} strokeWidth="1" />
      {template === "classic" && (
        <>
          <line x1="3" y1="4" x2="14" y2="4" stroke={stroke} strokeWidth="1.5" />
          <line x1="3" y1="8" x2="21" y2="8" stroke={stroke} strokeWidth="0.6" />
          <line x1="3" y1="11" x2="21" y2="11" stroke={stroke} strokeWidth="0.6" />
          <line x1="3" y1="14" x2="18" y2="14" stroke={stroke} strokeWidth="0.6" />
        </>
      )}
      {template === "single" && (
        <>
          <line x1="8" y1="4" x2="16" y2="4" stroke={stroke} strokeWidth="1.5" />
          <line x1="4" y1="8" x2="20" y2="8" stroke={stroke} strokeWidth="0.6" />
          <line x1="4" y1="11" x2="20" y2="11" stroke={stroke} strokeWidth="0.6" />
          <line x1="4" y1="14" x2="20" y2="14" stroke={stroke} strokeWidth="0.6" />
        </>
      )}
      {/* ATS : nom centré, puis titres de section soulignés d'un filet plein */}
      {template === "ats" && (
        <>
          <line x1="9" y1="3.5" x2="15" y2="3.5" stroke={stroke} strokeWidth="1.5" />
          <line x1="3" y1="7" x2="21" y2="7" stroke={stroke} strokeWidth="1" />
          <line x1="3" y1="9.5" x2="17" y2="9.5" stroke={stroke} strokeWidth="0.6" />
          <line x1="3" y1="12.5" x2="21" y2="12.5" stroke={stroke} strokeWidth="1" />
          <line x1="3" y1="15" x2="17" y2="15" stroke={stroke} strokeWidth="0.6" />
        </>
      )}
    </svg>
  );
}

export function EditorToolbar({ accent, template, dispatch, onReset }: Props) {
  // Petit indicateur visuel "Sauvegardé" — pulse 1s après chaque changement
  const [savedPulse, setSavedPulse] = useState(false);
  useEffect(() => {
    setSavedPulse(true);
    const t = setTimeout(() => setSavedPulse(false), 1100);
    return () => clearTimeout(t);
  }, [accent, template]);

  return (
    <div className="sticky top-0 z-30 -mx-8 -mt-10 mb-6 border-b border-rule bg-paper/95 backdrop-blur sm:-mx-12 sm:-mt-14">
      {/* ============ ROW 1 — Statut + Reset ============ */}
      <div className="flex items-center justify-between gap-3 px-8 py-2.5 sm:px-12">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full transition-transform duration-200 ${
              savedPulse ? "bg-success scale-150" : "bg-success/60"
            }`}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
            {savedPulse ? "Sauvegardé" : "Mode édition · auto-save"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Réinitialiser le CV à la version générée ? Toutes tes modifications seront perdues."
              )
            ) {
              onReset();
            }
          }}
          title="Réinitialiser le CV"
          className="group inline-flex h-8 items-center gap-2 border border-rule px-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted transition hover:border-danger hover:text-danger"
        >
          <svg
            viewBox="0 0 14 14"
            className="h-3.5 w-3.5 transition-transform group-hover:-rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <path d="M2 7a5 5 0 1 0 1.5-3.5" strokeLinecap="round" />
            <path d="M2 2v3h3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Réinitialiser</span>
        </button>
      </div>

      {/* ============ ROW 2 — Couleur + Template ============ */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule px-8 py-2.5 sm:px-12">
        {/* Palette de couleurs */}
        <fieldset className="flex items-center gap-2">
          <legend className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-faint">
            Couleur
          </legend>
          <div role="radiogroup" aria-label="Couleur d'accent" className="flex items-center gap-1.5">
            {ACCENT_ORDER.map((key) => {
              const active = accent === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => dispatch({ type: "SET_ACCENT", accent: key })}
                  title={ACCENT_LABEL[key]}
                  className={`relative h-6 w-6 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:ring-ink ${
                    active
                      ? "ring-2 ring-offset-2 ring-offset-paper ring-ink scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: ACCENT_HEX[key] }}
                >
                  {active && (
                    <svg
                      viewBox="0 0 12 12"
                      className="absolute inset-0 m-auto h-3 w-3 text-paper drop-shadow"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="M2.5 6.5L5 9L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Séparateur vertical (md+) */}
        <span aria-hidden className="hidden h-4 w-px bg-rule md:block" />

        {/* Sélecteur de template */}
        <fieldset className="flex items-center gap-2">
          <legend className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-faint">
            Layout
          </legend>
          <div
            role="radiogroup"
            aria-label="Disposition"
            className="inline-flex items-center gap-0.5 rounded-full border border-rule bg-card p-0.5"
          >
            {TEMPLATE_ORDER.map((key) => {
              const active = template === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => dispatch({ type: "SET_TEMPLATE", template: key })}
                  title={TEMPLATE_HINT[key]}
                  aria-label={TEMPLATE_HINT[key]}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink lg:px-2.5 ${
                    active
                      ? "bg-ink text-paper"
                      : "text-ink-muted hover:bg-paper-deep hover:text-ink"
                  }`}
                >
                  <TemplateIcon template={key} active={active} />
                  <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.18em] lg:inline">
                    {TEMPLATE_LABEL[key]}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
