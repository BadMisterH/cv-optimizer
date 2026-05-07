export type CVItem = {
  heading: string;
  subheading: string;
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

export type OptimizeResponse = {
  cv: OptimizedCV;
  modifications: string[];
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
