"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OptimizedCV } from "@/app/types";
import { buildHtml, type Template } from "@/lib/cv-html";
import { ACCENT_HEX, type AccentKey } from "@/app/lib/editorState";

type Props = {
  cv: OptimizedCV;
  photo: string | null;
  accent: AccentKey;
  template: Template;
};

const A4_W = 794;
const A4_H = 1123;

/**
 * Iframe qui rend le HTML EXACT utilisé par /api/pdf — preview pixel-perfect.
 * - Auto-scale par défaut pour tenir dans le parent
 * - Bouton "Plein écran" → modal A4 à 100% (ou max-fit fenêtre)
 * - Debounce 250ms sur srcDoc pour éviter le jank
 */
export function LivePreview({ cv, photo, accent, template }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // Mesure la largeur du conteneur
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build HTML mémoïsé
  const html = useMemo(
    () => buildHtml(cv, photo ?? undefined, ACCENT_HEX[accent], template),
    [cv, photo, accent, template]
  );

  // Debounce 250ms
  const [debouncedHtml, setDebouncedHtml] = useState(html);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHtml(html), 250);
    return () => clearTimeout(t);
  }, [html]);

  // Échap pour fermer le plein écran
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  const scale = containerWidth > 0 ? Math.min(1, containerWidth / A4_W) : 1;
  const scaledH = A4_H * scale;
  const pct = Math.round(scale * 100);

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        {/* Toolbar du preview */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-accent">
            <span className="text-accent">●</span> Aperçu PDF en direct
          </p>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="group inline-flex items-center gap-1.5 border border-rule px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted transition hover:border-ink hover:text-ink"
            aria-label="Ouvrir l'aperçu en plein écran"
          >
            <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M2 5V2H5M9 2H12V5M12 9V12H9M5 12H2V9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Plein écran</span>
          </button>
        </div>

        <div
          className="overflow-hidden border border-rule bg-white shadow-[0_18px_44px_-22px_rgba(15,15,16,0.28)]"
          style={{ height: `${scaledH}px` }}
        >
          <iframe
            srcDoc={debouncedHtml}
            title="Aperçu PDF en direct"
            sandbox=""
            className="block border-0 bg-white"
            style={{
              width: `${A4_W}px`,
              height: `${A4_H}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-faint">
          <span>↪ aperçu du rendu final</span>
          <span>A4 · {pct} %</span>
        </div>
      </div>

      {/* Modal plein écran */}
      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu PDF plein écran"
          className="fixed inset-0 z-50 flex flex-col bg-ink/85 backdrop-blur"
          onClick={(e) => {
            // Clic sur le backdrop (pas sur la modal) → ferme
            if (e.target === e.currentTarget) setFullscreen(false);
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-paper/10 px-6 py-3">
            <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-paper">
              <span className="text-accent">●</span> Aperçu PDF · A4
            </p>
            <div className="flex items-center gap-2">
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-paper/60 sm:inline">
                Esc pour fermer
              </span>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                aria-label="Fermer"
                className="inline-flex h-9 w-9 items-center justify-center border border-paper/20 text-paper transition hover:border-paper hover:bg-paper/10"
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M3 3L11 11M11 3L3 11" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Contenu : A4 centré, scrollable si trop grand */}
          <div className="flex-1 overflow-auto p-6 sm:p-10">
            <div
              className="mx-auto bg-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.5)]"
              style={{ width: `${A4_W}px`, height: `${A4_H}px` }}
            >
              <iframe
                srcDoc={debouncedHtml}
                title="Aperçu PDF plein écran"
                sandbox=""
                className="block h-full w-full border-0 bg-white"
              />
            </div>
            <p className="mx-auto mt-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60">
              ↪ rendu exact du PDF · 100 %
            </p>
          </div>
        </div>
      )}
    </>
  );
}
