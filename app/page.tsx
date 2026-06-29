"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
import { PRICING_PUBLIC } from "@/lib/feature-flags";
import { Logo } from "./components/Logo";
import { UserMenu } from "./components/UserMenu";
import { StructuredData } from "./components/StructuredData";

const FAQ_ITEMS = [
  {
    q: "Est-ce que mes données sont sauvegardées sur vos serveurs ?",
    a: "Non. Le CV et l'offre transitent vers notre IA le temps de la génération, puis sont oubliés. Ta photo reste en local dans ton navigateur (localStorage). Seules ton email et ton solde de crédits sont stockés.",
  },
  {
    q: "Combien de temps prend une génération ?",
    a: "Environ 30 secondes pour un CV optimisé, 25 secondes pour une lettre. Un loader détaillé t'accompagne pendant l'attente.",
  },
  {
    q: "Pour qui CV Optimizer est-il pensé ?",
    a: "D'abord pour les alternants, étudiants, jeunes diplômés et profils en reconversion. L'objectif est de rendre ton expérience plus lisible pour l'offre, sans inventer de parcours.",
  },
  {
    q: "Est-ce que l'IA invente des expériences ?",
    a: "Non. Le prompt système l'interdit explicitement. Le modèle reformule, priorise et glisse des mots-clés issus de l'offre, mais reste fidèle à ton CV source.",
  },
  {
    q: "Quels formats de CV sont acceptés ?",
    a: "PDF uniquement, jusqu'à 25 Mo. Les CV générés depuis Word, Canva, Notion ou LinkedIn fonctionnent tous tant qu'ils sont exportés en PDF.",
  },
  {
    q: "Que se passe-t-il si je supprime mon compte ?",
    a: "Ton profil et ton historique sont effacés. Ton email reste tracé de manière anonyme (hash SHA-256) pour éviter qu'une même adresse reçoive plusieurs fois les crédits de bienvenue.",
  },
  {
    q: "Le PDF est-il vraiment compatible ATS ?",
    a: "Oui. Texte sélectionnable, structure A4 une colonne, mots-clés issus de l'offre, pas de tableaux ni de mise en page exotique qui font planter les parsers ATS.",
  },
] as const;

const NAV_LINKS_BASE = [
  { href: "#comment", label: "Comment" },
  { href: "#pourquoi", label: "Pourquoi" },
  { href: "#cible", label: "Cible" },
  { href: "#tarifs", label: "Tarifs", requiresPricing: true },
  { href: "#faq", label: "FAQ" },
] as const;

