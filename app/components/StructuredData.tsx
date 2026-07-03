import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Données structurées schema.org pour la landing.
 * Cumule Organization, WebSite, SoftwareApplication, FAQPage et HowTo
 * dans un seul @graph pour limiter la duplication.
 *
 * SÉCURITÉ : dangerouslySetInnerHTML utilisé pour JSON-LD (méthode officielle
 * Next.js). Contenu généré exclusivement depuis constantes serveur + props
 * typés. Aucune entrée user. JSON.stringify échappe les caractères spéciaux.
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
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/CV-optimize-logo.png`,
          width: 512,
          height: 512,
        },
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
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}#app`,
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Career",
        operatingSystem: "Web",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: "fr-FR",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          description: "1 génération offerte à l'inscription, sans carte bancaire",
          availability: "https://schema.org/InStock",
        },
        featureList: [
          "Transformation d'un CV générique en CV ciblé",
          "Adaptation à une offre d'emploi précise",
          "Reformulation sans invention d'expérience",
          "Mots-clés de l'offre intégrés quand le parcours le permet",
          "Export PDF prêt à envoyer",
        ],
      },
      {
        "@type": "HowTo",
        "@id": `${SITE_URL}#how-to`,
        name: "Comment créer un CV ciblé pour une offre avec CV Optimizer",
        description:
          "3 étapes pour transformer un CV générique en CV ciblé pour une offre précise, sans inventer ton parcours.",
        totalTime: "PT30S",
        estimatedCost: {
          "@type": "MonetaryAmount",
          currency: "EUR",
          value: "0",
        },
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Colle l'offre d'emploi",
            text: "Copie l'annonce complète : missions, outils, compétences attendues et vocabulaire du recruteur.",
            url: `${SITE_URL}/#comment`,
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Importe ton CV",
            text: "Ajoute ton CV PDF actuel. CV Optimizer garde ton vrai parcours : formations, expériences, projets et compétences.",
            url: `${SITE_URL}/#comment`,
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Télécharge la version ciblée",
            text: "Les formulations deviennent plus claires, les bons mots-clés ressortent et tu obtiens un PDF prêt à envoyer.",
            url: `${SITE_URL}/#comment`,
          },
        ],
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
