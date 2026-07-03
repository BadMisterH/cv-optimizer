import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, getClientIp } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("autorise les requêtes jusqu'à la limite", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("rl-test-basic", 5, 60_000).allowed).toBe(true);
    }
  });

  it("bloque la requête qui dépasse la limite", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("rl-test-block", 5, 60_000);

    const result = checkRateLimit("rl-test-block", 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("réautorise une fois la fenêtre expirée", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("rl-test-window", 5, 60_000);
    expect(checkRateLimit("rl-test-window", 5, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(checkRateLimit("rl-test-window", 5, 60_000).allowed).toBe(true);
  });

  it("compte deux clés différentes indépendamment (ex: deux IP distinctes)", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("rl-test-key-a", 5, 60_000);

    expect(checkRateLimit("rl-test-key-a", 5, 60_000).allowed).toBe(false);
    expect(checkRateLimit("rl-test-key-b", 5, 60_000).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("extrait la première IP de x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });

    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("retombe sur x-real-ip si x-forwarded-for est absent", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "203.0.113.9" },
    });

    expect(getClientIp(req)).toBe("203.0.113.9");
  });

  it('retombe sur "unknown" si aucun header n\'est présent', () => {
    const req = new Request("http://localhost");

    expect(getClientIp(req)).toBe("unknown");
  });
});
