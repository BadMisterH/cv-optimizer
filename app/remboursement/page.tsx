import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "../components/Logo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de remboursement",
  description: `Politique de remboursement de ${SITE_NAME} : conditions de remboursement des crédits achetés.`,
  alternates: { canonical: "/remboursement" },
  robots: { index: true, follow: true },
};

export default function RemboursementPage() {
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
          Politique de{" "}
          <span className="italic font-normal text-accent">remboursement</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Dernière mise à jour : 7 juin 2026.
        </p>

        <article className="mt-12 space-y-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-mono [&_h3]:text-[12px] [&_h3]:uppercase [&_h3]:tracking-[0.22em] [&_h3]:text-ink-muted [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-ink-soft [&_ul]:mt-3 [&_ul]:space-y-2 [&_li]:flex [&_li]:gap-3 [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-ink-soft [&_li]:before:mt-2.5 [&_li]:before:inline-block [&_li]:before:h-px [&_li]:before:w-3 [&_li]:before:shrink-0 [&_li]:before:bg-ink">

          <section>
            <h2>01 · Principe général</h2>
            <p>
              Les crédits achetés sur <strong>{SITE_NAME}</strong> sont des biens
              numériques à usage immédiat. Conformément à l&apos;article L221-28
              du Code de la consommation, le droit de rétractation de 14 jours
              ne s&apos;applique pas aux contenus numériques dont l&apos;exécution
              a commencé avec l&apos;accord préalable du consommateur.
            </p>
            <p>
              En conséquence, <strong>les crédits achetés ne sont pas remboursables</strong> une
              fois la transaction confirmée, sauf dans les cas prévus à l&apos;article 02.
            </p>
          </section>

          <section>
            <h2>02 · Cas de remboursement</h2>
            <p>
              Un remboursement peut être accordé dans les situations suivantes :
            </p>
            <ul>
              <li>
                <span>
                  <strong>Défaillance technique</strong> : le Service est
                  inaccessible de manière prolongée (plus de 48 heures consécutives)
                  après l&apos;achat, rendant l&apos;utilisation des crédits impossible.
                </span>
              </li>
              <li>
                <span>
                  <strong>Double facturation</strong> : le montant a été prélevé
                  plusieurs fois pour la même commande.
                </span>
              </li>
              <li>
                <span>
                  <strong>Crédits non crédités</strong> : le paiement a été
                  confirmé mais les crédits n&apos;ont pas été ajoutés au compte
                  dans les 24 heures.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2>03 · Procédure de demande</h2>
            <p>
              Pour toute demande de remboursement, contactez-nous à{" "}
              <a
                href="mailto:contact@cv-optimizer.fr"
                className="text-accent hover:underline"
              >
                contact@cv-optimizer.fr
              </a>{" "}
              en précisant :
            </p>
            <ul>
              <li><span>L&apos;adresse email associée à votre compte</span></li>
              <li><span>La date et le montant de la transaction</span></li>
              <li><span>La raison de la demande</span></li>
            </ul>
            <p>
              Nous traitons les demandes dans un délai de <strong>5 jours ouvrés</strong>.
              Si la demande est acceptée, le remboursement est effectué via le
              moyen de paiement d&apos;origine dans un délai de 5 à 10 jours
              ouvrés selon votre établissement bancaire.
            </p>
          </section>

          <section>
            <h2>04 · Crédits offerts</h2>
            <p>
              Les crédits issus du bonus de bienvenue (attribués gratuitement à
              l&apos;inscription) ne sont pas remboursables car ils n&apos;ont
              pas fait l&apos;objet d&apos;un paiement.
            </p>
          </section>

          <section>
            <h2>05 · Loi applicable</h2>
            <p>
              La présente politique est soumise au droit français. Tout litige
              sera porté devant les juridictions françaises compétentes, à défaut
              de résolution amiable.
            </p>
          </section>

          <section>
            <h2>06 · Contact</h2>
            <p>
              Pour toute question relative à cette politique :{" "}
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
