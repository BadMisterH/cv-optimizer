import Link from "next/link";
import { Logo } from "../components/Logo";
import { pageMetadata } from "@/lib/seo-metadata";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata = pageMetadata({
  title: "Blog",
  description:
    "Conseils concrets pour passer les filtres ATS, écrire une lettre de motivation qui ne sonne pas générique, et adapter ton CV à chaque offre.",
  path: "/blog",
});

export default function BlogIndexPage() {
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
          ● Blog
        </span>

        <h1 className="mt-6 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-light leading-[0.98] tracking-tight text-ink">
          Candidater, en{" "}
          <span className="italic font-normal text-accent">vrai</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Pas de conseils génériques. Juste ce qui fait passer un CV ou une
          lettre devant un humain, expliqué sans jargon.
        </p>

        <ul className="mt-16 space-y-10 border-t border-rule">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug} className="border-b border-rule pt-10">
              <Link href={`/blog/${post.slug}`} className="group block">
                <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
                  {new Date(post.publishedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-ink transition group-hover:text-accent">
                  {post.title}
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
                  {post.description}
                </p>
                <span className="mt-4 inline-block font-mono text-[12px] uppercase tracking-[0.22em] text-accent">
                  Lire →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-16 flex items-center justify-between gap-4 border-t border-rule pt-6 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
          <Link href="/optimiser" className="hover:text-ink transition">
            → Optimiser mon CV
          </Link>
          <Link href="/" className="hover:text-ink transition">
            ← Accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
