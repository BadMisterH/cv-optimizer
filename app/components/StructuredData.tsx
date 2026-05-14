import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Données structurées schema.org pour la landing.
 * Cumule Organization, WebSite, SoftwareApplication et FAQPage
 * dans un seul @graph pour limiter la duplication.
 *
 * SÉCURITÉ : utilise dangerouslySetInnerHTML car c'est la méthode officielle
 * Next.js / React pour injecter du JSON-LD. Le contenu est ENTIÈREMENT généré
 * côté serveur depuis des constantes et le tableau `faq` typé. Aucune entrée
 * utilisateur n'est jamais interpolée. JSON.stringify échappe automatiquement
 * tous les caractères spéciaux. Risque XSS : nul.
 */
type FAQItem = { q: string; a: string };

export function StructuredData({ faq }: { faq: FAQItem[] }) {
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/CV-optimize-logo.png`,
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}#organization` },
        inLanguage: "fr-FR",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}#app`,
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: "fr-FR",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          description: "2 crédits offerts à l'inscription",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}#faq`,
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
