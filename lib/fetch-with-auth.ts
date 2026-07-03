"use client";

/**
 * Wrapper fetch qui redirige vers la page d'auth si la réponse est 401
 * avec un champ `redirect` dans le body JSON. Passer `autoRedirect: false`
 * pour les flux où l'appelant préfère afficher un message + CTA inline
 * (ex: formulaire rempli qu'on ne veut pas perdre dans une navigation muette).
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init?: RequestInit,
  options?: { autoRedirect?: boolean }
): Promise<Response> {
  const autoRedirect = options?.autoRedirect ?? true;
  const res = await fetch(input, init);

  if (autoRedirect && res.status === 401) {
    const data = await res.clone().json().catch(() => null);
    if (data?.redirect && typeof window !== "undefined") {
      window.location.href = data.redirect;
      // Bloque le caller : la promesse ne résout jamais, évite tout traitement
      // de la réponse avant que la navigation prenne effet.
      return new Promise<Response>(() => {});
    }
  }

  return res;
}
