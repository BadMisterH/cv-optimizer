"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { AuthBanner } from "../components/AuthBanner";
import { GenerationProgress } from "../components/GenerationProgress";
import { Logo } from "../components/Logo";
import { ServiceNav } from "../components/ServiceNav";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { readLastCV } from "../lib/cvStore";
import type { CoverLetter, LetterResponse, OptimizedCV } from "../types";

type Source = "upload" | "stored";

export default function LetterPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [source, setSource] = useState<Source>("upload");
  const [storedCv, setStoredCv] = useState<{
    cv: OptimizedCV;
    offer: string;
    savedAt: string;
  } | null>(null);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [prevLetterFile, setPrevLetterFile] = useState<File | null>(null);
  const [offer, setOffer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LetterResponse | null>(null);

  useEffect(() => {
    const stored = readLastCV();
    if (stored) {
      setStoredCv(stored);
      setSource("stored");
      if (stored.offer) setOffer(stored.offer);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!session?.user) {
      router.push("/sign-up?redirect=/lettre");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let res: Response;
      if (prevLetterFile) {
        // Toujours FormData quand une ancienne lettre est fournie
        const body = new FormData();
        if (source === "stored" && storedCv) {
          body.append("cvJson", JSON.stringify(storedCv.cv));
        } else {
          if (!cvFile) {
            setError("Téléverse d'abord ton CV (PDF).");
            setLoading(false);
            return;
          }
          body.append("cv", cvFile);
        }
        body.append("offer", offer);
        body.append("prevLetter", prevLetterFile);
        res = await fetchWithAuth("/api/cover-letter", { method: "POST", body });
      } else if (source === "stored" && storedCv) {
        res = await fetchWithAuth("/api/cover-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cv: storedCv.cv, offer }),
        });
      } else {
        if (!cvFile) {
          setError("Téléverse d'abord ton CV (PDF).");
          setLoading(false);
          return;
        }
        const body = new FormData();
        body.append("cv", cvFile);
        body.append("offer", offer);
        res = await fetchWithAuth("/api/cover-letter", { method: "POST", body });
      }
      const data = await res.json();
      if (!res.ok) {
        if (data.redirect) { router.push(data.redirect); return; }
        throw new Error(data.error ?? "Erreur inconnue");
      }
      setResult(data);
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
              <span className="hidden sm:inline">v.01</span>
            </div>
          </div>

          <h1 className="font-display text-[clamp(2.75rem,9vw,7.5rem)] font-light leading-[0.93] tracking-[-0.02em] text-ink">
            Une lettre <span className="italic font-normal text-warm">alignée</span>{" "}
            sur ton CV, en 30 secondes.
          </h1>

          <div className="mt-10 grid gap-6 md:grid-cols-12">
            <p className="md:col-span-6 lg:col-span-5 text-lg leading-relaxed text-ink-soft">
              Claude rédige une lettre personnalisée à partir de ton CV et de
              l&apos;offre. Mêmes expériences citées, même ton, mots-clés
              alignés. Pas de générique.
            </p>
            <ul className="md:col-span-6 lg:col-start-8 lg:col-span-5 grid grid-cols-2 gap-y-3 self-end font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
              <li className="flex items-baseline gap-2">
                <span className="text-warm">●</span> CV in
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-warm">●</span> Offre in
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-warm">●</span> Lettre A4
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-warm">●</span> PDF out
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-360 px-6 py-14">
          <form onSubmit={handleSubmit} className="grid gap-12 md:grid-cols-2 md:gap-x-10">
            <div>
              <div className="mb-4 flex items-baseline gap-4 border-b border-rule pb-3">
                <span className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-warm">
                  01
                </span>
                <span className="font-display text-xl font-medium tracking-tight text-ink">
                  Source du CV
                </span>
              </div>

              {storedCv ? (
                <div className="mb-4 flex flex-col gap-2">
                  <SourceOption
                    selected={source === "stored"}
                    onClick={() => setSource("stored")}
                    label="Utiliser mon CV optimisé"
                    sub={`Sauvegardé ${formatTimeAgo(storedCv.savedAt)} · ${
                      storedCv.cv.fullName
                    }`}
                    badge="Aligné"
                  />
                  <SourceOption
                    selected={source === "upload"}
                    onClick={() => setSource("upload")}
                    label="Téléverser un autre PDF"
                    sub="Si tu veux partir d'un CV différent"
                  />
                </div>
              ) : null}

              {/* Upload ancienne lettre — optionnel, toujours visible */}
              <div className="mt-6">
                <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
                  Ancienne lettre{" "}
                  <span className="text-ink-faint">(optionnel)</span>
                </p>
                {prevLetterFile ? (
                  <div className="flex items-center justify-between border border-success bg-success-soft/40 px-4 py-3">
                    <div>
                      <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-success">
                        ✓ Style calibré
                      </span>
                      <p className="mt-0.5 font-mono text-[12px] text-ink-muted truncate max-w-[200px]">
                        {prevLetterFile.name.length > 32
                          ? `${prevLetterFile.name.slice(0, 29)}…`
                          : prevLetterFile.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrevLetterFile(null)}
                      className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faint hover:text-danger transition"
                      aria-label="Retirer l'ancienne lettre"
                    >
                      ✕ Retirer
                    </button>
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor="prev-letter-file"
                      className="flex h-16 cursor-pointer items-center justify-center border border-dashed border-rule bg-card px-4 text-center transition hover:border-ink"
                    >
                      <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
                        + Dépose ta précédente lettre (PDF)
                      </span>
                    </label>
                    <input
                      id="prev-letter-file"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPrevLetterFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </>
                )}
                <p className="mt-1.5 font-mono text-[11px] text-ink-faint">
                  Claude s&apos;en sert uniquement pour imiter ton style d&apos;écriture.
                </p>
              </div>

              {source === "upload" && (
                <>
                  <label
                    htmlFor="letter-cv-file"
                    className={`flex h-45 cursor-pointer flex-col items-center justify-center border border-dashed px-6 text-center transition ${
                      cvFile
                        ? "border-success bg-success-soft/40"
                        : "border-rule bg-card hover:border-ink"
                    }`}
                  >
                    {cvFile ? (
                      <>
                        <span className="font-mono text-[13px] uppercase tracking-[0.22em] text-success">
                          ✓ Fichier prêt
                        </span>
                        <span className="mt-3 font-display text-xl font-medium tracking-tight text-ink">
                          {cvFile.name.length > 38
                            ? `${cvFile.name.slice(0, 35)}…`
                            : cvFile.name}
                        </span>
                        <span className="mt-2 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                          {(cvFile.size / 1024).toFixed(0)} Ko · clique pour changer
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-display text-xl font-medium tracking-tight text-ink">
                          Dépose ton CV ici
                        </span>
                        <span className="mt-2 font-mono text-[13px] uppercase tracking-[0.2em] text-ink-muted">
                          PDF · max 25 Mo
                        </span>
                      </>
                    )}
                  </label>
                  <input
                    id="letter-cv-file"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </>
              )}
            </div>

            <div>
              <div className="mb-4 flex items-baseline gap-4 border-b border-rule pb-3">
                <span className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-warm">
                  02
                </span>
                <span className="font-display text-xl font-medium tracking-tight text-ink">
                  L&apos;offre d&apos;emploi
                </span>
              </div>
              <textarea
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Colle ici l'intitulé du poste, l'entreprise, les missions, le profil recherché…"
                rows={11}
                className="w-full resize-none border border-rule bg-card px-5 py-4 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint shadow-[0_1px_0_0_rgba(15,15,16,0.04)] outline-none transition focus:border-warm focus:shadow-[0_0_0_4px_var(--color-warm-soft)]"
                required
              />
              <p className="mt-3 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
                {offer.trim() ? `${offer.length} caractères` : "En attente du texte"}
              </p>
            </div>

            <div className="md:col-span-2 flex flex-col gap-6 border-t border-rule pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                {(source === "stored" || cvFile) && offer.trim()
                  ? "Prêt à rédiger →"
                  : "Renseigne CV + offre"}
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
                  disabled={
                    loading ||
                    !offer.trim() ||
                    (source === "upload" && !cvFile) ||
                    (source === "stored" && !storedCv)
                  }
                  className="group inline-flex items-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-warm disabled:cursor-not-allowed disabled:bg-ink-faint disabled:opacity-60"
                >
                  <span>{loading ? "Rédaction en cours…" : "Générer la lettre"}</span>
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </div>
            </div>
          </form>

          <GenerationProgress active={loading} variant="letter" />
        </div>
      </section>

      {result && (
        <LetterResult
          data={result}
          onLetterChange={(letter) =>
            setResult((prev) => (prev ? { ...prev, letter } : prev))
          }
        />
      )}

      <footer className="mx-auto max-w-360 px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-[13px] uppercase tracking-[0.2em] text-ink-muted">
          <span>© {new Date().getFullYear()} · CV Optimizer</span>
        </div>
      </footer>
    </main>
  );
}

