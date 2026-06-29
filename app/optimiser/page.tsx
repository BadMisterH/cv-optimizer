"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { AuthBanner } from "../components/AuthBanner";
import { GenerationProgress } from "../components/GenerationProgress";
import { Logo } from "../components/Logo";
import { ServiceNav } from "../components/ServiceNav";
import { ATSScore } from "../components/ATSScore";
import { CVEditor } from "../components/editor/CVEditor";
import { LivePreview } from "../components/editor/LivePreview";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { readPhoto, saveLastCV, savePhoto, canGenerateWithoutAuth, incrementGenerationCount } from "../lib/cvStore";
import { ACCENT_HEX, type AccentKey, type EditorState, type TemplateKey } from "../lib/editorState";
import type { OptimizeResponse, OptimizedCV } from "../types";

export default function Page() {
  const router = useRouter();
  const { data: session } = useSession();
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [offer, setOffer] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  // Hydration-safe : null tant que pas monté, lit localStorage en useEffect
  const [canGenerateFree, setCanGenerateFree] = useState<boolean | null>(null);
  useEffect(() => {
    setCanGenerateFree(canGenerateWithoutAuth("cv"));
  }, []);

  useEffect(() => {
    const stored = readPhoto();
    if (!stored) return;

    compressDataUrlImage(stored)
      .then((compressed) => {
        setPhoto(compressed);
        if (compressed !== stored) {
          savePhoto(compressed);
        }
      })
      .catch(() => {
        setPhoto(stored);
      });
  }, []);

  async function compressBitmap(source: HTMLImageElement | ImageBitmap): Promise<string> {
    const maxSize = 380;
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    const ratio = Math.min(maxSize / width, maxSize / height, 1);
    const targetWidth = Math.round(width * ratio);
    const targetHeight = Math.round(height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Impossible de compresser l'image");
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", 0.65);
  }

  async function compressImageFile(file: File): Promise<string> {
    const imageBitmap = await createImageBitmap(file);
    return compressBitmap(imageBitmap);
  }

  async function compressDataUrlImage(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const compressed = await compressBitmap(img);
          resolve(compressed);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Impossible de charger l'image stockée."));
      img.src = dataUrl;
    });
  }

  async function handlePhotoChange(file: File | null) {
    if (!file) {
      setPhoto(null);
      savePhoto(null);
      return;
    }

    try {
      const dataUrl = await compressImageFile(file);
      setPhoto(dataUrl);
      savePhoto(dataUrl);
    } catch (err) {
      console.error("Erreur lors de la compression de la photo :", err);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        setPhoto(dataUrl);
        savePhoto(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cvFile) return;

    // Check free tier limit (lit le state, qui a été initialisé en useEffect après mount)
    const stillFree = canGenerateFree ?? canGenerateWithoutAuth("cv");
    if (!stillFree && !session?.user) {
      router.push("/sign-in?redirect=/optimiser");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = new FormData();
      body.append("cv", cvFile);
      body.append("offer", offer);

      const res = await fetchWithAuth("/api/optimize", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        if (data.redirect) { router.push(data.redirect); return; }
        throw new Error(data.error ?? "Erreur inconnue");
      }
      setResult(data);
      // Persist for the cover letter service
      saveLastCV(data.cv, offer);
      // Increment generation counter
      incrementGenerationCount("cv");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <AuthBanner />

      {/* HERO */}
      <section className="hero-bg border-b border-rule">
        <div className="mx-auto max-w-360 px-6 pt-10 pb-16 lg:pt-14 lg:pb-24">
          <div className="mb-12 flex items-center justify-between gap-4 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
            <Logo size="md" />
            <ServiceNav />
            <div className="flex items-center gap-6">
              {!session?.user && canGenerateFree !== null && (
                <span className="hidden sm:inline text-ink-soft">
                  {canGenerateFree ? "1 gratuit restant" : "Connectez-vous pour continuer"}
                </span>
              )}
              <span className="hidden sm:inline">v.01</span>
            </div>
          </div>

          <h1 className="font-display text-[clamp(2.75rem,9vw,7.5rem)] font-light leading-[0.93] tracking-[-0.02em] text-ink">
            Adapte ton CV à{" "}
            <span className="italic font-normal text-accent">chaque</span>{" "}
            offre de poste.
          </h1>

          <div className="mt-10 grid gap-6 md:grid-cols-12">
            <p className="md:col-span-6 lg:col-span-5 text-lg leading-relaxed text-ink-soft">
              Téléverse ton CV en PDF et l&apos;offre que tu vises. Une IA
              reformule, priorise les bonnes expériences et glisse les
              mots-clés ATS sans rien inventer.
            </p>
            <ul className="md:col-span-6 lg:col-start-8 lg:col-span-5 grid grid-cols-2 gap-y-3 self-end font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
              <li className="flex items-baseline gap-2">
                <span className="text-accent">●</span> PDF in
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-warm">●</span> JSON structuré
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-success">●</span> ATS friendly
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-accent">●</span> PDF out
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-360 px-6 py-14">
          <form onSubmit={handleSubmit} className="grid gap-12 md:grid-cols-2 md:gap-x-10">
            <Field number="01" label="Ton CV (PDF)">
              <DropZone file={cvFile} onChange={setCvFile} />
            </Field>

            <Field number="02" label="L'offre d'emploi">
              <textarea
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Colle ici l'intitulé, les missions, le profil recherché…"
                rows={11}
                className="w-full resize-none border border-rule bg-card px-5 py-4 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint shadow-[0_1px_0_0_rgba(15,15,16,0.04)] outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
                required
              />
              <p className="mt-3 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                {offer.trim() ? `${offer.length} caractères` : "En attente du texte"}
              </p>
            </Field>

            <PhotoField photo={photo} onChange={handlePhotoChange} />

            <div className="md:col-span-2 flex flex-col gap-6 border-t border-rule pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                {cvFile && offer.trim()
                  ? "Prêt à optimiser →"
                  : "Complète les deux champs pour démarrer"}
              </div>
              <div className="flex items-center gap-5">
                {error && (
                  <p
                    role="alert"
                    className="font-mono text-[13px] uppercase tracking-[0.16em] text-danger"
                  >
                    ✕ {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || !cvFile || !offer.trim()}
                  className="group inline-flex items-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-ink-faint disabled:opacity-60"
                >
                  <span>{loading ? "Optimisation en cours…" : "Optimiser mon CV"}</span>
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </button>
              </div>
            </div>
          </form>

          <GenerationProgress active={loading} variant="cv" />
        </div>
      </section>

      {/* RESULT */}
      {result && <Result data={result} photo={photo} />}

      {/* FOOTER */}
      <footer className="mx-auto max-w-360 px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-[13px] uppercase tracking-[0.2em] text-ink-muted">
          <span>© {new Date().getFullYear()} · CV Optimizer</span>
        </div>
      </footer>
    </main>
  );
}

function PhotoField({
  photo,
  onChange,
}: {
  photo: string | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="md:col-span-2 flex items-center gap-5 border-t border-rule pt-6">
      <label
        htmlFor="cv-photo"
        className="group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-rule bg-card transition hover:border-ink"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-ink-muted">
            +
          </span>
        )}
      </label>
      <input
        id="cv-photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <div className="flex-1">
        <p className="font-display text-sm font-medium text-ink">
          Photo de profil <span className="text-ink-faint">(optionnelle)</span>
        </p>
        <p className="mt-0.5 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">
          {photo ? "Sauvegardée localement · sera intégrée au PDF" : "JPG/PNG · certains ATS la filtrent"}
        </p>
      </div>
      {photo && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted underline-offset-4 hover:text-danger hover:underline"
        >
          Retirer
        </button>
      )}
    </div>
  );
}

