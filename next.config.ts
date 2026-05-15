import type { NextConfig } from "next";

/**
 * En-têtes de sécurité HTTP appliqués à toutes les réponses.
 * https://owasp.org/www-project-secure-headers/
 */
const securityHeaders = [
  // Force HTTPS en prod (1 an, sous-domaines, preload-ready)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Empêche le MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Empêche d'être intégré dans des iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Référer minimaliste (uniquement l'origine, pas le path)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Désactive les API sensibles par défaut
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=(self)",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  // CSP : strict mais compatible avec Next.js + Stripe
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "connect-src 'self' https://api.stripe.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
