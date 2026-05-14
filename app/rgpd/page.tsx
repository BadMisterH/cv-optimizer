import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "../components/Logo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité (RGPD)",
  description: `Politique de confidentialité de ${SITE_NAME} : données collectées, finalités, conservation, sous-traitants, droits RGPD.`,
  alternates: { canonical: "/rgpd" },
  robots: { index: true, follow: true },
};

export default function RGPDPage() {
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
          ● Données personnelles
        </span>

        <h1 className="mt-6 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-[0.98] tracking-tight text-ink">
          Politique de{" "}
          <span className="italic font-normal text-accent">confidentialité</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Comment {SITE_NAME} collecte, traite et protège vos données
          personnelles, conformément au RGPD (Règlement UE 2016/679) et à la
          loi Informatique et Libertés. Dernière mise à jour : 14 mai 2026.
        </p>

        <article className="mt-12 space-y-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-mono [&_h3]:text-[12px] [&_h3]:uppercase [&_h3]:tracking-[0.22em] [&_h3]:text-ink-muted [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-ink-soft [&_ul]:mt-3 [&_ul]:space-y-2 [&_li]:flex [&_li]:gap-3 [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-ink-soft [&_li]:before:mt-2.5 [&_li]:before:inline-block [&_li]:before:h-px [&_li]:before:w-3 [&_li]:before:shrink-0 [&_li]:before:bg-ink">

          <section>
            <h2>01 · Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données personnelles collectées
              sur {SITE_NAME} est l&apos;éditeur du service.
            </p>
            <p>
              Contact :{" "}
              <a
                href="mailto:contact@cv-optimizer.fr"
                className="text-accent hover:underline"
              >
                contact@cv-optimizer.fr
              </a>
            </p>
          </section>

          <section>
            <h2>02 · Données collectées</h2>
            <h3>Lors de l&apos;inscription</h3>
            <ul>
              <li><span><strong>Adresse email</strong> — pour la création du compte et les communications de service (vérification, réinitialisation de mot de passe)</span></li>
              <li><span><strong>Mot de passe</strong> — stocké uniquement sous forme hashée (bcrypt). Le mot de passe en clair n&apos;est jamais conservé</span></li>
              <li><span><strong>Nom</strong> (optionnel) — si vous l&apos;avez fourni</span></li>
            </ul>
            <h3>Lors de l&apos;usage du service</h3>
            <ul>
              <li><span><strong>Solde de crédits</strong> — entier stocké dans votre profil</span></li>
              <li><span><strong>CV PDF + offre d&apos;emploi</strong> — transmis temporairement à Claude (Anthropic) pour la génération, puis effacés. Aucune sauvegarde côté serveur</span></li>
              <li><span><strong>Photo de profil</strong> — stockée localement dans votre navigateur (localStorage), jamais transmise à nos serveurs</span></li>
              <li><span><strong>Historique d&apos;achats</strong> (si applicable) — date, montant, pack, identifiant Stripe (table <code>purchases</code>)</span></li>
            </ul>
            <h3>Cookies anti-fraude (sans connexion)</h3>
            <ul>
              <li><span><code>anon_cv_used</code> et <code>anon_letter_used</code> — cookies httpOnly, durée 30 jours, posés après le premier essai gratuit pour limiter à 1 génération par service par navigateur non-connecté</span></li>
              <li><span>Cookies de session better-auth — strictement nécessaires au fonctionnement de l&apos;authentification</span></li>
            </ul>
          </section>

          <section>
            <h2>03 · Finalités du traitement</h2>
            <ul>
              <li><span>Création et gestion du compte utilisateur</span></li>
              <li><span>Envoi des emails de vérification et de réinitialisation de mot de passe</span></li>
              <li><span>Génération de CV et lettres de motivation (transit vers Claude)</span></li>
              <li><span>Gestion du système de crédits (attribution, déduction, achat)</span></li>
              <li><span>Prévention de la fraude (cookies anonymes, hash des emails ayant consommé le bonus)</span></li>
              <li><span>Sécurisation du service (logs techniques, détection d&apos;abus)</span></li>
            </ul>
          </section>

          <section>
            <h2>04 · Bases légales</h2>
            <ul>
              <li><span><strong>Exécution contractuelle</strong> (art. 6.1.b RGPD) — création de compte, gestion des crédits, génération de documents</span></li>
              <li><span><strong>Intérêt légitime</strong> (art. 6.1.f RGPD) — prévention de la fraude, sécurité technique, logs</span></li>
              <li><span><strong>Consentement</strong> (art. 6.1.a RGPD) — pour toute communication non strictement nécessaire au service (newsletter à venir)</span></li>
              <li><span><strong>Obligation légale</strong> (art. 6.1.c RGPD) — pour la conservation des données comptables liées aux paiements</span></li>
            </ul>
          </section>

          <section>
            <h2>05 · Sous-traitants & destinataires</h2>
            <p>
              {SITE_NAME} fait appel aux prestataires suivants pour
              l&apos;exécution du Service. Chacun est lié par un accord de
              traitement de données conforme au RGPD :
            </p>
            <ul>
              <li><span><strong>Anthropic</strong> (Claude API) — génération IA, données traitées aux États-Unis. Encadrement par clauses contractuelles types (SCC) de la Commission européenne</span></li>
              <li><span><strong>Supabase</strong> (PostgreSQL) — base de données. Région : <code>eu-north-1</code> (Stockholm, Suède — UE)</span></li>
              <li><span><strong>Vercel</strong> (hébergement web) — infrastructure CDN edge, headquarters aux États-Unis (Privacy Shield successor)</span></li>
              <li><span><strong>Resend</strong> (envoi d&apos;emails transactionnels) — serveurs basés en Irlande (UE)</span></li>
              <li><span><strong>Stripe</strong> (paiement, à venir) — traitement des paiements par carte, certifié PCI-DSS Level 1</span></li>
            </ul>
            <p>
              Aucune donnée personnelle n&apos;est vendue ou cédée à des tiers
              à des fins commerciales.
            </p>
          </section>

          <section>
            <h2>06 · Durées de conservation</h2>
            <ul>
              <li><span><strong>Compte utilisateur</strong> — jusqu&apos;à suppression demandée par l&apos;utilisateur</span></li>
              <li><span><strong>CV et offres envoyés à Claude</strong> — non conservés (transit uniquement, durée de la requête)</span></li>
              <li><span><strong>Hash SHA-256 anti-fraude</strong> — conservé indéfiniment après suppression du compte, pour empêcher l&apos;abus du bonus de bienvenue. Ne permet pas de retrouver l&apos;email d&apos;origine</span></li>
              <li><span><strong>Données comptables</strong> (achats Stripe) — 10 ans (obligation légale française)</span></li>
              <li><span><strong>Cookies anonymes</strong> — 30 jours</span></li>
              <li><span><strong>Logs techniques</strong> — 12 mois maximum</span></li>
            </ul>
          </section>

          <section>
            <h2>07 · Sécurité</h2>
            <ul>
              <li><span>Mots de passe hashés (algorithme bcrypt, salage automatique)</span></li>
              <li><span>Cookies de session httpOnly + Secure (HTTPS uniquement) + SameSite=Lax</span></li>
              <li><span>Connexion à la base via TLS (Supabase pooler)</span></li>
              <li><span>Aucun stockage permanent des CV ou offres d&apos;emploi sur nos serveurs</span></li>
              <li><span>Bypass CSRF via vérification d&apos;origine (trustedOrigins)</span></li>
            </ul>
          </section>

          <section>
            <h2>08 · Vos droits</h2>
            <p>
              Conformément au RGPD, vous disposez des droits suivants sur vos
              données personnelles :
            </p>
            <ul>
              <li><span><strong>Accès</strong> — obtenir une copie de vos données</span></li>
              <li><span><strong>Rectification</strong> — corriger des données inexactes</span></li>
              <li><span><strong>Effacement (« droit à l&apos;oubli »)</strong> — supprimer votre compte via <Link href="/account" className="text-accent hover:underline">/account</Link>. Note : le hash anti-fraude est conservé (cf. art. 06)</span></li>
              <li><span><strong>Limitation</strong> — restreindre certains traitements</span></li>
              <li><span><strong>Portabilité</strong> — récupérer vos données dans un format structuré</span></li>
              <li><span><strong>Opposition</strong> — vous opposer à un traitement basé sur l&apos;intérêt légitime</span></li>
              <li><span><strong>Retrait du consentement</strong> — à tout moment, sans affecter la licéité du traitement antérieur</span></li>
            </ul>
            <p>
              Pour exercer ces droits, écrivez à{" "}
              <a
                href="mailto:contact@cv-optimizer.fr"
                className="text-accent hover:underline"
              >
                contact@cv-optimizer.fr
              </a>. Une réponse est apportée dans un délai d&apos;un mois maximum.
            </p>
          </section>

          <section>
            <h2>09 · Cookies — détail</h2>
            <p>
              Nous utilisons exclusivement des cookies <strong>strictement
              nécessaires</strong> au fonctionnement du service. Aucun cookie
              de mesure d&apos;audience, de traçage publicitaire ou de réseau
              social n&apos;est posé.
            </p>
            <ul>
              <li><span><code>better-auth.session_token</code> — cookie de session, indispensable à l&apos;authentification</span></li>
              <li><span><code>anon_cv_used</code> / <code>anon_letter_used</code> — limitation anti-abus pour les essais gratuits sans compte</span></li>
            </ul>
          </section>

          <section>
            <h2>10 · Réclamation</h2>
            <p>
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez
              déposer une réclamation auprès de la{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                CNIL
              </a>{" "}
              (Commission Nationale de l&apos;Informatique et des Libertés) :
              3 place de Fontenoy, 75007 Paris.
            </p>
          </section>

          <section>
            <h2>11 · Modifications</h2>
            <p>
              La présente politique peut être mise à jour. Toute modification
              substantielle est notifiée par email aux utilisateurs inscrits.
              La date de dernière mise à jour est indiquée en haut de cette
              page.
            </p>
          </section>
        </article>

        <div className="mt-16 flex items-center justify-between gap-4 border-t border-rule pt-6 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
          <Link href="/cgu" className="hover:text-ink transition">
            → Conditions générales d&apos;utilisation
          </Link>
          <Link href="/" className="hover:text-ink transition">
            ← Accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
