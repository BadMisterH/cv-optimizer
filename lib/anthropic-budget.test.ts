import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAnthropicBudgetGate,
  resetAnthropicBudgetCacheForTests,
  sumCostReportMinorUnits,
} from "./anthropic-budget";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetAnthropicBudgetCacheForTests();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetAnthropicBudgetCacheForTests();
});

describe("sumCostReportMinorUnits", () => {
  it("additionne les coûts dans les formats connus du rapport Anthropic", () => {
    const payload = {
      data: [
        {
          bucket: "2026-07-01T00:00:00Z",
          results: [
            { amount: "125.5", description: "Usage - Sonnet" },
            { amount_cents: 50, description: "Usage - Opus" },
          ],
        },
      ],
      has_more: false,
      next_page: null,
    };

    expect(sumCostReportMinorUnits(payload)).toBe(175.5);
  });
});

describe("checkAnthropicBudgetGate", () => {
  it("laisse passer quand le contrôle budget n'est pas configuré", async () => {
    const gate = await checkAnthropicBudgetGate(new Date("2026-07-06T12:00:00Z"));

    expect(gate).toEqual({ allowed: true, configured: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloque quand la configuration est incomplète", async () => {
    vi.stubEnv("ANTHROPIC_MONTHLY_BUDGET_USD", "5");

    const gate = await checkAnthropicBudgetGate(new Date("2026-07-06T12:00:00Z"));

    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.reason).toBe("budget_check_failed");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloque quand le restant estimé tombe au seuil de réserve", async () => {
    vi.stubEnv("ANTHROPIC_ADMIN_KEY", "sk-ant-admin-test");
    vi.stubEnv("ANTHROPIC_MONTHLY_BUDGET_USD", "5");
    vi.stubEnv("ANTHROPIC_MIN_CREDIT_BALANCE_USD", "1");
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ amount: "400" }] }));

    const gate = await checkAnthropicBudgetGate(new Date("2026-07-06T12:00:00Z"));

    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.reason).toBe("budget_exhausted");
      expect(gate.remainingUsd).toBe(1);
    }
  });

  it("laisse passer quand le restant estimé est supérieur au seuil", async () => {
    vi.stubEnv("ANTHROPIC_ADMIN_KEY", "sk-ant-admin-test");
    vi.stubEnv("ANTHROPIC_MONTHLY_BUDGET_USD", "5");
    vi.stubEnv("ANTHROPIC_MIN_CREDIT_BALANCE_USD", "1");
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ amount: "350" }] }));

    const gate = await checkAnthropicBudgetGate(new Date("2026-07-06T12:00:00Z"));

    expect(gate.allowed).toBe(true);
    if (gate.allowed) {
      expect(gate.configured).toBe(true);
      expect(gate.remainingUsd).toBe(1.5);
    }
  });

  it("bloque par défaut si le rapport de coût échoue", async () => {
    vi.stubEnv("ANTHROPIC_ADMIN_KEY", "sk-ant-admin-test");
    vi.stubEnv("ANTHROPIC_MONTHLY_BUDGET_USD", "5");
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500));

    const gate = await checkAnthropicBudgetGate(new Date("2026-07-06T12:00:00Z"));

    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.reason).toBe("budget_check_failed");
    }
  });

  it("peut laisser passer sur échec de rapport si fail-open est activé", async () => {
    vi.stubEnv("ANTHROPIC_ADMIN_KEY", "sk-ant-admin-test");
    vi.stubEnv("ANTHROPIC_MONTHLY_BUDGET_USD", "5");
    vi.stubEnv("ANTHROPIC_BUDGET_FAIL_OPEN", "true");
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500));

    const gate = await checkAnthropicBudgetGate(new Date("2026-07-06T12:00:00Z"));

    expect(gate).toEqual({ allowed: true, configured: true });
  });
});
