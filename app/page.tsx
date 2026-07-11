"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
import {
  getPackBonusCredits,
  getPackTotalCredits,
  isLaunchOfferActive,
  LAUNCH_OFFER,
  PACKS,
  type PackKey,
} from "@/lib/stripe-packs";
import { Logo } from "./components/Logo";
import { UserMenu } from "./components/UserMenu";
import { StructuredData } from "./components/StructuredData";

const FAQ_ITEMS = [
  {
    q: "En quoi CV Optimizer est différent d'un simple ChatGPT ?",
    a: "CV Optimizer est pensé pour une candidature précise : ton CV, une offre, puis une version ciblée qui reprend le vocabulaire utile sans sortir de ton parcours. Tu n'as pas à écrire le prompt, trier les réponses ou remettre la mise en page en PDF.",
  },
  {
    q: "Est-ce que l'IA peut inventer des expériences ?",
    a: "Non. CV Optimizer reformule, priorise et clarifie ce qui existe déjà dans ton CV. Il ne crée pas de poste, de diplôme, de compétence ou de résultat que tu n'as jamais eu.",
  },
  {
    q: "Est-ce que mes données restent confidentielles ?",
    a: "Oui. Ton CV n'est pas vendu, n'est pas utilisé pour entraîner un modèle et le contenu du CV n'est pas conservé après génération. Seuls les éléments nécessaires au compte et aux crédits sont stockés.",
  },
  {
    q: "Combien de temps prend une génération ?",
    a: "Environ 30 secondes pour obtenir une version optimisée en PDF. L'objectif est de t'aider à adapter vite ton CV à une offre précise, sans passer ta soirée à tout réécrire.",
  },
  {
    q: "Quels formats de CV sont acceptés ?",
    a: "PDF uniquement, jusqu'à 25 Mo. Les CV générés depuis Word, Canva, Notion ou LinkedIn fonctionnent tous tant qu'ils sont exportés en PDF.",
  },
  {
    q: "Pour qui CV Optimizer est-il pensé ?",
    a: "Pour les candidats qui postulent à des offres concrètes : stage, alternance, premier CDI, reconversion ou recherche active. Le point commun : ton CV doit parler le langage de l'annonce.",
  },
  {
    q: "Le PDF est-il vraiment compatible ATS ?",
    a: "Oui. Le PDF généré garde un texte sélectionnable, une structure lisible et des mots-clés issus de l'offre quand ton expérience les justifie.",
  },
  {
    q: "Combien coûte CV Optimizer après l'essai offert ?",
    a: "Les packs commencent à 4,99 €. Il n'y a aucun abonnement : un crédit sert à générer un CV optimisé ou une lettre de motivation.",
  },
  {
    q: "Est-ce que les crédits expirent ?",
    a: "Non. Les crédits achetés n'expirent pas. Tu peux les utiliser au rythme de tes candidatures.",
  },
] as const;