function Field({
  number,
  label,
  children,
}: {
  number: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline gap-4 border-b border-rule pb-3">
        <span className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-accent">
          {number}
        </span>
        <span className="font-display text-xl font-medium tracking-tight text-ink">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function DropZone({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === "application/pdf") onChange(dropped);
  }

  return (
    <>
      <label
        htmlFor="cv-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex h-[244px] cursor-pointer flex-col items-center justify-center border border-dashed px-6 text-center transition ${
          dragging
            ? "border-accent bg-accent-soft"
            : file
            ? "border-success bg-success-soft/40"
            : "border-rule bg-card hover:border-ink"
        }`}
      >
        {file ? (
          <>
            <span className="font-mono text-[13px] uppercase tracking-[0.22em] text-success">
              ✓ Fichier prêt
            </span>
            <span
              className="mt-3 font-display text-2xl font-medium tracking-tight text-ink"
              title={file.name}
            >
              {file.name.length > 38 ? `${file.name.slice(0, 35)}…` : file.name}
            </span>
            <span className="mt-2 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
              {(file.size / 1024).toFixed(0)} Ko · clique pour remplacer
            </span>
          </>
        ) : (
          <>
            <DocIcon className="h-9 w-9 text-ink" />
            <span className="mt-4 font-display text-xl font-medium tracking-tight text-ink">
              Dépose ton CV ici
            </span>
            <span className="mt-2 font-mono text-[13px] uppercase tracking-[0.2em] text-ink-muted">
              PDF · max 25 Mo · ou clique pour parcourir
            </span>
          </>
        )}
      </label>
      <input
        id="cv-file"
        type="file"
        accept="application/pdf"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="hidden"
        required
      />
    </>
  );
}

function DocIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      className={className}
    >
      <path d="M5 3h9l5 5v13H5z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h6" />
    </svg>
  );
}

function Result({
  data,
  photo,
}: {
  data: OptimizeResponse;
  photo: string | null;
}) {
  // L'éditeur maintient son propre state (initialisé depuis data.cv).
  // Result le mirroir pour que DownloadButton puisse PDF la version éditée.
  const [editorState, setEditorState] = useState<EditorState>({
    cv: data.cv,
    accent: "blue",
    template: "classic",
  });
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const currentCV = mode === "edit" ? editorState.cv : data.cv;

  return (
    <section className="rise border-b border-rule bg-paper-deep">
      <div className="mx-auto max-w-360 px-6 py-14">
        <header className="mb-10 flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-5">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-warm">
              03
            </span>
            <span className="font-display text-xl font-medium tracking-tight text-ink">
              Résultat
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-success">
              ✓ Optimisé
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle mode */}
            <div className="inline-flex items-center gap-1 rounded-full border border-rule bg-card p-0.5">
              <button
                type="button"
                onClick={() => setMode("preview")}
                aria-pressed={mode === "preview"}
                className={`px-3 py-1 font-mono text-[12px] uppercase tracking-[0.18em] transition ${
                  mode === "preview"
                    ? "bg-ink text-paper rounded-full"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                Aperçu
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                aria-pressed={mode === "edit"}
                className={`px-3 py-1 font-mono text-[12px] uppercase tracking-[0.18em] transition ${
                  mode === "edit"
                    ? "bg-ink text-paper rounded-full"
                    : "bg-accent-soft text-accent rounded-full font-semibold hover:bg-accent hover:text-paper"
                }`}
              >
                ✎ Éditer
              </button>
            </div>
            <DownloadButton
              cv={currentCV}
              photo={photo}
              accent={editorState.accent}
              template={editorState.template}
            />
          </div>
        </header>

        {/* Score ATS — visible dans les 2 modes (preview + édition) */}
        {data.atsScore && (
          <div className="mb-10">
            <ATSScore score={data.atsScore} />
          </div>
        )}

        {mode === "edit" ? (
          /* Mode édition : split 6/6 — éditeur à gauche, preview live à droite */
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <article>
              <div className="bg-card px-8 py-10 sm:px-10 sm:py-12 shadow-[0_1px_0_0_rgba(15,15,16,0.05),0_24px_60px_-30px_rgba(15,15,16,0.18)]">
                <CVEditor cv={data.cv} photo={photo} onChange={setEditorState} />
              </div>
            </article>
            <aside>
              <div className="sticky top-4">
                <LivePreview
                  cv={editorState.cv}
                  photo={photo}
                  accent={editorState.accent}
                  template={editorState.template}
                />
              </div>
            </aside>
          </div>
        ) : (
          /* Mode aperçu : layout 8/4 avec liste des modifications */
          <div className="grid gap-10 lg:grid-cols-12">
            <article className="lg:col-span-8">
              <div className="bg-card px-8 py-10 sm:px-12 sm:py-14 shadow-[0_1px_0_0_rgba(15,15,16,0.05),0_24px_60px_-30px_rgba(15,15,16,0.18)]">
                <CVPreview cv={editorState.cv} photo={photo} />
              </div>
            </article>
            <aside className="lg:col-span-4">
              <div className="border-l-2 border-warm pl-6">
                <h3 className="font-mono text-[13px] uppercase tracking-[0.22em] text-warm">
                  Modifications · {data.modifications.length}
                </h3>
                <p className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
                  Ce que l&apos;IA a changé
                </p>
                <ol className="mt-6 space-y-5">
                  {data.modifications.map((m, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warm-soft font-mono text-[12px] font-medium tracking-[0.04em] text-warm">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-[15px] leading-relaxed text-ink-soft">
                        {m}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function DownloadButton({
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

  const downloadDisabled = loading;

  async function handleDownload() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchWithAuth("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, photo, accentColor: ACCENT_HEX[accent], template }),
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
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDownload}
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
    </div>
  );
}

function CVPreview({
  cv,
  photo,
}: {
  cv: OptimizedCV;
  photo: string | null;
}) {
  const contactValues = [
    cv.contact.email,
    cv.contact.phone,
    cv.contact.location,
    cv.contact.linkedin,
    cv.contact.github,
    cv.contact.portfolio,
  ].filter((v) => v && v.trim().length > 0);

  return (
    <article className="space-y-7">
      <header className="flex items-start gap-5 border-b border-ink pb-5">
        <div className="flex-1 min-w-0">
          <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-ink-muted">
            Curriculum Vitæ
          </span>
          {cv.title && (
            <h3 className="mt-2 font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink">
              {cv.title}
            </h3>
          )}
          <p className="mt-2 text-sm font-medium text-ink-soft">{cv.fullName}</p>
          {contactValues.length > 0 && (
            <p className="mt-4 font-mono text-[13px] tracking-[0.04em] text-ink-muted">
              {contactValues.join("  ·  ")}
            </p>
          )}
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="h-24 w-20 shrink-0 rounded-sm object-cover"
          />
        )}
      </header>

      {cv.accroche && (
        <div>
          <div className="mb-3 flex items-baseline gap-3 border-b border-rule pb-1">
            <span className="font-mono text-[12px] font-medium uppercase tracking-[0.22em] text-accent">
              00
            </span>
            <h4 className="font-display text-sm font-medium uppercase tracking-[0.16em] text-ink">
              À propos
            </h4>
          </div>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            {cv.accroche}
          </p>
        </div>
      )}

      {cv.sections.map((section, sIdx) => (
        <div key={sIdx}>
          <div className="mb-3 flex items-baseline gap-3 border-b border-rule pb-1">
            <span className="font-mono text-[12px] font-medium uppercase tracking-[0.22em] text-accent">
              {String(sIdx + 1).padStart(2, "0")}
            </span>
            <h4 className="font-display text-sm font-medium uppercase tracking-[0.16em] text-ink">
              {section.title}
            </h4>
          </div>
          <div className="space-y-4">
            {section.items.map((item, iIdx) => (
              <div key={iIdx}>
                {item.heading && (
                  <p className="text-[15px] font-medium text-ink">
                    {item.heading}
                    {item.company && (
                      <>
                        <span className="text-ink-muted mx-1">·</span>
                        <span className="text-accent font-semibold">{item.company}</span>
                      </>
                    )}
                  </p>
                )}
                {item.subheading && (
                  <p className="mt-0.5 font-mono text-[13px] tracking-[0.04em] text-ink-muted">
                    {item.subheading}
                  </p>
                )}
                {item.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {item.bullets.map((b, bIdx) => (
                      <li
                        key={bIdx}
                        className="flex gap-3 text-[14px] leading-relaxed text-ink-soft"
                      >
                        <span aria-hidden className="mt-2 inline-block h-px w-3 shrink-0 bg-ink" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((t, tIdx) => (
                      <span
                        key={tIdx}
                        className="rounded-sm border border-accent/15 bg-accent-soft px-2 py-0.5 font-mono text-[13px] tracking-[0.02em] text-accent-hover"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </article>
  );
}
