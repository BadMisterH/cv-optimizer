import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "../components/Logo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: `Conditions générales d'utilisation de ${SITE_NAME} : règles d'usage du service, compte utilisateur, système de crédits, propriété intellectuelle.`,
  alternates: { canonical: "/cgu" },
  robots: { index: true, follow: true },
};

export default function CGUPage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
        <div className="mb-12 flex items-center justify-between">
          <Logo size="md" />
          <Link
            href="/"
            className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
          >
            ← Retour
          </Link>
        </div>

        <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-ink-muted">
          ● Cadre légal
        </span>

        <h1 className="mt-6 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-[0.98] tracking-tight text-ink">
          Conditions générales d&apos;{" "}
          <span className="italic font-normal text-accent">utilisation</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Dernière mise à jour : 14 mai 2026.
        </p>

        <article className="mt-12 space-y-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-mono [&_h3]:text-[12px] [&_h3]:uppercase [&_h3]:tracking-[0.22em] [&_h3]:text-ink-muted [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-ink-soft [&_ul]:mt-3 [&_ul]:space-y-2 [&_li]:flex [&_li]:gap-3 [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-ink-soft [&_li]:before:mt-2.5 [&_li]:before:inline-block [&_li]:before:h-px [&_li]:before:w-3 [&_li]:before:shrink-0 [&_li]:before:bg-ink">

          <section>
            <h2>01 · Objet</h2>
            <p>
              Les présentes conditions générales d&apos;utilisation (« CGU »)
              régissent l&apos;accès et l&apos;usage du service{" "}
              <strong>{SITE_NAME}</strong> (le « Service »), plateforme en ligne
              permettant d&apos;adapter un CV à une offre d&apos;emploi et de
              générer une lettre de motivation à l&apos;aide d&apos;une
              intelligence artificielle (Claude, fournie par Anthropic).
            </p>
            <p>
              L&apos;inscription au Service implique l&apos;acceptation pleine
              et entière des présentes CGU.
            </p>
          </section>

          <section>
            <h2>02 · Compte utilisateur</h2>
            <h3>Création</h3>
            <p>
              L&apos;accès complet aux fonctionnalités du Service nécessite la
              création d&apos;un compte avec une adresse email valide. La
              confirmation de l&apos;email est obligatoire avant la première
              utilisation.
            </p>
            <h3>Sécurité</h3>
            <p>
              L&apos;utilisateur est responsable de la confidentialité de son
              mot de passe et de toute activité réalisée depuis son compte. Le
              mot de passe doit comporter au minimum 8 caractères.
            </p>
            <h3>Suppression</h3>
            <p>
              L&apos;utilisateur peut supprimer son compte à tout moment depuis
              la page <Link href="/account" className="text-accent hover:underline">/account</Link>.
              La suppression est irréversible : profil et historique de session
              sont effacés. L&apos;email reste tracé sous forme anonyme (hash
              SHA-256) afin d&apos;empêcher l&apos;abus du bonus de bienvenue
              (voir article 04).
            </p>
          </section>

          <section>
            <h2>03 · Description du Service</h2>
            <p>
              Le Service propose deux fonctionnalités principales :
            </p>
            <ul>
              <li>
                <span>
                  <strong>Optimisation de CV</strong> : à partir d&apos;un CV
                  PDF et d&apos;une offre d&apos;emploi fournis par
                  l&apos;utilisateur, génération d&apos;une nouvelle version du
                  CV adaptée à l&apos;offre, sans invention d&apos;expérience.
                </span>
              </li>
              <li>
                <span>
                  <strong>Lettre de motivation</strong> : génération
                  d&apos;une lettre alignée sur le CV et l&apos;offre.
                </span>
              </li>
            </ul>
            <p>
              Le Service utilise Claude (Anthropic) comme moteur
              d&apos;intelligence artificielle. La génération prend généralement
              entre 25 et 60 secondes selon la complexité.
            </p>
          </section>

          <section>
            <h2>04 · Système de crédits</h2>
            <h3>Bonus de bienvenue</h3>
            <p>
              Tout nouvel utilisateur reçoit{" "}
              <strong>1 crédit gratuit</strong> à l&apos;inscription. Ce
              crédit n&apos;est attribué qu&apos;une seule fois par adresse
              email, indépendamment des suppressions et recréations de compte.
            </p>
            <h3>Consommation</h3>
            <p>
              Chaque génération valide (CV ou lettre) consomme{" "}
              <strong>1 crédit</strong>. Aucune déduction n&apos;est appliquée
              en cas d&apos;échec technique côté Service.
            </p>
            <h3>Achat de crédits</h3>
            <p>
              Lorsque le solde atteint zéro, l&apos;utilisateur peut acquérir
              des crédits supplémentaires via la page{" "}
              <Link href="/buy-credits" className="text-accent hover:underline">/buy-credits</Link>
              {" "}(paiement sécurisé par Stripe). Les crédits achetés
              n&apos;expirent pas, mais sont strictement nominatifs : ils ne
              sont ni cessibles, ni remboursables sauf défaillance du Service.
            </p>
          </section>

          <section>
            <h2>05 · Propriété intellectuelle</h2>
            <h3>Données utilisateur</h3>
            <p>
              L&apos;utilisateur conserve la pleine propriété de son CV
              d&apos;origine, de l&apos;offre saisie, et des CV / lettres
              générés. {SITE_NAME} ne revendique aucun droit sur ces contenus.
            </p>
            <h3>Le Service</h3>
            <p>
              La plateforme {SITE_NAME} (interface, code, design, documentation)
              est protégée par le droit d&apos;auteur. Toute reproduction non
              autorisée est interdite.
            </p>
          </section>

          <section>
            <h2>06 · Engagements de l&apos;utilisateur</h2>
            <p>L&apos;utilisateur s&apos;engage à :</p>
            <ul>
              <li><span>Fournir des informations exactes lors de l&apos;inscription</span></li>
              <li><span>Ne pas utiliser le Service à des fins illégales, frauduleuses ou nuisibles</span></li>
              <li><span>Ne pas tenter de contourner le système de crédits ou les mesures anti-abus</span></li>
              <li><span>Ne pas téléverser de contenu portant atteinte aux droits de tiers (CV qui ne lui appartient pas, par exemple)</span></li>
            </ul>
          </section>

          <section>
            <h2>07 · Disponibilité & limites de responsabilité</h2>
            <p>
              Le Service est fourni « en l&apos;état », sans garantie de
              disponibilité continue. {SITE_NAME} fait ses meilleurs efforts pour
              maintenir le Service accessible, mais ne saurait être tenu
              responsable :
            </p>
            <ul>
              <li><span>Des interruptions ponctuelles liées à la maintenance ou aux prestataires (Anthropic, Vercel, Supabase, Resend, Stripe)</span></li>
              <li><span>Du contenu généré par l&apos;IA, qui demeure soumis à la relecture et la validation de l&apos;utilisateur avant tout usage professionnel</span></li>
              <li><span>Des conséquences professionnelles (réponses à des candidatures) liées à l&apos;usage des documents générés</span></li>
            </ul>
          </section>

          <section>
            <h2>08 · Anti-fraude</h2>
            <p>
              Afin d&apos;empêcher l&apos;abus du bonus de bienvenue, {SITE_NAME}{" "}
              conserve une trace anonymisée (hash SHA-256) de toutes les
              adresses email ayant déjà bénéficié du crédit offert. Cette
              trace persiste après suppression du compte.
            </p>
            <p>
              La génération de documents nécessite un compte : l&apos;essai
              gratuit correspond au crédit de bienvenue offert à
              l&apos;inscription, soumis à la mesure anti-fraude décrite
              ci-dessus.
            </p>
          </section>

          <section>
            <h2>09 · Modification des CGU</h2>
            <p>
              {SITE_NAME} se réserve le droit de modifier les présentes CGU à
              tout moment. Les utilisateurs seront informés des modifications
              substantielles par email. L&apos;usage continu du Service après
              modification vaut acceptation des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2>10 · Loi applicable & juridiction</h2>
            <p>
              Les présentes CGU sont soumises au droit français. Tout litige
              relatif à leur exécution ou à leur interprétation sera porté
              devant les juridictions françaises compétentes, à défaut de
              résolution amiable.
            </p>
          </section>

          <section>
            <h2>11 · Contact</h2>
            <p>
              Pour toute question relative aux présentes CGU, contactez :{" "}
              <a
                href="mailto:contact@cv-optimizer.fr"
                className="text-accent hover:underline"
              >
                contact@cv-optimizer.fr
              </a>
            </p>
          </section>
        </article>

        <div className="mt-16 flex items-center justify-between gap-4 border-t border-rule pt-6 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
          <Link href="/rgpd" className="hover:text-ink transition">
            → Politique de confidentialité (RGPD)
          </Link>
          <Link href="/" className="hover:text-ink transition">
            ← Accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