const NAV_LINKS = [
  { href: "#comment", label: "Étapes" },
  { href: "#exemple", label: "Exemple" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#confidentialite", label: "Données" },
  { href: "#faq", label: "FAQ" },
] as const;

const PACK_POSITIONING: Record<PackKey, string> = {
  starter: "Pour quelques candidatures ciblées",
  pro: "Pour une recherche active",
  premium: "Pour candidater sur la durée",
};

function formatUnitPrice(amountCents: number, credits: number) {
  return `${(amountCents / 100 / credits).toFixed(2).replace(".", ",")} €`;
}

type HeaderUser = {
  name?: string;
  email?: string;
  credits?: number;
} | null;

function CreditChip({ user }: { user: HeaderUser }) {
  if (!user) return null;
  const isAdmin = isAdminEmail(user.email);
  const credits = user.credits ?? 0;
  const isEmpty = !isAdmin && credits <= 0;

  return (
    <Link
      href={isEmpty ? "/buy-credits" : "/account"}
      className="group inline-flex items-center gap-2 border border-rule px-3 py-2 font-mono text-[12px] uppercase tracking-[0.18em] transition hover:border-ink"
      aria-label={isAdmin ? "Compte admin" : `${credits} crédit${credits > 1 ? "s" : ""} restant${credits > 1 ? "s" : ""}`}
    >
      <span
        className={
          isEmpty
            ? "text-danger"
            : isAdmin
              ? "text-accent"
              : "text-success"
        }
        aria-hidden
      >
        ●
      </span>
      {isAdmin ? (
        <span className="text-accent">∞ admin</span>
      ) : (
        <span className={isEmpty ? "text-danger" : "text-ink"}>
          {credits} crédit{credits > 1 ? "s" : ""}
        </span>
      )}
    </Link>
  );
}

function LandingHeader({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const isLogged = !!user;
  const isAdmin = isAdminEmail(user?.email);
  const credits = user?.credits ?? 0;
  const isEmpty = isLogged && !isAdmin && credits <= 0;
  const actionHref = isEmpty ? "/buy-credits" : "/optimiser";
  const actionLabel = isEmpty ? "Recharger" : isLogged ? "Optimiser" : "Essayer gratuitement";

  return (
    <header className="sticky top-0 z-40 overflow-x-clip border-b border-rule bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex max-w-360 items-center justify-between gap-4 px-6 py-3.5">
        <Logo size="sm" />

        <nav
          aria-label="Sections"
          className="hidden min-w-0 items-center gap-6 font-mono text-[13px] uppercase tracking-[0.2em] text-ink-muted xl:flex"
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative py-1 transition hover:text-ink after:absolute after:left-0 after:bottom-0 after:h-px after:w-0 after:bg-ink after:transition-all hover:after:w-full"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden min-w-0 items-center gap-2 xl:flex">
          {isLogged ? (
            <>
              <CreditChip user={user} />
              <UserMenu />
            </>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center px-3 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted transition hover:text-ink"
            >
              Se connecter
            </Link>
          )}
          <Link
            href={actionHref}
            className="cta-primary group inline-flex h-10 items-center gap-2 px-5 font-mono text-[13px] uppercase tracking-[0.18em]"
          >
            {actionLabel}
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          className="relative inline-flex h-10 w-10 items-center justify-center border border-rule transition hover:border-ink xl:hidden"
        >
          <span aria-hidden className="relative block h-3 w-4">
            <span
              className={`absolute left-0 top-0 h-px w-full bg-ink transition ${
                open ? "translate-y-[5px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 h-px w-full bg-ink transition ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute left-0 bottom-0 h-px w-full bg-ink transition ${
                open ? "-translate-y-[6px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t border-rule bg-paper xl:hidden">
          <div className="mx-auto max-w-360 px-6 py-6">
            {isLogged && (
              <div className="mb-5 flex items-baseline justify-between gap-3 border border-rule bg-paper-deep px-4 py-3">
                <span className="flex items-baseline gap-2 font-mono text-[13px] uppercase tracking-[0.22em]">
                  <span
                    className={
                      isEmpty
                        ? "text-danger"
                        : isAdmin
                          ? "text-accent"
                          : "text-success"
                    }
                    aria-hidden
                  >
                    ●
                  </span>
                  <span className="text-ink-muted">{user?.name ?? user?.email ?? "Connecté"}</span>
                  <span className="text-ink-faint">·</span>
                  {isAdmin ? (
                    <span className="text-accent">∞ admin</span>
                  ) : (
                    <span className={isEmpty ? "text-danger" : "text-ink"}>
                      {credits} crédit{credits > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                {!isAdmin && (
                  <Link
                    href={isEmpty ? "/buy-credits" : "/account"}
                    onClick={() => setOpen(false)}
                    className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink"
                  >
                    {isEmpty ? "Recharger →" : "Gérer →"}
                  </Link>
                )}
              </div>
            )}
            <nav aria-label="Sections (mobile)" className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-rule py-3 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted transition hover:text-ink"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-5 flex flex-col gap-2">
              {isLogged ? (
                <>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-12 items-center justify-center border border-rule font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted transition hover:border-ink hover:text-ink"
                  >
                    Mon compte
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      await signOut();
                      window.location.href = "/";
                    }}
                    className="inline-flex h-12 items-center justify-center font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted transition hover:text-danger"
                  >
                    Se déconnecter ↗
                  </button>
                </>
              ) : (
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center border border-rule font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted transition hover:border-ink hover:text-ink"
                >
                  Se connecter
                </Link>
              )}
              <Link
                href={actionHref}
                onClick={() => setOpen(false)}
                className="cta-primary group inline-flex h-12 items-center justify-center gap-2 font-mono text-[13px] uppercase tracking-[0.18em]"
              >
                {isEmpty ? "Recharger mes crédits" : isLogged ? "Optimiser mon CV" : "Essayer gratuitement"}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default function Landing() {
  const { data: session } = useSession();
  const sessionUser = session?.user as HeaderUser;
  const isLogged = Boolean(sessionUser);
  const isAdmin = isAdminEmail(sessionUser?.email);
  const isOutOfCredits = isLogged && !isAdmin && (sessionUser?.credits ?? 0) <= 0;
  const ctaHref = isOutOfCredits ? "/buy-credits" : "/optimiser";
  const ctaLabel = isOutOfCredits
    ? "Recharger mes crédits"
    : isLogged
      ? "Optimiser mon CV"
      : "Optimiser mon CV gratuitement";
  const launchOfferActive = isLaunchOfferActive();

  return (
    <main className="marketing-page min-h-screen overflow-x-clip">
      <StructuredData faq={FAQ_ITEMS.map((i) => ({ q: i.q, a: i.a }))} />
      <LandingHeader user={sessionUser ?? null} />

      {/* ============ HERO ============ */}
      <section className="hero-bg overflow-x-clip border-b border-rule">
        <div className="mx-auto max-w-360 px-6 pb-14 pt-10 lg:py-14 xl:py-16">

          <div className="grid items-center gap-12 xl:grid-cols-12 xl:gap-x-16">
            <div className="xl:col-span-7">
              <div className="mb-7 inline-flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 border border-rule bg-card/75 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-muted shadow-[0_1px_0_0_rgba(15,15,16,0.04)]">
                <span className="inline-flex items-center gap-2">
                  <span className="text-warm">●</span> CV ciblé par offre
                </span>
                <span className="hidden h-3 w-px bg-rule sm:inline-block" aria-hidden />
                <span className="inline-flex items-center gap-2">
                  <span className="text-accent">●</span> Sans fausse expérience
                </span>
                <span className="hidden h-3 w-px bg-rule sm:inline-block" aria-hidden />
                <span className="inline-flex items-center gap-2">
                  <span className="text-success">●</span> PDF prêt à envoyer
                </span>
              </div>

              <h1 className="max-w-4xl font-display text-[clamp(3rem,5.7vw,5.6rem)] font-light leading-[0.94] tracking-[-0.03em] text-ink">
                Adapte ton CV au langage de{" "}
                <span className="italic font-normal text-accent">l&apos;offre</span>.
              </h1>

              <p className="mt-8 max-w-2xl text-[18px] leading-relaxed text-ink-soft">
                Colle l&apos;annonce, importe ton PDF, et obtiens une version
                plus claire pour le recruteur : mots-clés utiles, score ATS,
                mise en page propre, sans inventer d&apos;expérience.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href={ctaHref}
                  className="cta-primary group inline-flex min-h-14 items-center justify-center gap-3 px-7 py-4 text-base font-medium tracking-tight"
                >
                  <span>{ctaLabel}</span>
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
                <a
                  href="#exemple"
                  className="group inline-flex min-h-14 items-center justify-center gap-3 border border-rule bg-card/60 px-7 py-4 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted transition hover:border-ink hover:bg-card hover:text-ink"
                >
                  Voir un exemple avant/après
                  <span aria-hidden className="transition-transform group-hover:translate-y-0.5">
                    ↓
                  </span>
                </a>
              </div>

              <div className="mt-6 flex max-w-2xl flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted">
                <span>● 1 génération offerte</span>
                <span>● Sans carte bancaire</span>
                <span>● CV supprimé après génération</span>
                <a
                  href="#tarifs"
                  className="inline-flex whitespace-nowrap text-accent transition hover:text-accent-hover hover:underline"
                >
                  Packs dès 4,99 € ↓
                </a>
              </div>
            </div>

            {/* Hero visual : aperçu réel du CV final généré */}
            <aside className="hero-result relative xl:col-span-5 xl:pl-2">
              <div className="relative mx-auto max-w-[500px]">
                <div
                  aria-hidden
                  className="absolute inset-0 translate-x-3 translate-y-3 border border-accent/25 bg-accent-soft/45"
                />

                <figure className="relative overflow-hidden border border-rule bg-card shadow-[0_34px_90px_-48px_rgba(16,19,26,0.5)]">
                  <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-4">
                    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-success">
                      <span aria-hidden className="h-1.5 w-1.5 bg-success" />
                      Résultat final
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                      Exemple généré
                    </span>
                  </figcaption>

                  <div className="relative h-[430px] overflow-hidden bg-white sm:h-[610px] xl:h-[590px]">
                    <Image
                      src="/ResultCV.png"
                      alt="Aperçu d'un CV optimisé généré par CV Optimizer"
                      width={1654}
                      height={2339}
                      priority
                      sizes="(max-width: 639px) calc(100vw - 48px), (max-width: 1279px) 500px, 460px"
                      className="h-auto w-full"
                    />
                    <div
                      aria-label="Informations personnelles anonymisées"
                      className="absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between border-b-2 border-ink bg-white px-3 sm:h-16 sm:px-4"
                    >
                      <div>
                        <span className="mb-1 block h-0.5 w-8 bg-accent" aria-hidden />
                        <p className="text-[8px] font-bold leading-none text-ink sm:text-[12px]">
                          CANDIDAT EXEMPLE
                        </p>
                        <p className="mt-1 font-mono text-[6px] uppercase leading-none tracking-[0.08em] text-accent sm:text-[8px]">
                          Profil web · données anonymisées
                        </p>
                      </div>
                      <p className="hidden font-mono text-[7px] uppercase tracking-[0.1em] text-ink-muted sm:block">
                        Contact masqué
                      </p>
                    </div>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-white via-white/85 to-transparent"
                    />
                  </div>

                  <div className="relative flex flex-col gap-4 border-t border-rule bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                        Preuve du rendu
                      </p>
                      <p className="mt-1 text-[13px] font-medium text-ink">
                        1 page · PDF lisible · prêt à envoyer
                      </p>
                    </div>
                    <p className="inline-flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-success">
                      <span aria-hidden className="h-1.5 w-1.5 bg-success" />
                      Identité masquée
                    </p>
                  </div>
                </figure>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ============ PROBLÈME CANDIDAT ============ */}
      <section id="probleme" className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                ● Le vrai problème
              </p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                Tu postules. Tu relances.{" "}
                <span className="italic font-normal text-warm">Personne ne répond.</span>
              </h2>
            </div>
            <p className="lg:col-span-5 text-[16px] leading-relaxed text-ink-soft">
              Le problème n&apos;est pas toujours ton expérience. Souvent, c&apos;est
              la façon dont ton CV présente cette expérience par rapport à
              l&apos;offre.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
            {[
              {
                title: "Même CV partout",
                desc: "Beaucoup de candidats envoient le même CV à toutes les offres. Le recruteur, lui, compare ton profil à une annonce précise.",
              },
              {
                title: "Lecture par indices",
                desc: "Il cherche des mots, des compétences, des outils et des preuves concrètes. Si ces signaux manquent, ton CV paraît moins pertinent.",
              },
              {
                title: "Bon profil, mauvais langage",
                desc: "Si ton CV ne parle pas le langage de l'offre, il peut être ignoré même quand ton parcours correspond vraiment.",
              },
            ].map((item, idx) => (
              <article
                key={item.title}
                className="bg-paper p-8 transition hover:bg-paper-deep lg:p-10"
              >
                <p className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-accent">
                  {String(idx + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-6 font-display text-2xl font-medium tracking-tight text-ink">
                  {item.title}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                  {item.desc}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-6 border border-warm/35 bg-warm-soft/60 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <p className="max-w-4xl font-display text-[clamp(1.6rem,3vw,2.5rem)] font-light leading-[1.08] tracking-[-0.01em] text-ink">
              Arrête d&apos;envoyer le même CV à toutes les offres.{" "}
              <span className="italic font-normal text-warm">
                Ton CV doit parler le langage de l&apos;annonce.
              </span>
            </p>
            <Link
              href={ctaHref}
              className="cta-primary group inline-flex shrink-0 items-center justify-center gap-3 px-6 py-3.5 text-sm font-medium tracking-tight"
            >
              <span>{ctaLabel}</span>
              <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ COMMENT ÇA MARCHE ============ */}
      <section id="comment" className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                ● Comment ça marche
              </p>
              <h2 className="mt-3 max-w-3xl font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                Trois étapes pour passer d&apos;un CV générique à un CV ciblé.
              </h2>
            </div>
            <p className="max-w-sm text-[15px] leading-relaxed text-ink-soft">
              CV Optimizer transforme ton CV générique en CV ciblé pour une
              offre précise, sans inventer ton parcours.
            </p>
          </div>

          <ol className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Colle l'offre",
                desc: "Copie l'annonce complète : missions, outils, compétences attendues et vocabulaire du recruteur.",
                meta: "Offre précise",
              },
              {
                num: "02",
                title: "Importe ton CV",
                desc: "Ajoute ton CV PDF actuel. L'outil garde ton vrai parcours : formations, expériences, projets et compétences.",
                meta: "PDF · jusqu'à 25 Mo",
              },
              {
                num: "03",
                title: "Télécharge la version ciblée",
                desc: "Les formulations deviennent plus claires, les bons mots-clés ressortent et tu obtiens un PDF prêt à envoyer.",
                meta: "PDF · prêt recruteur",
              },
            ].map((step) => (
              <li
                key={step.num}
                className="group bg-paper p-8 transition hover:bg-paper-deep lg:p-10"
              >
                <p className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-accent">
                  {step.num}
                </p>
                <h3 className="mt-6 font-display text-3xl font-medium tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                  {step.desc}
                </p>
                <p className="mt-6 border-t border-rule pt-4 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
                  {step.meta}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href={ctaHref}
              className="cta-primary group inline-flex items-center justify-center gap-3 px-7 py-4 text-sm font-medium tracking-tight"
            >
              <span>{ctaLabel}</span>
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faint">
              Garde ton vrai parcours, présente-le mieux.
            </p>
          </div>
        </div>
      </section>

      {/* ============ DÉMO / AVANT-APRÈS ============ */}
      <section id="exemple" className="border-b border-rule bg-paper-deep">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                ● Exemple avant/après
              </p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                La même expérience.{" "}
                <span className="italic font-normal text-accent">
                  Présentée pour l&apos;offre.
                </span>
              </h2>
            </div>
            <p className="lg:col-span-5 lg:col-start-8 self-end text-[15px] leading-relaxed text-ink-soft">
              Le but n&apos;est pas de gonfler ton CV. Le but est de rendre ton
              expérience plus précise, plus lisible et plus proche de ce que
              l&apos;annonce demande.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-2">
            <article className="bg-paper p-8 lg:p-10">
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-warm">
                ● Avant
              </p>
              <h3 className="mt-6 font-display text-2xl font-medium tracking-tight text-ink">
                CV générique
              </h3>
              <p className="mt-6 border-l-2 border-warm bg-warm-soft/55 p-5 text-xl leading-relaxed text-ink">
                “Développement de fonctionnalités web.”
              </p>
              <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
                C&apos;est vrai, mais trop large. Le recruteur ne sait pas quels
                outils, quel contexte ni quelle valeur tu apportes.
              </p>
            </article>

            <article className="bg-card p-8 lg:p-10">
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-success">
                ● Après
              </p>
              <h3 className="mt-6 font-display text-2xl font-medium tracking-tight text-ink">
                CV ciblé pour l&apos;offre
              </h3>
              <p className="mt-6 border-l-2 border-success bg-success-soft/60 p-5 text-xl leading-relaxed text-ink">
                “Développement d&apos;interfaces React responsives, intégration
                d&apos;API REST et amélioration de l&apos;expérience utilisateur
                sur une application métier.”
              </p>
              <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
                Même parcours, mais une formulation plus concrète et plus proche
                du vocabulaire d&apos;une offre frontend.
              </p>
            </article>
          </div>

          <div className="mt-10 grid gap-6 border border-rule bg-paper p-6 lg:grid-cols-[0.85fr_1.15fr] lg:p-8">
            <div>
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                Pourquoi c&apos;est mieux ?
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                La phrase reste fidèle au parcours, mais elle donne au recruteur
                plus de raisons de continuer la lecture.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                "Plus précis",
                "Plus proche du vocabulaire de l'offre",
                "Plus lisible pour un recruteur",
                "Sans inventer de fausse expérience",
              ].map((reason) => (
                <li
                  key={reason}
                  className="flex gap-3 border border-rule bg-card p-4 text-[14px] leading-snug text-ink-soft"
                >
                  <span aria-hidden className="mt-1.5 inline-block h-px w-3 shrink-0 bg-success" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-5 border border-accent/25 bg-accent-soft/55 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <div>
              <p className="font-display text-xl font-medium tracking-tight text-ink">
                Vérifie le résultat avec ta génération offerte.
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                Sans carte bancaire. Si le rendu te convient, les packs commencent à 4,99 €.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:items-end">
              <Link
                href={ctaHref}
                className="cta-primary group inline-flex items-center justify-center gap-3 px-7 py-4 text-sm font-medium tracking-tight"
              >
                <span>{ctaLabel}</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <a
                href="#tarifs"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent transition hover:underline"
              >
                Comparer les packs ↓
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ POURQUOI ÇA MARCHE ============ */}
      <section id="pourquoi" className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                ● Pourquoi ça marche
              </p>
              <h2 className="mt-3 max-w-4xl font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                Un recruteur ne lit pas ton CV dans le vide.{" "}
                <span className="italic font-normal text-accent">
                  Il le lit avec l&apos;offre en tête.
                </span>
              </h2>
            </div>
            <p className="lg:col-span-5 lg:col-start-8 self-end text-[15px] leading-relaxed text-ink-soft">
              CV Optimizer rapproche ton CV de l&apos;annonce : mêmes mots utiles,
              meilleure hiérarchie, formulations plus concrètes. Sans changer
              ton histoire.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            <div className="bg-ink p-8 text-paper lg:col-span-5 lg:p-10">
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-paper/60">
                Différenciateur
              </p>
              <h3 className="mt-6 font-display text-[clamp(2rem,4vw,3.25rem)] font-light leading-[0.98] tracking-[-0.02em] text-paper">
                Optimisé par IA,{" "}
                <span className="italic font-normal text-warm">mais sans mensonge.</span>
              </h3>
              <p className="mt-6 text-[15px] leading-relaxed text-paper/75">
                CV Optimizer reformule ton expérience pour mieux la présenter.
                Il ne crée pas de compétences, de postes ou de résultats que tu
                n&apos;as jamais eus.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:col-span-7">
              {[
                {
                  title: "Le langage de l'annonce",
                  desc: "Les termes importants ressortent quand ton CV contient déjà l'expérience correspondante.",
                },
                {
                  title: "Des preuves plus visibles",
                  desc: "Tes missions vagues deviennent des formulations plus concrètes : outils, contexte, action, impact.",
                },
                {
                  title: "Une lecture plus rapide",
                  desc: "Le recruteur comprend plus vite pourquoi ton profil mérite d'être regardé pour cette offre.",
                },
                {
                  title: "Un cadre anti-invention",
                  desc: "Garde ton vrai parcours, mais présente-le mieux. Le CV reste crédible en entretien.",
                },
              ].map((item, idx) => (
                <article key={item.title} className="bg-card p-6 lg:p-8">
                  <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-warm">
                    {String(idx + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-5 font-display text-2xl font-medium tracking-tight text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
                    {item.desc}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ TARIFS ============ */}
      <section id="tarifs" className="pricing-bg border-b border-rule bg-night text-on-night">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-on-night/60">
                ● Tarifs transparents
              </p>
              <h2 className="mt-4 max-w-4xl font-display text-[clamp(2.4rem,5vw,4.5rem)] font-light leading-[0.96] tracking-[-0.025em] text-on-night">
                Teste le résultat.{" "}
                <span className="italic font-normal text-[#ffab73]">
                  Paie seulement si tu veux continuer.
                </span>
              </h2>
            </div>
            <div className="lg:col-span-4">
              <p className="text-[16px] leading-relaxed text-on-night/75">
                Un crédit génère un CV optimisé ou une lettre de motivation.
                Aucun abonnement, aucun renouvellement automatique.
              </p>
              {launchOfferActive && (
                <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.16em] text-[#ffab73]">
                  ● {LAUNCH_OFFER.headline} jusqu&apos;au {LAUNCH_OFFER.endsOnLabel}
                </p>
              )}
            </div>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {(Object.keys(PACKS) as PackKey[]).map((key) => {
              const pack = PACKS[key];
              const featured = "featured" in pack && pack.featured;
              const bonusCredits = getPackBonusCredits(key);
              const totalCredits = getPackTotalCredits(key);
              const unitPrice = formatUnitPrice(pack.amountCents, totalCredits);

              return (
                <article
                  key={key}
                  className={`relative flex min-h-full flex-col border p-7 lg:p-8 ${
                    featured
                      ? "border-action bg-accent-soft shadow-[0_28px_80px_-42px_rgba(33,71,232,0.75)]"
                      : "border-rule bg-paper"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-7 bg-action px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-on-action">
                      Recommandé
                    </span>
                  )}
                  <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-ink-muted">
                    {pack.label}
                  </p>
                  <h3 className="mt-5 font-display text-4xl font-medium tracking-tight text-ink">
                    {totalCredits}
                    <span className="ml-2 text-base font-normal text-ink-muted">
                      générations
                    </span>
                  </h3>
                  <p className="mt-3 min-h-12 text-[15px] leading-relaxed text-ink-soft">
                    {PACK_POSITIONING[key]}
                  </p>
                  <div className="mt-6 border-t border-rule pt-5">
                    <div className="flex items-end justify-between gap-4">
                      <p className="font-display text-3xl font-medium tracking-tight text-ink">
                        {pack.price}
                      </p>
                      <p className="pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                        {unitPrice} / génération
                      </p>
                    </div>
                    {bonusCredits > 0 && (
                      <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.16em] text-success">
                        {pack.credits} + {bonusCredits} crédits offerts
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/buy-credits?pack=${key}`}
                    className="cta-primary group mt-7 inline-flex min-h-13 items-center justify-between gap-3 px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.16em]"
                  >
                    <span>Choisir {pack.label}</span>
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="mt-8 grid gap-px overflow-hidden border border-on-night/15 bg-on-night/15 sm:grid-cols-3">
            {[
              ["01", "1 CV offert", "Teste le rendu complet sans carte bancaire."],
              ["02", "Crédits sans expiration", "Utilise-les au rythme de tes candidatures."],
              ["03", "Paiement Stripe", "CV Optimizer ne stocke aucune donnée carte."],
            ].map(([number, title, text]) => (
              <div key={number} className="bg-night/85 p-5 lg:p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#ffab73]">
                  {number}
                </p>
                <p className="mt-3 font-display text-xl font-medium tracking-tight text-on-night">
                  {title}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-on-night/65">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CONFIDENTIALITÉ ============ */}
      <section id="confidentialite" className="border-b border-rule bg-paper-deep">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                ● Confidentialité
              </p>
              <h2 className="mt-3 max-w-3xl font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                Tes données restent{" "}
                <span className="italic font-normal text-success">confidentielles</span>.
              </h2>
            </div>
            <p className="lg:col-span-5 lg:col-start-8 self-end text-[15px] leading-relaxed text-ink-soft">
              Ton CV contient ton parcours, ton adresse, parfois ton téléphone.
              Ce n&apos;est pas une donnée marketing. C&apos;est une donnée sensible.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                k: "Ton CV n'est pas vendu",
                v: "Aucun usage commercial de ton CV ou du contenu de tes candidatures.",
              },
              {
                k: "Pas d'entraînement modèle",
                v: "Ton CV n'est pas utilisé pour entraîner un modèle.",
              },
              {
                k: "Pas de conservation CV",
                v: "Le contenu du CV n'est pas conservé après génération.",
              },
              {
                k: "Compte et crédits seulement",
                v: "Seuls les éléments nécessaires au compte et aux crédits sont stockés.",
              },
            ].map((c, idx) => (
              <div
                key={c.k}
                className="bg-paper p-6 transition hover:bg-card lg:p-8"
              >
                <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-faint">
                  {String(idx + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-4 font-display text-xl font-medium tracking-tight text-ink">
                  {c.k}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                  {c.v}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 border border-success/30 bg-success-soft/45 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              Tu peux tester sans carte bancaire. Le CV généré sert à ta
              candidature, pas à alimenter une base de données cachée.
            </p>
            <Link
              href={ctaHref}
              className="cta-primary group inline-flex items-center justify-center gap-3 px-7 py-4 text-sm font-medium tracking-tight"
            >
              <span>{ctaLabel}</span>
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="border-b border-rule bg-paper-deep">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:py-28">
          <div className="mb-12">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
              ● FAQ
            </p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
              Les questions qu&apos;on nous pose <span className="italic font-normal">souvent</span>.
            </h2>
          </div>

          <div className="border-t border-rule">
            {FAQ_ITEMS.map((item, idx) => (
              <details
                key={idx}
                className="group border-b border-rule"
              >
                <summary className="flex cursor-pointer items-baseline justify-between gap-4 py-6 transition hover:text-ink list-none">
                  <span className="flex items-baseline gap-4">
                    <span className="font-mono text-[12px] font-medium uppercase tracking-[0.22em] text-ink-faint">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-lg font-medium tracking-tight text-ink">
                      {item.q}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="font-mono text-base text-ink-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-6 pl-12 pr-8 text-[14px] leading-relaxed text-ink-soft">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA FINALE ============ */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="min-w-0 lg:col-span-8">
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-faint sm:text-[13px] sm:tracking-[0.22em]">
                ● Ton prochain CV doit parler le langage de l&apos;annonce
              </p>
              <h2 className="mt-4 font-display text-[clamp(2.5rem,6vw,5rem)] font-light leading-[0.95] tracking-[-0.02em] text-paper">
                Ne laisse pas une offre précise recevoir un CV générique.
                <br />
                <span className="italic font-normal text-warm">Sans mentir.</span>
              </h2>
            </div>
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-4">
              <Link
                href={ctaHref}
                className="cta-primary group inline-flex w-full min-w-0 items-center justify-between gap-3 px-7 py-5 text-base font-medium tracking-tight"
              >
                <span className="min-w-0">{ctaLabel}</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <a
                href="#tarifs"
                className="group inline-flex w-full min-w-0 items-center justify-between gap-3 border border-paper/30 px-7 py-5 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-faint transition hover:border-paper hover:text-paper sm:text-[13px] sm:tracking-[0.22em]"
              >
                <span className="min-w-0">Revoir les tarifs</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </a>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/60 sm:text-[12px] sm:tracking-[0.18em]">
                1 génération offerte · Packs dès 4,99 € · Aucun abonnement
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-paper">
        <div className="mx-auto max-w-360 px-6 py-10">
          <div className="flex flex-col gap-6 border-b border-rule pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Logo size="sm" />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-soft">
                Transforme ton CV générique en CV ciblé pour une offre précise,
                sans inventer ton parcours.
              </p>
            </div>
            <nav aria-label="Pied de page" className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted sm:grid-cols-3 sm:gap-x-10 sm:text-[13px] sm:tracking-[0.22em]">
              <Link href="/optimiser" className="hover:text-ink transition">
                Tester CV
              </Link>
              <a href="#tarifs" className="hover:text-ink transition">
                Tarifs
              </a>
              <Link href="/lettre" className="hover:text-ink transition">
                Lettre
              </Link>
              <Link href="/blog" className="hover:text-ink transition">
                Blog
              </Link>
              {isLogged ? (
                <Link href="/account" className="hover:text-ink transition">
                  Mon compte
                </Link>
              ) : (
                <Link href="/sign-in" className="hover:text-ink transition">
                  Se connecter
                </Link>
              )}
              <Link href="/cgu" className="hover:text-ink transition">
                CGU
              </Link>
              <Link href="/rgpd" className="hover:text-ink transition">
                RGPD
              </Link>
              <Link href="/remboursement" className="hover:text-ink transition">
                Remboursement
              </Link>
              <a
                href="mailto:contact@cv-optimizer.fr"
                className="hover:text-ink transition"
              >
                Contact
              </a>
            </nav>
          </div>
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted sm:text-[13px] sm:tracking-[0.22em]">
            <span className="min-w-0">© {new Date().getFullYear()} · CV Optimizer · Tous droits réservés</span>
            <span className="text-ink-faint">v.01</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
