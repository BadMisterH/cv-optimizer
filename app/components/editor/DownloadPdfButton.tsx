"use client";

import { useState } from "react";
import type { OptimizedCV } from "@/app/types";
import { ACCENT_HEX, type AccentKey, type TemplateKey } from "@/app/lib/editorState";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

/**
 * Bouton de téléchargement du PDF, partagé entre la génération IA
 * (/optimiser) et la saisie manuelle (/creer).
 *
 * `/api/pdf` est un renderer pur : ni authentification ni crédit. Le
 * téléchargement fonctionne donc aussi pour un visiteur anonyme.
 */
export function DownloadPdfButton({
  cv,
  photo,
  accent = "blue",
  template = "classic",
}: {
  cv: OptimizedCV;
  photo: string | null;
  accent?: AccentKey;
  template?: TemplateKey;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tooLong, setTooLong] = useState(false);

  const downloadDisabled = loading;

  async function handleDownload(allowOverflow = false) {
    setLoading(true);
    setErr(null);
    if (!allowOverflow) setTooLong(false);
    try {
      const res = await fetchWithAuth("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cv,
          photo,
          accentColor: ACCENT_HEX[accent],
          template,
          allowOverflow,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.tooLong) setTooLong(true);
        throw new Error(data.error ?? "Erreur lors de la génération");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CV-${cv.fullName.replace(/\s+/g, "-") || "optimise"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => handleDownload(false)}
        disabled={downloadDisabled}
        className="group inline-flex items-center gap-3 bg-accent px-5 py-3 text-sm font-medium text-paper transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{loading ? "Génération…" : "Télécharger le PDF"}</span>
        <span aria-hidden className="transition-transform group-hover:translate-y-0.5">
          ↓
        </span>
      </button>
      {err && (
        <p role="alert" className="font-mono text-[12px] uppercase tracking-[0.16em] text-danger">
          ✕ {err}
        </p>
      )}
      {tooLong && (
        <button
          type="button"
          onClick={() => handleDownload(true)}
          disabled={downloadDisabled}
          className="inline-flex items-center gap-2 border border-warm/40 bg-warm-soft px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-warm transition hover:border-warm disabled:cursor-not-allowed disabled:opacity-60"
        >
          ⚠ Télécharger quand même (PDF imparfait)
        </button>
      )}
    </div>
  );
}
