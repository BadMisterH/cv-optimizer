"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ServiceNav } from "../components/ServiceNav";
import { LivePreview } from "../components/editor/LivePreview";
import { DownloadPdfButton } from "../components/editor/DownloadPdfButton";
import {
  BLANK_DRAFT_KEY,
  createBlankCV,
  type EditorState,
} from "../lib/editorState";

// Client-only : @dnd-kit numérote ses identifiants d'accessibilité
// (aria-describedby="DndDescribedBy-N") avec un compteur global, qui diverge
// entre serveur et client et casse l'hydratation. Le rendu serveur de
// l'éditeur n'apporte rien de toute façon — il n'affiche qu'un CV vide et
// n'est utilisable qu'avec JS.
const CVEditor = dynamic(
  () => import("../components/editor/CVEditor").then((m) => m.CVEditor),
  {
    ssr: false,
    loading: () => (
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted">
        Chargement de l&apos;éditeur…
      </p>
    ),
  }
);

/**
 * Saisie manuelle d'un CV, sans IA et sans compte.
 *
 * Tout se passe côté client : l'éditeur écrit dans un état local, `LivePreview`
 * en refait le rendu à chaque frappe, et l'export passe par `/api/pdf` qui est
 * un renderer pur (ni auth ni crédit). Aucun appel au modèle, donc aucun coût
 * par CV produit ici — l'IA reste réservée à l'adaptation à une offre.
 */
export default function CreerPage() {
  // createBlankCV() renvoie un objet neuf ; on le fige pour la durée du montage
  // afin que l'effet de ré-init de CVEditor (comparaison sur fullName) ne se
  // déclenche pas à chaque rendu.
  const blankCV = useMemo(() => createBlankCV(), []);

  const [editorState, setEditorState] = useState<EditorState>(() => ({
    cv: blankCV,
    accent: "blue",
    template: "classic",
  }));

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-360 px-6 py-8 lg:py-10">
        <div className="mb-8">
          <ServiceNav />
        </div>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6">
          <div className="min-w-0">
            <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
              ● Gratuit · sans compte
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-[clamp(2rem,4vw,3.25rem)] font-light leading-none tracking-[-0.02em] text-ink">
              Écris ton CV, vois le rendu{" "}
              <span className="italic font-normal text-accent">en direct</span>.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              Clique sur n&apos;importe quel champ pour le remplir. Change de mise en
              page et de couleur quand tu veux, puis télécharge le PDF. Rien
              n&apos;est envoyé à une IA sur cette page.
            </p>
          </div>

          <DownloadPdfButton
            cv={editorState.cv}
            photo={null}
            accent={editorState.accent}
            template={editorState.template}
          />
        </header>

        {/* Split 6/6 — éditeur à gauche, aperçu live à droite (même disposition
            que le mode édition de /optimiser) */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <article>
            <div className="bg-card px-8 py-10 sm:px-10 sm:py-12 shadow-[0_1px_0_0_rgba(15,15,16,0.05),0_24px_60px_-30px_rgba(15,15,16,0.18)]">
              <CVEditor
                cv={blankCV}
                photo={null}
                onChange={setEditorState}
                draftKey={BLANK_DRAFT_KEY}
              />
            </div>
          </article>
          <aside>
            <div className="sticky top-4">
              <LivePreview
                cv={editorState.cv}
                photo={null}
                accent={editorState.accent}
                template={editorState.template}
              />
            </div>
          </aside>
        </div>

        <section className="mt-14 border-t border-rule pt-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-accent">
                ● Étape suivante
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                Ton CV est prêt ? Pour chaque offre qui t&apos;intéresse, l&apos;IA peut
                le reformuler avec les mots-clés de l&apos;annonce, sans rien inventer
                de ton parcours.
              </p>
            </div>
            <Link
              href="/optimiser"
              className="cta-primary inline-flex min-h-13 items-center gap-2 px-6 py-4 font-mono text-[12px] uppercase tracking-[0.16em]"
            >
              Adapter à une offre
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
