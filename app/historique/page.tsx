"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCVHistory, type StoredCV } from "@/app/lib/cvStore";
import { Logo } from "@/app/components/Logo";
import { ServiceNav } from "@/app/components/ServiceNav";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import type { OptimizedCV } from "@/app/types";

export default function HistoriquePage() {
  const [history, setHistory] = useState<StoredCV[]>([]);
  const [mounted, setMounted] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(readCVHistory());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-360 px-6 pt-10 pb-24">
        {/* Nav */}
        <div className="mb-12 flex items-center justify-between gap-4 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
          <Logo size="md" />
          <ServiceNav />
        </div>

        {/* Header */}
        <header className="mb-10 border-b border-rule pb-6">
          <span className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-warm">
            01
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
            Mes CVs générés
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            Les {history.length > 0 ? history.length : ""} derniers CVs optimisés sur cet appareil.
          </p>
        </header>

        {history.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-faint">
              Aucun CV généré pour l&apos;instant
            </p>
            <Link
              href="/optimiser"
              className="mt-6 inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-[13px] uppercase tracking-[0.18em] text-paper transition hover:bg-accent-hover"
            >
              Optimiser mon CV →
            </Link>
          </div>
        ) : (
          <ol className="space-y-4">
            {history.map((entry) => (
              <CVCard
                key={entry.id}
                entry={entry}
                open={openId === entry.id}
                onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
              />
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

function CVCard({
  entry,
  open,
  onToggle,
}: {
  entry: StoredCV;
  open: boolean;
  onToggle: () => void;
}) {
  const date = new Date(entry.savedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const offerSnippet = entry.offer.trim().slice(0, 80).replace(/\s+/g, " ");

  return (
    <li className="border border-rule bg-card">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-faint">
            {date}
          </p>
          <p className="mt-1 font-display text-lg font-medium tracking-tight text-ink truncate">
            {entry.cv.title || entry.cv.fullName || "CV"}
          </p>
          {offerSnippet && (
            <p className="mt-1 font-mono text-[12px] text-ink-muted truncate">
              Offre : {offerSnippet}
              {entry.offer.length > 80 ? "…" : ""}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            className={`px-4 py-2 font-mono text-[12px] uppercase tracking-[0.18em] border transition ${
              open
                ? "border-ink bg-ink text-paper"
                : "border-rule text-ink-muted hover:border-ink hover:text-ink"
            }`}
          >
            {open ? "Fermer" : "Voir"}
          </button>
          <DownloadButton cv={entry.cv} />
        </div>
      </div>

      {/* CV preview accordion */}
      {open && (
        <div className="border-t border-rule px-6 py-8">
          <CVPreview cv={entry.cv} />
        </div>
      )}
    </li>
  );
}

function DownloadButton({ cv }: { cv: OptimizedCV }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchWithAuth("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, photo: null, accentColor: "#1f4bff", template: "classic" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="group inline-flex items-center gap-2 bg-accent px-4 py-2 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "…" : "PDF ↓"}
      </button>
      {err && (
        <p className="font-mono text-[11px] text-danger">{err}</p>
      )}
    </div>
  );
}

function CVPreview({ cv }: { cv: OptimizedCV }) {
  const contactValues = [
    cv.contact.email,
    cv.contact.phone,
    cv.contact.location,
    cv.contact.linkedin,
    cv.contact.github,
    cv.contact.portfolio,
  ].filter((v) => v && v.trim().length > 0);

  return (
    <article className="space-y-6 max-w-2xl">
      <header className="border-b border-ink pb-5">
        <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-ink-muted">
          Curriculum Vitæ
        </span>
        {cv.title && (
          <h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-ink">
            {cv.title}
          </h2>
        )}
        <p className="mt-1 text-sm font-medium text-ink-soft">{cv.fullName}</p>
        {contactValues.length > 0 && (
          <p className="mt-3 font-mono text-[13px] tracking-[0.04em] text-ink-muted">
            {contactValues.join("  ·  ")}
          </p>
        )}
      </header>

      {cv.accroche && (
        <p className="text-[15px] leading-relaxed text-ink-soft italic">{cv.accroche}</p>
      )}

      {cv.sections.map((section, si) => (
        <section key={si}>
          <h3 className="mb-3 font-mono text-[12px] font-medium uppercase tracking-[0.22em] text-accent border-b border-rule pb-1">
            {String(si + 1).padStart(2, "0")} {section.title}
          </h3>
          <div className="space-y-4">
            {section.items.map((item, ii) => (
              <div key={ii}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{item.heading}</span>
                  {item.subheading && (
                    <span className="font-mono text-[12px] text-ink-muted">{item.subheading}</span>
                  )}
                </div>
                {item.company && (
                  <p className="text-[13px] text-ink-muted">{item.company}</p>
                )}
                {item.bullets.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {item.bullets.map((b, bi) => (
                      <li key={bi} className="flex gap-2 text-[14px] text-ink-soft">
                        <span aria-hidden className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag, ti) => (
                      <span
                        key={ti}
                        className="rounded-sm bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
