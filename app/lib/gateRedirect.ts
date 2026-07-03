/**
 * Libellé de CTA pour une redirection renvoyée par le gate d'utilisation (voir
 * lib/usage-gate.ts) — dérivé du chemin plutôt que dupliqué à chaque appelant,
 * pour rester cohérent si un nouveau motif de blocage apparaît côté serveur.
 */
export function gateRedirectLabel(redirectHref: string): string {
  if (redirectHref.startsWith("/buy-credits")) return "Acheter des crédits";
  if (redirectHref.startsWith("/sign-up")) return "Créer un compte";
  if (redirectHref.startsWith("/sign-in")) return "Se connecter";
  return "Continuer";
}
