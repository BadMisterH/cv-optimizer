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

/**
 * Iframe qui rend le HTML EXACT utilisé par /api/pdf — preview pixel-perfect.
 * - Re-render via srcDoc (pas de network, tout est local)
 * - Debounce 250ms pour ne pas surcharger sur édition rapide
 * - Scaling auto pour tenir dans le parent (zoom-out)
 */
export function LivePreview({ cv, photo, accent, template }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Mesure la largeur du conteneur pour calculer le zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build HTML — déjà mémoisé sur les inputs
  const html = useMemo(
    () => buildHtml(cv, photo ?? undefined, ACCENT_HEX[accent], template),
    [cv, photo, accent, template]
  );

  // Debounce le srcDoc : si plusieurs édits rapides, on attend 250ms
  const [debouncedHtml, setDebouncedHtml] = useState(html);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHtml(html), 250);
    return () => clearTimeout(t);
  }, [html]);

  // A4 à 96dpi = 794px × 1123px. On scale pour tenir dans containerWidth.
  const A4_W = 794;
  const A4_H = 1123;
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / A4_W) : 1;
  const scaledH = A4_H * scale;

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className="overflow-hidden border border-rule bg-white shadow-[0_18px_44px_-22px_rgba(15,15,16,0.28)]"
        style={{ height: `${scaledH}px` }}
      >
        <iframe
          srcDoc={debouncedHtml}
          title="Aperçu PDF en direct"
          sandbox="allow-same-origin"
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
        <span>↪ aperçu PDF en direct</span>
        <span>A4 · {Math.round(scale * 100)} %</span>
      </div>
    </div>
  );
}