const NAV_LINKS = NAV_LINKS_BASE.filter(
  (link) => !("requiresPricing" in link) || PRICING_PUBLIC
);

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
            Optimiser
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
                Optimiser mon CV
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
  const ctaSecondaryHref = isLogged ? "/lettre" : "/sign-up";

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
                  <span className="text-warm">●</span> Outil français
                </span>
                <span className="hidden h-3 w-px bg-rule sm:inline-block" />
                <span className="inline-flex items-center gap-2">
                  <span className="text-accent">●</span> 30 secondes
                </span>
                <span className="hidden h-3 w-px bg-rule sm:inline-block" />
                <span className="inline-flex items-center gap-2">
                  <span className="text-success">●</span> Sans abonnement
                </span>
              </p>

              <h1 className="font-display text-[clamp(2.75rem,8.5vw,7rem)] font-light leading-[0.92] tracking-tight text-ink">
                Adapte ton CV à{" "}
                <span className="italic font-normal text-accent">chaque</span>{" "}
                offre.
                <br />
                Sans rien <span className="italic font-normal text-warm">inventer</span>.
              </h1>

              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft">
                CV Optimizer adapte ton CV à chaque offre sans mentir, sans
                abonnement, en 30 secondes. Pensé d&apos;abord pour alternants,
                étudiants, jeunes diplômés et profils en reconversion.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href={ctaHref}
                  className="group inline-flex items-center justify-center gap-3 bg-ink px-7 py-4 text-sm font-medium tracking-tight text-paper transition hover:bg-accent"
                >
                  <span>Optimiser mon CV</span>
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
                <a
                  href="#comment"
                  className="group inline-flex items-center justify-center gap-3 border border-rule px-7 py-4 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted transition hover:border-ink hover:text-ink"
                >
                  Voir comment ça marche
                  <span aria-hidden className="transition-transform group-hover:translate-y-0.5">
                    ↓
                  </span>
                </a>
              </div>

              <p className="mt-6 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-faint">
                ● 2 crédits offerts · Stage · Alternance · Premier CDI · Reconversion
              </p>
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

      {/* ============ COMMENT ÇA MARCHE ============ */}
      <section id="comment" className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                ● Comment ça marche
              </p>
              <h2 className="mt-3 max-w-3xl font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                Trois étapes. <span className="italic font-normal">Pas plus.</span>
              </h2>
            </div>
            <p className="max-w-sm text-[15px] leading-relaxed text-ink-soft">
              Tu vois le score CV/offre, les mots-clés à intégrer et la version
              PDF prête à envoyer.
            </p>
          </div>

          <ol className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Téléverse",
                desc: "PDF de ton CV actuel. L'IA extrait ton parcours réel : formations, expériences, projets et compétences.",
                meta: "PDF · jusqu'à 25 Mo",
              },
              {
                num: "02",
                title: "Choisis ton profil",
                desc: "Stage, alternance, premier CDI ou reconversion : le ton et les priorités changent selon ta situation.",
                meta: "Profil · ton adapté",
              },
              {
                num: "03",
                title: "Colle l'offre",
                desc: "Score de matching, mots-clés ajoutés, expériences priorisées. Tu télécharges un PDF A4 en moins de 30 secondes.",
                meta: "Score · PDF",
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
        </div>
      </section>

      {/* ============ POURQUOI ÇA MARCHE (features) ============ */}
      <section id="pourquoi" className="border-b border-rule bg-paper-deep">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                ● Pourquoi ça marche
              </p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                Un CV{" "}
                <span className="italic font-normal text-warm">générique</span>{" "}
                coûte des réponses.
              </h2>
            </div>
            <p className="lg:col-span-5 lg:col-start-8 self-end text-[15px] leading-relaxed text-ink-soft">
              CV Optimizer ne remplace pas ton parcours. Il rend visibles les
              bons éléments pour l&apos;offre que tu vises.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
            {[
              {
                num: "01",
                title: "Score CV/offre",
                desc: "Un indicateur simple te montre le niveau de matching : 62 %, 78 %, 91 %. Tu comprends si ton CV parle vraiment le langage de l'offre.",
              },
              {
                num: "02",
                title: "Mots-clés ajoutés",
                desc: "React, SEO, gestion de projet, reporting, relation client : les termes importants sont intégrés naturellement quand ton expérience le permet.",
              },
              {
                num: "03",
                title: "Modes profil",
                desc: "Alternance, stage, premier CDI ou reconversion : le ton change. On ne présente pas un étudiant comme un senior.",
              },
              {
                num: "04",
                title: "Anti-invention",
                desc: "L'IA ne fabrique rien : ni expériences, ni compétences. Tout sort de ton CV original, reformulé pour matcher l'offre.",
              },
              {
                num: "05",
                title: "Avant / après lisible",
                desc: "Tu vois ce qui change : les bullets deviennent plus précis, les mots-clés ressortent et le CV reste prêt à envoyer en PDF.",
              },
            ].map((feat) => (
              <div
                key={feat.num}
                className="bg-paper p-8 transition hover:bg-card lg:p-10"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-warm">
                    {feat.num}
                  </span>
                  <h3 className="font-display text-2xl font-medium tracking-tight text-ink">
                    {feat.title}
                  </h3>
                </div>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DÉMO / AVANT-APRÈS ============ */}
      <section className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
              ● Avant / Après
            </p>
            <h2 className="mt-3 max-w-4xl font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
              Une transformation <span className="italic font-normal text-accent">visible</span>, pas juste un PDF.
            </h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
            {[
              {
                tag: "Avant",
                score: "62 %",
                scoreWidth: "62%",
                heading: "CV générique",
                target: "Offre visée · Alternance marketing digital",
                bullets: [
                  "A participé à la communication de l'entreprise",
                  "Création de contenus pour les réseaux sociaux",
                  "Aide sur différents projets marketing",
                ],
                keywords: ["communication", "réseaux sociaux"],
                note: "Trop vague pour ressortir sur une offre précise.",
                tone: "warm",
              },
              {
                tag: "Après",
                score: "91 %",
                scoreWidth: "91%",
                heading: "CV adapté à l'offre",
                target: "Offre visée · Alternance marketing digital",
                bullets: [
                  "Animé 5 campagnes Instagram et TikTok avec suivi du taux d'engagement",
                  "Rédigé 30 contenus SEO alignés sur les mots-clés de l'offre",
                  "Produit un reporting hebdomadaire sur Looker Studio pour prioriser les actions",
                ],
                keywords: ["SEO", "reporting", "Looker Studio", "engagement"],
                note: "Même parcours, mais vocabulaire et preuves alignés.",
                tone: "success",
              },
            ].map((variant, i) => (
              <article
                key={i}
                className={`relative border p-8 transition hover:shadow-[0_24px_60px_-30px_rgba(15,15,16,0.18)] lg:p-10 ${
                  variant.tone === "success"
                    ? "border-success/30 bg-card"
                    : "border-rule bg-paper-deep"
                }`}
              >
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p
                      className={`font-mono text-[12px] uppercase tracking-[0.22em] ${
                        variant.tone === "success" ? "text-success" : "text-warm"
                      }`}
                    >
                      ● {variant.tag}
                    </p>
                    <h3 className="mt-5 font-display text-2xl font-medium tracking-tight text-ink">
                      {variant.heading}
                    </h3>
                    <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">
                      {variant.target}
                    </p>
                  </div>
                  <div className="min-w-24 text-right">
                    <span
                      className={`font-display text-4xl font-light leading-none tracking-tight ${
                        variant.tone === "success" ? "text-success" : "text-warm"
                      }`}
                    >
                      {variant.score}
                    </span>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                      match
                    </p>
                  </div>
                </div>
                <div className="mt-6 h-1.5 overflow-hidden bg-rule">
                  <div
                    className={`h-full ${
                      variant.tone === "success" ? "bg-success" : "bg-warm"
                    }`}
                    style={{ width: variant.scoreWidth }}
                  />
                </div>
                <ul className="mt-5 space-y-2.5">
                  {variant.bullets.map((b, idx) => (
                    <li
                      key={idx}
                      className="flex gap-3 text-[14px] leading-relaxed text-ink-soft"
                    >
                      <span
                        aria-hidden
                        className="mt-2 inline-block h-px w-3 shrink-0 bg-ink"
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-t border-rule pt-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                    Mots-clés visibles
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {variant.keywords.map((kw) => (
                      <span
                        key={kw}
                        className={`rounded-sm px-2 py-1 font-mono text-[11px] tracking-[0.04em] ${
                          variant.tone === "success"
                            ? "bg-success-soft text-success"
                            : "bg-warm-soft text-warm"
                        }`}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-7 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faint">
                  ↪ {variant.note}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ POUR QUI ============ */}
      <section id="cible" className="border-b border-rule bg-paper-deep">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
                ● Pour qui
              </p>
              <h2 className="mt-3 max-w-3xl font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                D&apos;abord pour les candidatures où{" "}
                <span className="italic font-normal">chaque mot compte</span>.
              </h2>
            </div>
            <p className="lg:col-span-5 lg:col-start-8 self-end text-[15px] leading-relaxed text-ink-soft">
              Pas un outil généraliste. La page est pensée pour les profils qui
              doivent prouver vite leur potentiel, même avec peu d&apos;expérience.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                k: "Alternants",
                v: "Valoriser les missions terrain, les outils utilisés et le rythme école / entreprise.",
                mode: "Mode alternance",
              },
              {
                k: "Étudiants",
                v: "Transformer projets, associations et jobs étudiants en expériences utiles pour un stage.",
                mode: "Mode stage",
              },
              {
                k: "Jeunes diplômés",
                v: "Faire ressortir les bons projets, stages et compétences pour un premier CDI.",
                mode: "Mode CDI junior",
              },
              {
                k: "Reconversion",
                v: "Traduire les expériences passées en compétences transférables, sans masquer le parcours.",
                mode: "Mode reconversion",
              },
            ].map((c, idx) => (
              <div
                key={c.k}
                className="border border-rule bg-paper p-6 transition hover:border-ink"
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
                <p className="mt-5 border-t border-rule pt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                  {c.mode}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PREUVE HUMAINE ============ */}
      <section className="border-b border-rule bg-paper">
        <div className="mx-auto grid max-w-360 gap-10 px-6 py-16 lg:grid-cols-12 lg:items-end lg:py-24">
          <div className="lg:col-span-4">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
              ● Preuve humaine
            </p>
            <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faint">
              Candidatures sans réponse · CV trop générique · mots-clés manquants
            </p>
          </div>
          <blockquote className="lg:col-span-8">
            <p className="font-display text-[clamp(1.8rem,4vw,3.5rem)] font-light leading-[1.02] tracking-[-0.02em] text-ink">
              “Créé par un candidat qui a connu la galère des candidatures sans réponse.”
            </p>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              L&apos;objectif est simple : aider les profils juniors ou en transition à
              présenter leur vraie expérience avec les bons mots, sans tricher et
              sans abonnement.
            </p>
          </blockquote>
        </div>
      </section>

      {/* ============ TARIFICATION ============ */}
      {PRICING_PUBLIC && (
      <section id="tarifs" className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-360 px-6 py-20 lg:py-28">
          <div className="mb-14">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted">
              ● Tarification
            </p>
            <h2 className="mt-3 max-w-4xl font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
              Commence <span className="italic font-normal text-success">gratuitement</span>.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              1 essai gratuit par service sans compte, puis 2 crédits offerts
              à l&apos;inscription. Pas d&apos;abonnement, pas de carte requise pour
              démarrer.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
            {[
              {
                tier: "Découverte",
                price: "Gratuit",
                meta: "Sans compte",
                features: [
                  "1 CV optimisé offert",
                  "1 lettre de motivation offerte",
                  "PDF téléchargeable",
                ],
              },
              {
                tier: "Inscription",
                price: "2 crédits",
                meta: "Offerts à la création",
                features: [
                  "2 générations au choix",
                  "Historique de ton dernier CV",
                  "Sauvegarde locale photo",
                ],
                featured: true,
              },
              {
                tier: "Packs",
                price: "Dès 4,99 €",
                meta: "Sans abonnement",
                features: [
                  "5, 15 ou 50 crédits",
                  "Crédits sans expiration",
                  "Paiement sécurisé Stripe",
                ],
                disabled: true,
              },
            ].map((p) => (
              <div
                key={p.tier}
                className={`relative bg-paper p-8 lg:p-10 ${
                  p.featured ? "lg:scale-[1.02]" : ""
                }`}
              >
                {p.featured && (
                  <span className="absolute right-6 top-6 bg-warm px-3 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-paper">
                    Recommandé
                  </span>
                )}
                <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
                  {p.tier}
                </p>
                <p className="mt-6 font-display text-4xl font-light tracking-tight text-ink">
                  {p.price}
                </p>
                <p className="mt-1 font-mono text-[13px] tracking-[0.04em] text-ink-muted">
                  {p.meta}
                </p>
                <ul className="mt-6 space-y-2.5 border-t border-rule pt-5">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex gap-3 text-[13px] leading-snug text-ink-soft"
                    >
                      <span aria-hidden className="mt-1.5 inline-block h-px w-2.5 shrink-0 bg-ink" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.disabled && (
                  <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-faint">
                    ● Bientôt disponible
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

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
                ● Prêt à envoyer un CV moins générique ?
              </p>
              <h2 className="mt-4 font-display text-[clamp(2.5rem,6vw,5rem)] font-light leading-[0.95] tracking-[-0.02em] text-paper">
                Adapte ton prochain CV.
                <br />
                <span className="italic font-normal text-warm">Sans mentir.</span>
              </h2>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-4">
              <Link
                href={ctaHref}
                className="group inline-flex w-full items-center justify-between gap-3 bg-paper px-7 py-5 text-base font-medium tracking-tight text-ink transition hover:bg-warm hover:text-paper"
              >
                <span>Optimiser mon CV</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href={ctaSecondaryHref}
                className="group inline-flex w-full items-center justify-between gap-3 border border-paper/30 px-7 py-5 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-faint transition hover:border-paper hover:text-paper"
              >
                {isLogged ? "Générer une lettre" : "Créer un compte gratuit"}
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-faint">
                ● 2 crédits offerts · Sans abonnement
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
                L&apos;outil français pour adapter ton CV à chaque offre sans mentir,
                sans abonnement, en 30 secondes.
              </p>
            </div>
            <nav aria-label="Pied de page" className="grid grid-cols-2 gap-x-10 gap-y-2 font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted sm:grid-cols-3">
              <Link href="/optimiser" className="hover:text-ink transition">
                Optimiser CV
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
