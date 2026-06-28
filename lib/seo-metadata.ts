import type { Metadata } from "next";
import { SITE_LOCALE, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Helper pour construire une Metadata Next.js par-page de manière cohérente.
 * Tous les champs OG/Twitter/canonical sont déduits automatiquement.
 */
export function pageMetadata(opts: {
  /** Titre de la page (sans suffixe — le template du layout root ajoute "· CV Optimizer") */
  title: string;
  /** Description meta (140-160 caractères idéaux) */
  description: string;
  /** Path canonique (ex: "/optimiser") */
  path: string;
  /** Désindexer cette page (compte, paiement, mot de passe...) */
  noindex?: boolean;
  /** Mots-clés spécifiques à cette page (étend les keywords globaux) */
  keywords?: string[];
  /** Image OG dédiée (sinon fallback sur l'OG programmatique du site) */
  ogImage?: string;
}): Metadata {
  const canonicalUrl = `${SITE_URL}${opts.path}`;
  const ogImage = opts.ogImage ?? "/opengraph-image";

  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: {
      canonical: opts.path,
    },
    robots: opts.noindex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
    openGraph: opts.noindex
      ? undefined
      : {
          type: "website",
          url: canonicalUrl,
          siteName: SITE_NAME,
          locale: SITE_LOCALE,
          title: opts.title,
          description: opts.description,
          images: [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: opts.title,
            },
          ],
        },
    twitter: opts.noindex
      ? undefined
      : {
          card: "summary_large_image",
          title: opts.title,
          description: opts.description,
          images: [ogImage],
        },
  };
}

/**
 * JSON-LD pour fil d'Ariane (BreadcrumbList).
 * À inclure via un <script type="application/ld+json"> côté server.
 */
export function breadcrumbJsonLd(crumbs: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

/**
 * JSON-LD Article pour un billet de blog.
 * À inclure via un <script type="application/ld+json"> côté server.
 */
export function articleJsonLd(opts: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}) {
  const url = `${SITE_URL}${opts.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    inLanguage: "fr-FR",
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/CV-optimize-logo.png`,
      },
    },
  };
}
