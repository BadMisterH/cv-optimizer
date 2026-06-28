/**
 * Source unique de vérité pour les billets de blog.
 * Utilisée par /blog (index), /blog/[slug] (article) et sitemap.ts.
 */
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "cv-compatible-ats",
    title: "CV compatible ATS : comment vérifier (et corriger) ton PDF",
    description:
      "75 % des CV sont filtrés par un robot avant qu'un recruteur les lise. Voici comment vérifier que ton PDF passe les filtres ATS, et comment le corriger.",
    publishedAt: "2026-06-28",
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
