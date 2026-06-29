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
          description: "2 crédits offerts à l'inscription, sans carte bancaire",
          availability: "https://schema.org/InStock",
        },
        featureList: [
          "Optimisation de CV pour les ATS",
          "Adaptation à chaque offre d'emploi",
          "Lettre de motivation personnalisée",
          "Export PDF sur une page A4",
          "Génération en moins de 30 secondes",
        ],
      },
      {
        "@type": "HowTo",
        "@id": `${SITE_URL}#how-to`,
        name: "Comment optimiser ton CV à une offre d'emploi avec CV Optimizer",
        description:
          "3 étapes pour adapter ton CV à chaque candidature avec un score CV/offre, des mots-clés ATS et un PDF prêt à envoyer.",
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
            name: "Téléverse ton CV",
            text: "Téléverse ton CV au format PDF (jusqu'à 25 Mo). Format Word, Canva, Notion ou LinkedIn exporté en PDF accepté.",
            url: `${SITE_URL}/optimiser#comment`,
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Choisis ton profil et colle l'offre",
            text: "Choisis le mode adapté à ta situation : stage, alternance, premier CDI ou reconversion. Copie ensuite le texte complet de l'offre visée.",
            url: `${SITE_URL}/optimiser#comment`,
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Récupère ton CV optimisé en PDF",
            text: "Une IA reformule, priorise les bonnes expériences, place les mots-clés ATS et affiche un score de matching CV/offre. Tu récupères un PDF prêt à envoyer en moins de 30 secondes.",
            url: `${SITE_URL}/optimiser#comment`,
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
