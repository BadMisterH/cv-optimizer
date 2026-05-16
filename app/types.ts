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

export type OptimizeResponse = {
  cv: OptimizedCV;
  modifications: string[];
  atsScore: ATSScore;
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
