import { buildEmailHtml, sendEmail } from "./email";
import { ADMIN_EMAILS } from "./admin";

const THROTTLE_MS = 30 * 60 * 1000; // 30 min : évite le spam si l'incident dure
const lastSentAt = new Map<string, number>();

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Alerte minimale par email quand un incident bloquant touche la prod (ex: solde
 * Anthropic épuisé). Throttle en mémoire par clé d'incident — au plus 1 email par
 * fenêtre tant que l'incident persiste. Limite connue : le throttle repart à zéro à
 * chaque cold start et n'est pas partagé entre instances serverless concurrentes ;
 * acceptable pour une alerte "au moins une fois", pas pour de la déduplication stricte.
 */
export async function sendOpsAlert(key: string, subject: string, detailsHtml: string): Promise<void> {
  const now = Date.now();
  const last = lastSentAt.get(key);
  if (last !== undefined && now - last < THROTTLE_MS) return;
  lastSentAt.set(key, now);

  const html = buildEmailHtml({
    title: subject,
    intro: detailsHtml,
    ctaLabel: "Voir la console Anthropic",
    url: "https://console.anthropic.com/settings/billing",
    footer: "Alerte automatique CV Optimizer — au plus 1 email par 30 min pour un même incident.",
  });

  for (const to of ADMIN_EMAILS) {
    try {
      await sendEmail({ to, subject, html, fallbackLabel: `alerte ops (${key})` });
    } catch (err) {
      console.error(`[alerting] échec envoi alerte "${key}" à ${to}:`, err);
    }
  }
}

/** Alerte dédiée aux échecs d'appel Anthropic (solde épuisé, rate limit, panne API...). */
export async function alertAnthropicApiError(status: number, message: string, route: string): Promise<void> {
  await sendOpsAlert(
    "anthropic_api_error",
    `⚠ CV Optimizer — erreur API Anthropic (${status})`,
    `Une génération a échoué avec une erreur API Anthropic sur <b>${escapeHtml(route)}</b>.<br><br>` +
      `<b>Statut :</b> ${status}<br><b>Message :</b> ${escapeHtml(message)}<br><br>` +
      `Si le message mentionne un solde de crédit trop bas, recharge sur la console Anthropic pour rétablir le service pour tous les utilisateurs.`
  );
}
