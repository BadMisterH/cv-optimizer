/**
 * Emails autorisés à utiliser l'app sans limite (pas de déduction de crédits).
 * Lus côté serveur (bypass du gate) ET côté client (affichage du solde).
 */
export const ADMIN_EMAILS: ReadonlySet<string> = new Set([
  "badraitoufel5@gmail.com",
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
