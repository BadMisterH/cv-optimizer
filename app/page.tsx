"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
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
] as const;

const NAV_LINKS = [
  { href: "#probleme", label: "Problème" },
  { href: "#comment", label: "Étapes" },
  { href: "#exemple", label: "Exemple" },
  { href: "#pourquoi", label: "Pourquoi" },
  { href: "#confidentialite", label: "Données" },
  { href: "#faq", label: "FAQ" },
] as const;

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

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex max-w-360 items-center justify-between gap-4 px-6 py-3.5">
        <Logo size="sm" />

        <nav
          aria-label="Sections"
          className="hidden items-center gap-7 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted lg:flex"
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

        <div className="hidden items-center gap-2 lg:flex">
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
            href="/optimiser"
            className="group inline-flex h-10 items-center gap-2 bg-ink px-5 font-mono text-[13px] uppercase tracking-[0.22em] text-paper transition hover:bg-accent"
          >
            Tester
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
          className="relative inline-flex h-10 w-10 items-center justify-center border border-rule transition hover:border-ink lg:hidden"
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
        <div className="border-t border-rule bg-paper lg:hidden">
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
                href="/optimiser"
                onClick={() => setOpen(false)}
                className="group inline-flex h-12 items-center justify-center gap-2 bg-ink font-mono text-[13px] uppercase tracking-[0.22em] text-paper transition hover:bg-accent"
              >
                Tester avec mon CV
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
  const isLogged = Boolean(session?.user);
  const ctaHref = "/optimiser";

  // Tilt souris sur le CV
  const tiltRef = useRef<HTMLDivElement>(null);
  function handleTiltMove(e: ReactMouseEvent<HTMLDivElement>) {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    // base: rx=4, ry=-6 ; on permet ±5° en X et ±5° en Y autour de cette base
    const ry = -6 + (x - 0.5) * 10;
    const rx = 4 - (y - 0.5) * 10;
    el.style.setProperty("--rx", rx.toFixed(2));
    el.style.setProperty("--ry", ry.toFixed(2));
  }
  function handleTiltLeave() {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "4");
    el.style.setProperty("--ry", "-6");
  }

  return (
    <main className="min-h-screen">
      <StructuredData faq={FAQ_ITEMS.map((i) => ({ q: i.q, a: i.a }))} />
      <LandingHeader user={(session?.user as HeaderUser) ?? null} />

      {/* ============ HERO ============ */}
      <section className="hero-bg border-b border-rule">
        <div className="mx-auto max-w-360 px-6 pt-12 pb-20 lg:pt-16 lg:pb-32">

          <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
            <div className="lg:col-span-8">
              <p className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                <span className="inline-flex items-center gap-2">
                  <span className="text-warm">●</span> CV ciblé par offre
                </span>
                <span className="hidden h-3 w-px bg-rule sm:inline-block" />
                <span className="inline-flex items-center gap-2">
                  <span className="text-accent">●</span> Sans fausse expérience
                </span>
                <span className="hidden h-3 w-px bg-rule sm:inline-block" />
                <span className="inline-flex items-center gap-2">
                  <span className="text-success">●</span> PDF prêt à envoyer
                </span>
              </p>

              <h1 className="font-display text-[clamp(2.75rem,8.5vw,7rem)] font-light leading-[0.92] tracking-tight text-ink">
                Ton CV est peut-être bon.
                <br />
                Mais <span className="italic font-normal text-accent">pas</span>{" "}
                pour cette offre.
              </h1>

              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft">
                Colle une offre d&apos;emploi, importe ton CV, et obtiens une
                version plus claire, plus ciblée et plus adaptée aux recruteurs,
                sans inventer d&apos;expérience.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href={ctaHref}
                  className="group inline-flex items-center justify-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-accent"
                >
                  <span>Tester avec mon CV</span>
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
                <a
                  href="#exemple"
                  className="group inline-flex items-center justify-center gap-3 border border-rule px-7 py-4 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted transition hover:border-ink hover:text-ink"
                >
                  Voir un exemple avant/après
                  <span aria-hidden className="transition-transform group-hover:translate-y-0.5">
                    ↓
                  </span>
                </a>
              </div>

              <p className="mt-6 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-faint">
                1 essai gratuit · Pas de carte bancaire · CV supprimé après génération
              </p>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  "Ton CV reste ton vrai parcours",
                  "Les mots de l'offre ressortent",
                  "Le PDF reste lisible recruteur",
                ].map((proof) => (
                  <div
                    key={proof}
                    className="border border-rule bg-card/70 p-4 text-[13px] leading-snug text-ink-soft"
                  >
                    <span className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-success">
                      ● preuve
                    </span>
                    {proof}
                  </div>
                ))}
              </div>
            </div>

            {/* Hero visual : CV 3D flottant avec cartes stratifiées en perspective */}
            <aside className="lg:col-span-4 lg:self-end">
              <div className="cv-stage relative">
                {/* Déco : grille de points en haut à gauche */}
                <div
                  aria-hidden
                  className="absolute -left-4 -top-6 hidden grid-cols-5 gap-1.5 sm:grid"
                  style={{ gridTemplateRows: "repeat(5, 1fr)" }}
                >
                  {Array.from({ length: 25 }).map((_, i) => (
                    <span
                      key={i}
                      className="h-1 w-1 rounded-full bg-ink-faint"
                      style={{ opacity: 0.15 + ((i * 37) % 60) / 100 }}
                    />
                  ))}
                </div>

                {/* Déco : loupe line-art (ATS scanning) en bas à gauche */}
                <svg
                  aria-hidden
                  viewBox="0 0 48 48"
                  className="absolute -bottom-8 -left-6 h-14 w-14 text-warm cv-pulse"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="20" cy="20" r="13" />
                  <line x1="29.5" y1="29.5" x2="42" y2="42" strokeLinecap="round" />
                </svg>

                {/* Déco : "+" scintillants */}
                <span
                  aria-hidden
                  className="absolute right-8 -top-4 font-mono text-lg text-accent cv-pulse"
                  style={{ animationDelay: "-1.2s" }}
                >
                  +
                </span>
                <span
                  aria-hidden
                  className="absolute -right-4 top-1/3 font-mono text-lg text-warm cv-pulse"
                  style={{ animationDelay: "-0.6s" }}
                >
                  +
                </span>

                {/* Carte arrière #2 (rotation statique outer, float inner) */}
                <div
                  aria-hidden
                  className="absolute right-0 top-0 -z-10 hidden h-full w-full origin-bottom-left sm:block"
                  style={{
                    transform: "rotateY(-12deg) rotateX(6deg) translateX(28px) translateY(28px)",
                  }}
                >
                  <div className="cv-float-back h-full border border-rule bg-paper-deep shadow-[0_20px_40px_-30px_rgba(15,15,16,0.25)]">
                    <div className="border-b border-rule p-3">
                      <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-ink-faint">
                        Offre · Marketing
                      </p>
                    </div>
                    <div className="space-y-1.5 p-3">
                      {[80, 65, 75, 50].map((w, i) => (
                        <div key={i} className="h-1.5 bg-rule" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Carte arrière #1 (rotation statique outer, float inner) */}
                <div
                  aria-hidden
                  className="absolute right-0 top-0 -z-10 hidden h-full w-full origin-bottom-left sm:block"
                  style={{
                    transform: "rotateY(-9deg) rotateX(5deg) translateX(14px) translateY(14px)",
                  }}
                >
                  <div className="cv-float-slow h-full border border-rule bg-card shadow-[0_24px_50px_-30px_rgba(15,15,16,0.3)]">
                    <div className="border-b border-rule p-3">
                      <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-ink-faint">
                        Offre · Growth
                      </p>
                    </div>
                    <div className="space-y-1.5 p-3">
                      {[85, 70, 60, 78, 45].map((w, i) => (
                        <div key={i} className="h-1.5 bg-rule" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Carte avant : tilt souris (outer) + float (middle) + carte (inner) */}
                <div
                  ref={tiltRef}
                  onMouseMove={handleTiltMove}
                  onMouseLeave={handleTiltLeave}
                  className="cv-tilt origin-bottom-left"
                >
                <div className="cv-float">
                <div className="relative origin-bottom-left overflow-hidden border border-rule bg-card shadow-[0_40px_90px_-30px_rgba(15,15,16,0.4),0_8px_20px_-12px_rgba(15,15,16,0.2)]">
                  {/* Tag ATS en coin */}
                  <span className="absolute right-0 top-0 z-10 bg-success px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-paper">
                    ✓ ATS
                  </span>

                  <div className="p-5">
                    {/* Header avec photo placeholder + nom */}
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-10 shrink-0 overflow-hidden bg-paper-deep">
                        {/* Silhouette stylisée */}
                        <svg
                          viewBox="0 0 40 48"
                          className="absolute inset-0 h-full w-full text-ink-faint"
                          fill="currentColor"
                          aria-hidden
                        >
                          <circle cx="20" cy="18" r="7" />
                          <path d="M6 48c0-8 6-14 14-14s14 6 14 14H6Z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-ink-muted">
                          Curriculum Vitæ
                        </p>
                        <p className="mt-1 truncate font-display text-lg font-bold leading-tight tracking-tight text-ink">
                          Badr Aitoufel
                        </p>
                        <p className="mt-0.5 font-mono text-[12px] font-semibold tracking-[0.04em] text-accent">
                          Développeur Full-Stack
                        </p>
                      </div>
                    </div>

                    {/* Contact */}
                    <p className="mt-2.5 font-mono text-[9px] tracking-[0.04em] text-ink-muted">
                      badr@example.com · Paris · linkedin.com/in/badr
                    </p>

                    {/* Score de matching */}
                    <div className="mt-3 border border-success/25 bg-success-soft/45 p-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-ink-muted">
                          Match offre
                        </span>
                        <span className="font-display text-xl font-medium leading-none tracking-tight text-success">
                          91 %
                        </span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden bg-paper">
                        <div className="h-full w-[91%] bg-success" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {["React", "SEO", "Reporting"].map((tag) => (
                          <span
                            key={tag}
                            className="rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[7.5px] tracking-[0.04em] text-success"
                          >
                            + {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* À propos */}
                    <div className="mt-4 border-t border-rule pt-3">
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-ink">
                        À propos
                      </p>
                      <p className="mt-1.5 text-[10.5px] leading-snug text-ink-soft">
                        3 ans en{" "}
                        <mark className="rounded-sm bg-accent-soft px-0.5 text-accent">
                          React/TypeScript
                        </mark>
                        , spécialisé{" "}
                        <mark className="rounded-sm bg-accent-soft px-0.5 text-accent">
                          accessibilité
                        </mark>{" "}
                        et perfs Core Web Vitals.
                      </p>
                    </div>

                    {/* Expérience */}
                    <div className="mt-4 border-t border-rule pt-3">
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-ink">
                        Expérience
                      </p>
                      <div className="mt-2.5 space-y-3">
                        <div>
                          <p className="text-[11.5px] font-bold leading-tight text-ink">
                            Frontend Engineer{" "}
                            <span className="text-ink-muted">·</span>{" "}
                            <span className="text-accent">Acme Inc.</span>
                          </p>
                          <p className="mt-0.5 font-mono text-[9px] tracking-[0.04em] text-ink-muted">
                            2023 · 2024 · E-commerce
                          </p>
                          <ul className="mt-1 space-y-0.5 text-[10.5px] leading-snug text-ink-soft">
                            <li className="flex gap-1.5">
                              <span
                                aria-hidden
                                className="mt-1.75 inline-block h-px w-1.5 shrink-0 bg-ink"
                              />
                              <span>
                                Refonte composants UI{" "}
                                <mark className="rounded-sm bg-accent-soft px-0.5 text-accent">
                                  React
                                </mark>{" "}
                                · −30 % bundle
                              </span>
                            </li>
                            <li className="flex gap-1.5">
                              <span
                                aria-hidden
                                className="mt-1.75 inline-block h-px w-1.5 shrink-0 bg-ink"
                              />
                              <span>
                                Audit{" "}
                                <mark className="rounded-sm bg-accent-soft px-0.5 text-accent">
                                  accessibilité
                                </mark>{" "}
                                AA · LCP &lt; 1.8s
                              </span>
                            </li>
                          </ul>
                        </div>

                        <div>
                          <p className="text-[11.5px] font-bold leading-tight text-ink">
                            Développeur Full-Stack{" "}
                            <span className="text-ink-muted">·</span>{" "}
                            <span className="text-accent">BlueBird</span>
                          </p>
                          <p className="mt-0.5 font-mono text-[9px] tracking-[0.04em] text-ink-muted">
                            2021 · 2023 · SaaS B2B
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Compétences */}
                    <div className="mt-4 border-t border-rule pt-3">
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-ink">
                        Compétences techniques
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {[
                          "React",
                          "TypeScript",
                          "Next.js",
                          "A11y",
                          "Tests",
                          "Node",
                          "PostgreSQL",
                        ].map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-accent-soft px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.04em] text-accent"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Fade-out bas pour suggérer "il y a plus" */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-card via-card/80 to-transparent"
                  />
                </div>
                </div>
                </div>

                {/* Caption */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-faint">
                    ↪ exemple de rendu
                  </p>
                  <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
                    1 PDF · 1 page
                  </p>
                </div>
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

          <div className="mt-10 border border-warm/35 bg-warm-soft/60 p-6 lg:p-8">
            <p className="max-w-4xl font-display text-[clamp(1.6rem,3vw,2.5rem)] font-light leading-[1.08] tracking-[-0.01em] text-ink">
              Arrête d&apos;envoyer le même CV à toutes les offres.{" "}
              <span className="italic font-normal text-warm">
                Ton CV doit parler le langage de l&apos;annonce.
              </span>
            </p>
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
              className="group inline-flex items-center justify-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-accent"
            >
              <span>Tester avec mon CV</span>
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
              className="group inline-flex items-center justify-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-success"
            >
              <span>Tester avec mon CV</span>
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
            <div className="lg:col-span-8">
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-faint">
                ● Ton prochain CV doit parler le langage de l&apos;annonce
              </p>
              <h2 className="mt-4 font-display text-[clamp(2.5rem,6vw,5rem)] font-light leading-[0.95] tracking-[-0.02em] text-paper">
                Ne laisse pas une offre précise recevoir un CV générique.
                <br />
                <span className="italic font-normal text-warm">Sans mentir.</span>
              </h2>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-4">
              <Link
                href={ctaHref}
                className="group inline-flex w-full items-center justify-between gap-3 bg-paper px-7 py-5 text-base font-medium tracking-tight text-ink transition hover:bg-warm hover:text-paper"
              >
                <span>Tester avec mon CV</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <a
                href="#exemple"
                className="group inline-flex w-full items-center justify-between gap-3 border border-paper/30 px-7 py-5 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-faint transition hover:border-paper hover:text-paper"
              >
                Voir un exemple avant/après
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </a>
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-faint">
                1 essai gratuit · Pas de carte bancaire · CV supprimé après génération
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
            <nav aria-label="Pied de page" className="grid grid-cols-2 gap-x-10 gap-y-2 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted sm:grid-cols-3">
              <Link href="/optimiser" className="hover:text-ink transition">
                Tester CV
              </Link>
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
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
            <span>© {new Date().getFullYear()} · CV Optimizer · Tous droits réservés</span>
            <span className="text-ink-faint">v.01</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
