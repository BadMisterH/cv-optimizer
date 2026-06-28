import Link from "next/link";
import { Logo } from "../../components/Logo";
import { pageMetadata, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo-metadata";
import { getBlogPost } from "@/lib/blog-posts";

const post = getBlogPost("cv-compatible-ats")!;

export const metadata = pageMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${post.slug}`,
});

export default function CvAtsCompatiblePage() {
  return (
    <main className="min-h-screen bg-paper">
      {/* SÉCURITÉ : dangerouslySetInnerHTML pour JSON-LD (méthode officielle Next.js).
          Contenu généré exclusivement depuis lib/blog-posts.ts (constantes serveur),
          aucune entrée user. JSON.stringify échappe les caractères spéciaux. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articleJsonLd({
              title: post.title,
              description: post.description,
              path: `/blog/${post.slug}`,
              datePublished: post.publishedAt,
            })
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Blog", path: "/blog" },
              { name: post.title, path: `/blog/${post.slug}` },
            ])
          ),
        }}
      />

      <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
        <div className="mb-12 flex items-center justify-between">
          <Logo size="md" />
          <Link
            href="/blog"
            className="font-mono text-[13px] uppercase tracking-[0.22em] text-ink-muted hover:text-ink"
          >
            ← Blog
          </Link>
        </div>

        <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-ink-muted">
          ● Passer les filtres ATS
        </span>

        <h1 className="mt-6 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-tight text-ink">
          CV compatible ATS : comment vérifier{" "}
          <span className="italic font-normal text-accent">(et corriger)</span>{" "}
          ton PDF.
        </h1>

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Publié le{" "}
          {new Date(post.publishedAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <article className="mt-12 space-y-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-mono [&_h3]:text-[12px] [&_h3]:uppercase [&_h3]:tracking-[0.22em] [&_h3]:text-ink-muted [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-ink-soft [&_ul]:mt-3 [&_ul]:space-y-2 [&_li]:flex [&_li]:gap-3 [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-ink-soft [&_li]:before:mt-2.5 [&_li]:before:inline-block [&_li]:before:h-px [&_li]:before:w-3 [&_li]:before:shrink-0 [&_li]:before:bg-ink">
          <section>
            <h2>01 · Le chiffre qui change tout</h2>
            <p>
              75 % des CV sont filtrés par un logiciel avant qu&apos;un
              recruteur en lise une seule ligne. Ce logiciel s&apos;appelle un
              ATS (Applicant Tracking System) : il scanne ton PDF, en extrait
              le texte, et le classe selon les mots-clés de l&apos;offre. S&apos;il
              n&apos;arrive pas à lire correctement ton CV, tu n&apos;es pas
              classé en dernier. Tu disparais.
            </p>
            <p>
              Le problème n&apos;est presque jamais le contenu. C&apos;est le
              format. Un CV bien écrit mais mal structuré peut arriver vide
              ou dans le désordre côté ATS, alors qu&apos;il a l&apos;air
              parfait à l&apos;œil sur ton écran.
            </p>
          </section>

          <section>
            <h2>02 · Les 5 raisons pour lesquelles un ATS rejette ton CV</h2>
            <ul>
              <li>
                <span>
                  <strong>Les colonnes et zones de texte.</strong> Un ATS lit
                  de haut en bas, colonne par colonne dans l&apos;ordre du
                  fichier, pas dans l&apos;ordre visuel. Un CV à deux colonnes
                  peut ressortir avec ton poste actuel collé à une formation
                  d&apos;il y a dix ans.
                </span>
              </li>
              <li>
                <span>
                  <strong>Le texte dans des images.</strong> Si ton CV a été
                  exporté depuis Canva ou une maquette graphique sans police
                  texte réelle, l&apos;ATS voit une image. Zéro mot extrait,
                  zéro correspondance avec l&apos;offre.
                </span>
              </li>
              <li>
                <span>
                  <strong>Les tableaux.</strong> Beaucoup de parseurs ATS
                  ignorent purement et simplement le contenu des cellules de
                  tableau, ou le lisent ligne par ligne sans respecter les
                  colonnes.
                </span>
              </li>
              <li>
                <span>
                  <strong>Les coordonnées en en-tête ou pied de page.</strong>{" "}
                  Certains ATS n&apos;analysent que le corps du document. Ton
                  email et ton téléphone, placés dans l&apos;en-tête Word,
                  peuvent ne jamais être lus.
                </span>
              </li>
              <li>
                <span>
                  <strong>Les puces en icônes.</strong> Une jolie icône de
                  téléphone ou de localisation à la place du mot lui-même ne
                  veut rien dire pour un parseur de texte.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2>03 · Le test en 30 secondes</h2>
            <p>
              Pas besoin d&apos;outil payant pour savoir si ton CV est
              lisible par un ATS. Ouvre ton PDF, fais un <strong>Ctrl+A</strong>{" "}
              puis <strong>Ctrl+C</strong>, et colle le résultat dans un
              éditeur de texte brut (Bloc-notes, TextEdit en mode texte
              brut, ou une note vide).
            </p>
            <p>
              Si le texte qui sort est complet, dans un ordre logique
              (coordonnées, puis expériences dans le bon ordre, puis
              formation), ton CV est lisible par une machine. Si tu obtiens
              du texte mélangé, des blancs à la place de sections entières, ou
              rien du tout, c&apos;est que ton format pose problème, même si le
              rendu visuel est impeccable.
            </p>
          </section>

          <section>
            <h2>04 · Le format qui passe</h2>
            <ul>
              <li>
                <span>
                  <strong>PDF avec texte natif</strong>, pas une image
                  scannée ou exportée depuis un outil de design sans police
                  réelle.
                </span>
              </li>
              <li>
                <span>
                  <strong>Une seule colonne</strong>, du haut vers le bas,
                  dans l&apos;ordre où tu veux que l&apos;information soit
                  lue.
                </span>
              </li>
              <li>
                <span>
                  <strong>Des titres de section clairs</strong> en texte
                  (« Expérience », « Formation », « Compétences »), pas des
                  séparateurs graphiques seuls.
                </span>
              </li>
              <li>
                <span>
                  <strong>Aucun tableau</strong> pour structurer les
                  expériences ou les compétences.
                </span>
              </li>
              <li>
                <span>
                  <strong>Les mots-clés de l&apos;offre repris tels quels.</strong>{" "}
                  Un ATS associe des chaînes de caractères. Si l&apos;offre dit
                  « gestion de projet » et que ton CV dit « pilotage
                  d&apos;initiatives », la correspondance peut ne pas se faire.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2>05 · Passer le filtre ne suffit pas</h2>
            <p>
              Un CV ATS-friendly évite le rejet automatique. Mais un ATS qui
              te laisse passer ne garantit pas qu&apos;un recruteur s&apos;arrête
              sur ton profil : il faut aussi que les mots-clés et les
              expériences mises en avant matchent précisément l&apos;offre
              visée, pas juste ton intitulé de poste général.
            </p>
            <p>
              C&apos;est ce que fait{" "}
              <Link href="/optimiser" className="text-accent hover:underline">
                CV Optimizer
              </Link>{" "}
              : ton CV reformulé en une colonne, sans tableau ni image, avec
              les mots-clés de l&apos;offre placés où il faut, sans rien
              inventer dans ton parcours. PDF prêt en moins de 30 secondes.
            </p>
          </section>
        </article>

        <div className="mt-16 flex items-center justify-between gap-4 border-t border-rule pt-6 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
          <Link href="/optimiser" className="hover:text-ink transition">
            → Optimiser mon CV
          </Link>
          <Link href="/blog" className="hover:text-ink transition">
            ← Tous les articles
          </Link>
        </div>
      </div>
    </main>
  );
}
