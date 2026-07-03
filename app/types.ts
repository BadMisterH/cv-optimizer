export type CVItem = {
  heading: string;
  subheading: string;
  company?: string;
  bullets: string[];
  tags: string[];
};

export type CVSection = {
  title: string;
  items: CVItem[];
};

export type CVContact = {
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
};

export type OptimizedCV = {
  fullName: string;
  title: string;
  accroche: string;
  contact: CVContact;
  sections: CVSection[];
};

export type ATSScore = {
  /** Score global 0-100 */
  overall: number;
  /** Match des mots-clés de l'offre dans le CV (0-100) */
  keywords: number;
  /** Densité et pertinence des compétences (0-100) */
  skills: number;
  /** Qualité structurelle du CV (sections, bullets, action verbs) (0-100) */
  structure: number;
  /** 3 conseils actionnables pour augmenter le score */
  tips: string[];
  /** Liste des mots-clés importants de l'offre QUI MANQUENT dans le CV (pour suggestions concrètes) */
  missingKeywords: string[];
};

export type ATSInterpretation = {
  /** Identité que l'ATS devrait pouvoir extraire du CV optimisé */
  identity: {
    fullName: string;
    title: string;
    emailFound: boolean;
    phoneFound: boolean;
  };
  /** Sections principales reconnues dans le CV optimisé */
  detectedSections: string[];
  /** Compétences détectables par mots-clés ou variations proches */
  detectedSkills: string[];
  /** Mots-clés de l'offre présents dans le CV optimisé */
  matchedKeywords: string[];
  /** Mots-clés importants encore absents ou sous-représentés */
  missingKeywords: string[];
  /** Risques possibles de lecture ATS ou de compréhension recruteur */
  parsingRisks: string[];
  /** Synthèse courte en langage candidat */
  summary: string;
};

export type OptimizeResponse = {
  cv: OptimizedCV;
  modifications: string[];
  atsScore: ATSScore;
  atsInterpretation: ATSInterpretation;
  /** Points de fidélité/complétude ambigus détectés par l'audit sémantique, à vérifier par le candidat avant envoi. Vide si rien à signaler. */
  reviewFlags: string[];
  /** Solde de crédits juste après déduction (valeur serveur fraîche, jamais le cache client de la session). null pour un admin ou un compte sans notion de crédits. */
  remainingCredits: number | null;
};

// ===== Cover Letter =====

export type LetterRecipient = {
  company: string;
  role: string;
  department: string;
  address: string;
};

export type CoverLetter = {
  // Émetteur
  fullName: string;
  contact: CVContact;
  // Destinataire
  recipient: LetterRecipient;
  // Métadonnées
  city: string;
  date: string;
  subject: string;
  // Corps
  salutation: string;
  paragraphs: string[];
  closing: string;
  signature: string;
};

export type LetterResponse = {
  letter: CoverLetter;
  notes: string[];
};
