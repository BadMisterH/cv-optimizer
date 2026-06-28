import Link from "next/link";
import { Logo } from "../../components/Logo";
import { pageMetadata, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo-metadata";
import { getBlogPost } from "@/lib/blog-posts";

const post = getBlogPost("lettre-motivation-phrases-clichees")!;

export const metadata = pageMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${post.slug}`,
});

const CLICHES: Array<{ phrase: string; pourquoi: string; alternative: string }> = [
  {
    phrase: "Fort de mon expérience",
    pourquoi:
      "Ça sonne important et ne dit rien. Laquelle expérience ? Pour faire quoi ? Un recruteur lit cette phrase des dizaines de fois par jour, elle ne s'arrête sur aucune.",
    alternative:
      "Nomme l'expérience précise et ce qu'elle t'a permis de faire concrètement : « En stage chez X, j'ai géré 12 dossiers clients en autonomie. »",
  },
  {
    phrase: "Passionné par votre secteur",
    pourquoi:
      "Tout le monde l'écrit, donc personne ne le croit. La passion non prouvée est ignorée par défaut.",
    alternative:
      "Donne une preuve d'intérêt déjà agie : un projet perso, une formation suivie de ton plein gré, une veille active sur le sujet.",
  },
  {
    phrase: "Représente une opportunité unique",
    pourquoi:
      "Tu parles de ce que l'entreprise t'apporte, pas de ce que tu lui apportes. C'est l'inverse de ce qu'un recruteur veut lire.",
    alternative:
      "Inverse la phrase : dis ce que toi tu peux résoudre pour eux, pas ce qu'eux t'offrent.",
  },
  {
    phrase: "J'ai à cœur de",
    pourquoi:
      "Formule molle qui annonce une intention sans jamais s'engager sur un fait vérifiable.",
    alternative:
      "Remplace l'intention par un verbe d'action conjugué à un fait passé : « j'ai structuré », « j'ai mené », « j'ai livré ».",
  },
  {
    phrase: "Vivement intéressé",
    pourquoi:
      "Déclaration d'enthousiasme générique, interchangeable d'une lettre à l'autre.",
    alternative:
      "Cite l'élément précis de l'offre qui t'intéresse (une mission, un produit, un outil cité dans l'annonce).",
  },
  {
    phrase: "Votre dynamisme",
    pourquoi:
      "Écrit dans 9 lettres sur 10, sur 9 entreprises sur 10. Aucune entreprise ne se reconnaît dans ce mot précisément.",
    alternative:
      "Cite un fait réel sur l'entreprise : un lancement récent, une actualité, un chiffre public.",
  },
  {
    phrase: "Challenge",
    pourquoi:
      "Dit que tu aimes la difficulté sans jamais dire laquelle.",
    alternative:
      "Nomme la difficulté concrète du poste telle que décrite dans l'offre, et ce que tu as déjà géré de comparable.",
  },
  {
    phrase: "Synergie",
    pourquoi:
      "Jargon d'entreprise devenu un signal d'alerte plutôt qu'un argument.",
    alternative:
      "Décris directement comment ton travail s'articule avec celui d'une autre équipe, sans le mot lui-même.",
  },
  {
    phrase: "Écosystème",
    pourquoi:
      "Mot fourre-tout qui remplace une description précise du contexte de l'entreprise ou du poste.",
    alternative:
      "Nomme les éléments réels : le marché, les outils, les équipes avec qui tu travaillerais.",
  },
  {
    phrase: "Leverage",
    pourquoi:
      "Anglicisme qui sonne comme une tentative de paraître plus « business », perçu comme tel par la plupart des recruteurs francophones.",
    alternative:
      "Utilise le verbe français de l'action réelle : exploiter, m'appuyer sur, tirer parti de.",
  },
  {
    phrase: "Saisir l'opportunité",
    pourquoi:
      "Dit « je veux ce poste » sans dire pourquoi ce poste précisément, et pas un autre.",
    alternative:
      "Relie un élément précis de ton parcours à un élément précis de l'offre, nommé explicitement.",
  },
  {
    phrase: "Rejoindre vos équipes",
    pourquoi:
      "La formule de clôture par défaut de la plupart des modèles de lettre trouvés en ligne. Un recruteur la lit sans la voir.",
    alternative:
      "Termine sur une proposition concrète : ta disponibilité, une demande d'entretien, ou ce que tu peux montrer en plus (portfolio, projet, exemple de travail).",
  },
];

export default function LettreMotivationPhrasesClicheesPage() {
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
          ● Lettre de motivation
        </span>

        <h1 className="mt-6 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[0.98] tracking-tight text-ink">
          Les 12 phrases clichées à{" "}
          <span className="italic font-normal text-accent">bannir</span>.
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
            <h2>Le test pour repérer un cliché</h2>
            <p>
              Une phrase de lettre de motivation est un cliché si tu peux
              remplacer le nom de l&apos;entreprise par n&apos;importe quel
              autre nom et que la phrase reste vraie. « Passionné par votre
              dynamisme » marche pour une banque, une start-up ou une
              boulangerie. C&apos;est le signe qu&apos;elle ne dit rien de
              spécifique sur toi ni sur eux.
            </p>
            <p>
              Les 12 formules ci-dessous reviennent dans la grande majorité
              des lettres de motivation. Un recruteur qui en lit des
              centaines les saute sans les lire. Pour chacune : pourquoi
              elle ne marche pas, et quoi écrire à la place.
            </p>
          </section>

          {CLICHES.map((c, i) => (
            <section key={c.phrase}>
              <h2>
                {String(i + 1).padStart(2, "0")} · « {c.phrase} »
              </h2>
              <p>{c.pourquoi}</p>
              <p>
                <strong>À la place :</strong> {c.alternative}
              </p>
            </section>
          ))}

          <section>
            <h2>Le principe derrière les 12</h2>
            <p>
              Toutes ces formules ont le même défaut : elles sont abstraites,
              donc interchangeables. Une lettre qui convainc fait l&apos;inverse
              à chaque phrase : elle nomme un fait précis, vérifiable, tiré
              de ton parcours réel, relié à un élément précis de l&apos;offre.
              Concret toujours préféré à l&apos;abstrait.
            </p>
            <p>
              C&apos;est exactement la règle qu&apos;on a posée pour la
              génération de lettres sur{" "}
              <Link href="/lettre" className="text-accent hover:underline">
                CV Optimizer
              </Link>{" "}
              : ces 12 formules sont explicitement interdites dans le
              prompt, au profit d&apos;un élément concret de ton CV relié à
              un élément concret de l&apos;offre.
            </p>
          </section>
        </article>

        <div className="mt-16 flex items-center justify-between gap-4 border-t border-rule pt-6 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
          <Link href="/lettre" className="hover:text-ink transition">
            → Générer ma lettre
          </Link>
          <Link href="/blog" className="hover:text-ink transition">
            ← Tous les articles
          </Link>
        </div>
      </div>
    </main>
  );
}
