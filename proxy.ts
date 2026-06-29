import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Proxy Next.js 16 (anciennement Middleware) — appliqué AVANT toute route
 * /api/* matchée. Rate-limite par IP les endpoints coûteux/sensibles.
 * Les webhooks Stripe sont exclus (Stripe doit pouvoir retry).
 */

type LimitConfig = { limit: number; windowMs: number };

const RATE_LIMITS: Array<{ test: (path: string) => boolean; config: LimitConfig }> = [
  // Génération IA (coûteux : Claude API)
  {
    test: (p) => p === "/api/optimize" || p === "/api/cover-letter",
    config: { limit: 5, windowMs: 60_000 }, // 5 reqs / minute
  },
  // PDF (Puppeteer, lourd)
  {
    test: (p) => p === "/api/pdf" || p === "/api/letter-pdf",
    config: { limit: 10, windowMs: 60_000 }, // 10 reqs / minute
  },
  // Auth (anti brute-force signup/signin)
  {
    test: (p) => p.startsWith("/api/auth/sign-"),
    config: { limit: 10, windowMs: 60_000 },
  },
  // Reset password (anti spam)
  {
    test: (p) => p.startsWith("/api/auth/forget-password") || p.startsWith("/api/auth/request-password-reset"),
    config: { limit: 3, windowMs: 60_000 },
  },
  // Checkout Stripe (anti spam de créations de sessions)
  {
    test: (p) => p === "/api/checkout" || p === "/api/checkout/sync",
    config: { limit: 10, windowMs: 60_000 },
  },
  // Account delete — anti accidental + anti brute-force
  {
    test: (p) => p === "/api/account/delete",
    config: { limit: 3, windowMs: 60_000 },
  },
];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Stripe webhook : pas de rate limit (Stripe doit pouvoir retry)
  if (path === "/api/webhooks/stripe") {
    return NextResponse.next();
  }

  // Recherche la première config qui matche
  const match = RATE_LIMITS.find((r) => r.test(path));
  if (!match) return NextResponse.next();

  const ip = getClientIp(req);
  const result = checkRateLimit(`${ip}:${path}`, match.config.limit, match.config.windowMs);

  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return new NextResponse(
      JSON.stringify({
        error: "Trop de requêtes. Réessaie dans quelques instants.",
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(match.config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  // Headers informatifs sur la limite
  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(match.config.limit));
  res.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return res;
}

export const config = {
  // S'applique uniquement aux routes /api/*
  matcher: ["/api/:path*"],
};
