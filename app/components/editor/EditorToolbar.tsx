"use client";

import type { AccentKey, EditorAction, TemplateKey } from "@/app/lib/editorState";
import { ACCENT_HEX, TEMPLATE_LABEL } from "@/app/lib/editorState";

type Props = {
  accent: AccentKey;
  template: TemplateKey;
  dispatch: React.Dispatch<EditorAction>;
  onReset: () => void;
};

const ACCENT_ORDER: AccentKey[] = ["blue", "warm", "green", "ink"];
const TEMPLATE_ORDER: TemplateKey[] = ["classic", "sidebar-left", "sidebar-right", "single"];

export function EditorToolbar({ accent, template, dispatch, onReset }: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-8 mb-6 border-b border-rule bg-paper/95 px-8 py-3 backdrop-blur sm:-mx-12 sm:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Couleur d'accent */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
            Couleur
          </span>
          <div className="flex items-center gap-1.5">
            {ACCENT_ORDER.map((key) => {
              const active = accent === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => dispatch({ type: "SET_ACCENT", accent: key })}
                  aria-label={`Couleur ${key}`}
                  aria-pressed={active}
                  style={{ backgroundColor: ACCENT_HEX[key] }}
                  className={`h-6 w-6 rounded-full border-2 transition ${
                    active ? "border-ink scale-110" : "border-paper hover:scale-105"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Template */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
            Template
          </span>
          <div className="flex items-center gap-1 rounded-full border border-rule bg-card p-0.5">
            {TEMPLATE_ORDER.map((key) => {
              const active = template === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => dispatch({ type: "SET_TEMPLATE", template: key })}
                  className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition ${
                    active
                      ? "bg-ink text-paper rounded-full"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {TEMPLATE_LABEL[key]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={() => {
            if (confirm("Réinitialiser le CV à la version générée ? Toutes tes modifications seront perdues.")) {
              onReset();
            }
          }}
          className="inline-flex items-center gap-2 border border-rule px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted transition hover:border-danger hover:text-danger"
        >
          ↺ Réinitialiser
        </button>
      </div>
    </div>
  );
}