function SourceOption({
  selected,
  onClick,
  label,
  sub,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-4 border px-5 py-4 text-left transition ${
        selected
          ? "border-warm bg-warm-soft/40"
          : "border-rule bg-card hover:border-ink"
      }`}
    >
      <span
        className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full border-2 ${
          selected ? "border-warm bg-warm" : "border-ink-faint"
        }`}
      />
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-base font-medium text-ink">
            {label}
          </span>
          {badge && (
            <span className="rounded-full bg-success-soft px-2 py-0.5 font-mono text-[12px] uppercase tracking-[0.16em] text-success">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block font-mono text-[13px] uppercase tracking-[0.14em] text-ink-muted">
          {sub}
        </span>
      </span>
    </button>
  );
}

function LetterResult({
  data,
  onLetterChange,
}: {
  data: LetterResponse;
  onLetterChange: (letter: CoverLetter) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [original] = useState<CoverLetter>(() => data.letter);
  const isEdited = JSON.stringify(data.letter) !== JSON.stringify(original);

  function handleReset() {
    onLetterChange(original);
  }

  return (
    <section className="rise border-b border-rule bg-paper-deep">
      <div className="mx-auto max-w-360 px-6 py-14">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-warm">
              03
            </span>
            <span className="font-display text-xl font-medium tracking-tight text-ink">
              Lettre rédigée
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-success">
              ✓ Personnalisée
            </span>
            {isEdited && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-soft px-2.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-warm">
                ✎ Modifiée
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {editing && isEdited && (
              <button
                type="button"
                onClick={handleReset}
                className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                title="Annuler tes modifications et revenir à la version IA"
              >
                ↺ Réinitialiser
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 font-mono text-xs uppercase tracking-[0.18em] transition ${
                editing
                  ? "border-ink bg-ink text-paper hover:bg-ink/90"
                  : "border-rule bg-card text-ink hover:border-ink"
              }`}
            >
              {editing ? "Terminer l'édition" : "✎ Modifier"}
            </button>
            <DownloadLetterButton letter={data.letter} />
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-12">
          <article className="lg:col-span-8">
            <div className="bg-card px-8 py-10 sm:px-12 sm:py-14 shadow-[0_1px_0_0_rgba(15,15,16,0.05),0_24px_60px_-30px_rgba(15,15,16,0.18)]">
              {editing ? (
                <LetterEditor letter={data.letter} onChange={onLetterChange} />
              ) : (
                <LetterPreview letter={data.letter} />
              )}
            </div>
          </article>

          <aside className="lg:col-span-4">
            <div className="border-l-2 border-warm pl-6">
              <h3 className="font-mono text-[13px] uppercase tracking-[0.22em] text-warm">
                Choix éditoriaux · {data.notes.length}
              </h3>
              <p className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
                Comment Claude a aligné la lettre
              </p>
              <ol className="mt-6 space-y-5">
                {data.notes.map((n, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warm-soft font-mono text-[12px] font-medium tracking-[0.04em] text-warm">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[15px] leading-relaxed text-ink-soft">
                      {n}
                    </span>
                  </li>
                ))}
              </ol>
              {editing && (
                <p className="mt-8 rounded-sm bg-paper-deep p-4 font-mono text-[13px] leading-relaxed text-ink-muted">
                  💡 Astuce : modifie librement les paragraphes, l&apos;objet,
                  la formule de politesse… Le PDF généré reprendra ta version
                  finale.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function LetterEditor({
  letter,
  onChange,
}: {
  letter: CoverLetter;
  onChange: (letter: CoverLetter) => void;
}) {
  function update<K extends keyof CoverLetter>(key: K, value: CoverLetter[K]) {
    onChange({ ...letter, [key]: value });
  }
  function updateRecipient<K extends keyof CoverLetter["recipient"]>(
    key: K,
    value: CoverLetter["recipient"][K]
  ) {
    onChange({ ...letter, recipient: { ...letter.recipient, [key]: value } });
  }
  function updateParagraph(idx: number, value: string) {
    const next = [...letter.paragraphs];
    next[idx] = value;
    update("paragraphs", next);
  }
  function addParagraph() {
    update("paragraphs", [...letter.paragraphs, ""]);
  }
  function removeParagraph(idx: number) {
    update(
      "paragraphs",
      letter.paragraphs.filter((_, i) => i !== idx)
    );
  }

  const totalWords = letter.paragraphs
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <div className="space-y-8">
      <FieldGroup label="Destinataire">
        <div className="grid gap-3 sm:grid-cols-2">
          <EditInput
            label="Entreprise"
            value={letter.recipient.company}
            onChange={(v) => updateRecipient("company", v)}
            placeholder="Acme Inc."
          />
          <EditInput
            label="Poste"
            value={letter.recipient.role}
            onChange={(v) => updateRecipient("role", v)}
            placeholder="Développeur Full-Stack"
          />
          <EditInput
            label="Service / département"
            value={letter.recipient.department}
            onChange={(v) => updateRecipient("department", v)}
            placeholder="Pôle Tech"
          />
          <EditInput
            label="Adresse"
            value={letter.recipient.address}
            onChange={(v) => updateRecipient("address", v)}
            placeholder="Paris"
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Lieu et date">
        <div className="grid gap-3 sm:grid-cols-2">
          <EditInput
            label="Ville d'envoi"
            value={letter.city}
            onChange={(v) => update("city", v)}
            placeholder="Paris"
          />
          <EditInput
            label="Date"
            value={letter.date}
            onChange={(v) => update("date", v)}
            placeholder="9 mai 2026"
          />
        </div>
      </FieldGroup>

      <FieldGroup label="En-tête de lettre">
        <EditInput
          label="Objet"
          value={letter.subject}
          onChange={(v) => update("subject", v)}
          placeholder="Candidature au poste de…"
        />
        <EditInput
          label="Formule d'ouverture"
          value={letter.salutation}
          onChange={(v) => update("salutation", v)}
          placeholder="Madame, Monsieur,"
        />
      </FieldGroup>

      <FieldGroup
        label={`Corps (${letter.paragraphs.length} paragraphe${
          letter.paragraphs.length > 1 ? "s" : ""
        } · ${totalWords} mots)`}
      >
        <div className="space-y-4">
          {letter.paragraphs.map((p, i) => (
            <div key={i} className="relative">
              <div className="mb-1.5 flex items-baseline justify-between font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
                <span>Paragraphe {String(i + 1).padStart(2, "0")}</span>
                {letter.paragraphs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeParagraph(i)}
                    className="text-ink-faint hover:text-danger"
                  >
                    Supprimer
                  </button>
                )}
              </div>
              <AutoTextarea
                value={p}
                onChange={(v) => updateParagraph(i, v)}
                placeholder="Tape ton paragraphe…"
              />
            </div>
          ))}
          {letter.paragraphs.length < 5 && (
            <button
              type="button"
              onClick={addParagraph}
              className="font-mono text-[13px] uppercase tracking-[0.18em] text-warm underline-offset-4 hover:underline"
            >
              + Ajouter un paragraphe
            </button>
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Pied de lettre">
        <AutoTextarea
          label="Formule de politesse"
          value={letter.closing}
          onChange={(v) => update("closing", v)}
          placeholder="Je vous prie d'agréer…"
        />
        <EditInput
          label="Signature"
          value={letter.signature}
          onChange={(v) => update("signature", v)}
          placeholder="Prénom Nom"
        />
      </FieldGroup>
    </div>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 border-b border-rule pb-2 font-mono text-[13px] uppercase tracking-[0.2em] text-warm">
        {label}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EditInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
          {label}
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-rule bg-card px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint outline-none transition focus:border-warm focus:shadow-[0_0_0_3px_var(--color-warm-soft)]"
      />
    </label>
  );
}

function AutoTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
          {label}
        </span>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={Math.max(3, Math.min(10, Math.ceil((value.length || 1) / 80) + 1))}
        className="w-full resize-y border border-rule bg-card px-3 py-2 text-[14px] leading-relaxed text-ink placeholder:text-ink-faint outline-none transition focus:border-warm focus:shadow-[0_0_0_3px_var(--color-warm-soft)]"
      />
    </label>
  );
}

function DownloadLetterButton({ letter }: { letter: CoverLetter }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const downloadDisabled = loading;

  async function handleDownload() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchWithAuth("/api/letter-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de la génération");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lettre-${letter.fullName.replace(/\s+/g, "-") || "motivation"}.pdf`;
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
        className="group inline-flex items-center gap-3 bg-warm px-5 py-3 text-sm font-medium text-paper transition hover:bg-warm/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{loading ? "Génération…" : "Télécharger le PDF"}</span>
        <span aria-hidden className="transition-transform group-hover:translate-y-0.5">
          ↓
        </span>
      </button>
      {err && (
        <p
          role="alert"
          className="font-mono text-[12px] uppercase tracking-[0.16em] text-danger"
        >
          ✕ {err}
        </p>
      )}
    </div>
  );
}

function LetterPreview({ letter }: { letter: CoverLetter }) {
  const dateLine = [letter.city, letter.date].filter((v) => v?.trim()).join(", le ");

  return (
    <article className="space-y-6 text-ink">
      <header className="border-b-2 border-warm pb-4">
        <h3 className="font-display text-3xl font-bold tracking-tight">
          {letter.fullName}
        </h3>
        {(letter.recipient.role || letter.recipient.company) && (
          <p className="mt-1 text-sm text-ink-soft">
            Candidature
            {letter.recipient.role ? `, ${letter.recipient.role}` : ""}
            {letter.recipient.company ? ` · ${letter.recipient.company}` : ""}
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-6 text-sm leading-relaxed text-ink-soft">
        <div>
          <p className="font-semibold text-ink">{letter.fullName}</p>
          {letter.contact.location && <p>{letter.contact.location}</p>}
          {letter.contact.phone && <p>{letter.contact.phone}</p>}
          {letter.contact.email && (
            <p className="text-accent">{letter.contact.email}</p>
          )}
        </div>
        <div className="text-right">
          {letter.recipient.company && (
            <p className="font-semibold text-ink">{letter.recipient.company}</p>
          )}
          {letter.recipient.department && <p>{letter.recipient.department}</p>}
          {letter.recipient.address && <p>{letter.recipient.address}</p>}
        </div>
      </div>

      {dateLine && (
        <p className="text-right text-sm text-ink-soft">{dateLine}</p>
      )}

      {letter.subject && (
        <p className="text-[15px]">
          <span className="font-bold">Objet :</span> {letter.subject}
        </p>
      )}

      <p className="text-[15px]">{letter.salutation}</p>

      <div className="space-y-4 text-[15px] leading-relaxed text-justify">
        {letter.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {letter.closing && (
        <p className="text-[15px] leading-relaxed text-justify">{letter.closing}</p>
      )}

      <p className="pt-4 text-right text-[15px] font-semibold">
        {letter.signature}
      </p>
    </article>
  );
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `il y a ${diffD} j`;
}
