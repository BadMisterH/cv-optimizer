/**
 * Rate limiter en mémoire (sliding window).
 *
 * Limites par IP par fenêtre temporelle. Best-effort en serverless :
 * la mémoire est par instance Vercel, donc un attaquant déterminé peut
 * bypass en frappant plusieurs cold starts. Pour une protection robuste,
 * passer à Upstash Redis ou Vercel KV.
 *
 * Convient pour : bloquer les bots naïfs, freiner le scraping, limiter
 * les coûts (Claude API, Puppeteer).
 */
declare global {
  // eslint-disable-next-line no-var
  var __rateLimitBuckets: Map<string, number[]> | undefined;
}

const buckets: Map<string, number[]> =
  globalThis.__rateLimitBuckets ?? new Map<string, number[]>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__rateLimitBuckets = buckets;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // timestamp ms quand la fenêtre se vide
};

/**
 * Vérifie si la clé (typiquement `ip:routeName`) a encore du quota.
 * Mode "sliding window" : compte les requêtes des `windowMs` dernières ms.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    // Limite atteinte
    const oldest = timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetAt: now + windowMs,
  };
}

/**
 * Extrait l'IP client depuis les headers (Vercel-friendly).
 * Fallback "unknown" si rien — meilleur que de skip le rate limit.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
