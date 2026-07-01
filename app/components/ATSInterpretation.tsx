import type { ATSInterpretation as ATSInterpretationType } from "@/app/types";

type Props = {
  interpretation: ATSInterpretationType;
};

export function ATSInterpretation({ interpretation }: Props) {
  const risks = interpretation.parsingRisks.filter(Boolean);

  return (
    <section
      className="border border-rule bg-card p-6 shadow-[0_1px_0_0_rgba(15,15,16,0.04)] sm:p-8"
      aria-label="Interprétation ATS estimée"
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 lg:col-span-4">
          <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-accent">
            ● Interprétation ATS estimée
          </p>
          <h3 className="mt-3 font-display text-3xl font-medium tracking-tight text-ink">
            Ce qu&apos;un ATS devrait comprendre.
          </h3>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
            Ce n&apos;est pas un scan réel du PDF final. C&apos;est une estimation
            basée sur le CV optimisé, l&apos;offre et les éléments détectables.
          </p>
        </div>

        <div className="grid min-w-0 gap-px overflow-hidden border border-rule bg-rule lg:col-span-8 md:grid-cols-2">
          <InterpretationBlock title="Identité détectable">
            <div className="space-y-3">
              <KeyValue label="Nom" value={interpretation.identity.fullName || "Non détecté"} />
              <KeyValue label="Titre" value={interpretation.identity.title || "Non détecté"} />
              <div className="flex flex-wrap gap-2 pt-1">
                <BooleanChip ok={interpretation.identity.emailFound} label="Email" />
                <BooleanChip ok={interpretation.identity.phoneFound} label="Téléphone" />
              </div>
            </div>
          </InterpretationBlock>

          <InterpretationBlock title="Sections reconnues">
            <ChipList items={interpretation.detectedSections} tone="accent" empty="Aucune section fiable." />
          </InterpretationBlock>

          <InterpretationBlock title="Compétences reconnues">
            <ChipList items={interpretation.detectedSkills} tone="success" empty="Aucune compétence détectée." />
          </InterpretationBlock>

          <InterpretationBlock title="Mots-clés de l'offre retrouvés">
            <ChipList items={interpretation.matchedKeywords} tone="success" empty="Aucun mot-clé fort retrouvé." />
          </InterpretationBlock>

          <InterpretationBlock title="Mots-clés à renforcer">
            <ChipList items={interpretation.missingKeywords} tone="warm" empty="Aucun manque majeur détecté." />
          </InterpretationBlock>

          <InterpretationBlock title="Risques de lecture">
            {risks.length > 0 ? (
              <ul className="space-y-2">
                {risks.map((risk, idx) => (
                  <li key={idx} className="flex gap-3 text-[13px] leading-relaxed text-ink-soft">
                    <span aria-hidden className="mt-2 inline-block h-px w-3 shrink-0 bg-warm" />
                    <span className="min-w-0 break-words">{risk}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Aucun risque majeur détecté dans la version optimisée.
              </p>
            )}
          </InterpretationBlock>
        </div>
      </div>

      <div className="mt-6 border-l-2 border-accent bg-accent-soft/50 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
          Synthèse
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {interpretation.summary}
        </p>
      </div>
    </section>
  );
}

function InterpretationBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 bg-card p-5">
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1 break-words text-[14px] font-medium text-ink">
        {value}
      </p>
    </div>
  );
}

function BooleanChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${
        ok
          ? "border-success/25 bg-success-soft text-success"
          : "border-warm/25 bg-warm-soft text-warm"
      }`}
    >
      <span aria-hidden>{ok ? "●" : "○"}</span>
      {label}
    </span>
  );
}

function ChipList({
  items,
  tone,
  empty,
}: {
  items: string[];
  tone: "accent" | "success" | "warm";
  empty: string;
}) {
  const visible = items.filter(Boolean);
  if (visible.length === 0) {
    return <p className="text-[13px] leading-relaxed text-ink-soft">{empty}</p>;
  }

  const toneClass = {
    accent: "border-accent/20 bg-accent-soft text-accent",
    success: "border-success/25 bg-success-soft text-success",
    warm: "border-warm/25 bg-warm-soft text-warm",
  }[tone];

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {visible.map((item, idx) => (
        <span
          key={`${item}-${idx}`}
          className={`max-w-full break-words border px-2 py-1 font-mono text-[11px] tracking-[0.02em] ${toneClass}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
