"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cv-optimizer:editor-help-seen";
const AUTO_DISMISS_MS = 10_000; // 10 secondes

/**
 * Hint pédagogique discret pour le mode édition.
 * - S'affiche uniquement la PREMIÈRE fois qu'un user entre en mode édition
 * - Auto-dismiss après 10s
 * - Bouton × pour fermer manuellement
 * - Mémorisé en localStorage → ne réapparaît jamais
 */
export function EditorHelpHint() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Au mount, lis le localStorage. Si déjà vu, on n'affiche jamais.
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // localStorage inaccessible → on affiche quand même
    }
    setVisible(true);

    // Auto-dismiss après 10s
    const t = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setExiting(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    // Laisse la transition d'opacité jouer avant unmount
    setTimeout(() => setVisible(false), 220);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`group/hint relative flex items-start gap-3 border-l-2 border-accent bg-accent-soft/30 px-4 py-2.5 transition-opacity duration-200 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-paper"
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 3v3M6 8v.5" strokeLinecap="round" />
        </svg>
      </span>

      <p className="flex-1 text-[13px] leading-snug text-ink-soft">
        <span className="font-medium text-ink">Astuce</span> · clique n&apos;importe quel texte pour le modifier · survole une section pour drag-and-drop · changements sauvegardés en temps réel.
      </p>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer l'astuce"
        className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center text-ink-faint transition hover:text-ink"
      >
        <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 3L11 11M11 3L3 11" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
