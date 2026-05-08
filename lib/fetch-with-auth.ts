"use client";

/**
 * Wrapper fetch qui redirige vers /sign-in si la réponse est 401.
 * Préserve l'URL d'origine via ?redirect=...
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    const current = window.location.pathname + window.location.search;
    window.location.href = `/sign-in?redirect=${encodeURIComponent(current)}`;
    // Retourne quand même la réponse pour que les callers ne crash pas
    // (le redirect est en cours)
  }
  return res;
}
