import { sendOpsAlert } from "./alerting";

const ANTHROPIC_COST_REPORT_URL = "https://api.anthropic.com/v1/organizations/cost_report";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MIN_REMAINING_USD = 1;
const DEFAULT_CACHE_MS = 60_000;
const MAX_PAGES = 10;

export type AnthropicBudgetGateResult =
  | {
      allowed: true;
      configured: boolean;
      budgetUsd?: number;
      spentUsd?: number;
      remainingUsd?: number;
    }
  | {
      allowed: false;
      configured: true;
      reason: "budget_exhausted" | "budget_check_failed";
      message: string;
      budgetUsd?: number;
      spentUsd?: number;
      remainingUsd?: number;
    };

type AnthropicCostReport = {
  spentUsd: number;
};

type BudgetConfig = {
  adminKey: string | null;
  monthlyBudgetUsd: number | null;
  minRemainingUsd: number;
  cacheMs: number;
  failOpen: boolean;
  startAt: string | null;
};

let cachedReport:
  | {
      cacheKey: string;
      expiresAt: number;
      promise: Promise<AnthropicCostReport>;
    }
  | null = null;

function parseUsd(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getBudgetConfig(env: NodeJS.ProcessEnv = process.env): BudgetConfig {
  return {
    adminKey: env.ANTHROPIC_ADMIN_KEY?.trim() || null,
    monthlyBudgetUsd: parseUsd(env.ANTHROPIC_MONTHLY_BUDGET_USD),
    minRemainingUsd: parseUsd(env.ANTHROPIC_MIN_CREDIT_BALANCE_USD) ?? DEFAULT_MIN_REMAINING_USD,
    cacheMs: parsePositiveInteger(env.ANTHROPIC_BUDGET_CACHE_MS, DEFAULT_CACHE_MS),
    failOpen: env.ANTHROPIC_BUDGET_FAIL_OPEN === "true",
    startAt: env.ANTHROPIC_BUDGET_STARTING_AT?.trim() || null,
  };
}

function isBudgetGuardConfigured(config: BudgetConfig): boolean {
  return Boolean(config.adminKey || config.monthlyBudgetUsd !== null);
}

function startOfCurrentMonthUtc(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function tomorrowUtc(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  ).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMinorUnits(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The official cost API reports money in minor units (cents for USD), but its
 * generated schema has changed shape over time. Sum only leaf monetary fields so
 * buckets/results both work without depending on one exact response envelope.
 */
export function sumCostReportMinorUnits(payload: unknown): number {
  if (Array.isArray(payload)) {
    return payload.reduce((sum, item) => sum + sumCostReportMinorUnits(item), 0);
  }

  if (!isRecord(payload)) return 0;

  if ("amount_cents" in payload) return parseMinorUnits(payload.amount_cents);
  if ("amount" in payload) return parseMinorUnits(payload.amount);

  return Object.entries(payload).reduce((sum, [key, value]) => {
    if (key === "next_page" || key === "has_more") return sum;
    return sum + sumCostReportMinorUnits(value);
  }, 0);
}

async function fetchCostReportPage(
  adminKey: string,
  startAt: string,
  endAt: string,
  page?: string
): Promise<unknown> {
  const url = new URL(ANTHROPIC_COST_REPORT_URL);
  url.searchParams.set("starting_at", startAt);
  url.searchParams.set("ending_at", endAt);
  url.searchParams.set("limit", "31");
  if (page) url.searchParams.set("page", page);

  const response = await fetch(url, {
    headers: {
      "anthropic-version": ANTHROPIC_VERSION,
      "x-api-key": adminKey,
      "user-agent": "cv-optimizer/0.1.0 budget-guard",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic cost report failed (${response.status}): ${body.slice(0, 300)}`);
  }

  return response.json();
}

async function fetchAnthropicCostReport(
  config: BudgetConfig,
  now: Date
): Promise<AnthropicCostReport> {
  if (!config.adminKey) {
    throw new Error("ANTHROPIC_ADMIN_KEY manquant pour le contrôle budget Anthropic.");
  }

  const startAt = config.startAt ?? startOfCurrentMonthUtc(now);
  const endAt = tomorrowUtc(now);
  const cacheKey = `${config.adminKey.slice(-8)}:${startAt}:${endAt}`;
  const nowMs = now.getTime();

  if (cachedReport && cachedReport.cacheKey === cacheKey && cachedReport.expiresAt > nowMs) {
    return cachedReport.promise;
  }

  const promise = (async () => {
    let page: string | undefined;
    let spentMinorUnits = 0;

    for (let i = 0; i < MAX_PAGES; i += 1) {
      const payload = await fetchCostReportPage(config.adminKey!, startAt, endAt, page);
      spentMinorUnits += sumCostReportMinorUnits(payload);

      if (!isRecord(payload)) break;
      const nextPage = typeof payload.next_page === "string" ? payload.next_page : null;
      const hasMore = payload.has_more === true || Boolean(nextPage);
      if (!hasMore || !nextPage) break;
      page = nextPage;
    }

    return { spentUsd: spentMinorUnits / 100 };
  })();

  cachedReport = {
    cacheKey,
    expiresAt: nowMs + config.cacheMs,
    promise,
  };

  try {
    return await promise;
  } catch (err) {
    if (cachedReport?.promise === promise) cachedReport = null;
    throw err;
  }
}

export async function checkAnthropicBudgetGate(
  now: Date = new Date()
): Promise<AnthropicBudgetGateResult> {
  const config = getBudgetConfig();
  const configured = isBudgetGuardConfigured(config);

  if (!configured) return { allowed: true, configured: false };

  if (!config.adminKey || config.monthlyBudgetUsd === null) {
    return {
      allowed: false,
      configured: true,
      reason: "budget_check_failed",
      message:
        "Contrôle budget Anthropic incomplet : configure ANTHROPIC_ADMIN_KEY et ANTHROPIC_MONTHLY_BUDGET_USD.",
      budgetUsd: config.monthlyBudgetUsd ?? undefined,
    };
  }

  try {
    const { spentUsd } = await fetchAnthropicCostReport(config, now);
    const remainingUsd = Math.max(0, config.monthlyBudgetUsd - spentUsd);

    if (remainingUsd <= config.minRemainingUsd) {
      return {
        allowed: false,
        configured: true,
        reason: "budget_exhausted",
        message:
          "La génération est temporairement suspendue : le budget Anthropic restant est au seuil de réserve.",
        budgetUsd: config.monthlyBudgetUsd,
        spentUsd,
        remainingUsd,
      };
    }

    return {
      allowed: true,
      configured: true,
      budgetUsd: config.monthlyBudgetUsd,
      spentUsd,
      remainingUsd,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Contrôle budget Anthropic impossible.";
    console.error("[anthropic-budget] échec contrôle budget:", err);

    if (config.failOpen) {
      return { allowed: true, configured: true };
    }

    return {
      allowed: false,
      configured: true,
      reason: "budget_check_failed",
      message,
      budgetUsd: config.monthlyBudgetUsd,
    };
  }
}

export async function alertAnthropicBudgetBlocked(
  gate: Extract<AnthropicBudgetGateResult, { allowed: false }>,
  route: string
): Promise<void> {
  await sendOpsAlert(
    "anthropic_budget_guard",
    "CV Optimizer - budget Anthropic bas",
    `Une génération a été bloquée sur <b>${escapeHtml(route)}</b>.<br><br>` +
      `<b>Raison :</b> ${gate.reason}<br>` +
      `<b>Message :</b> ${escapeHtml(gate.message)}<br>` +
      `<b>Budget :</b> ${gate.budgetUsd ?? "n/a"} USD<br>` +
      `<b>Dépensé :</b> ${gate.spentUsd ?? "n/a"} USD<br>` +
      `<b>Restant estimé :</b> ${gate.remainingUsd ?? "n/a"} USD<br><br>` +
      "Recharge le compte Anthropic ou augmente ANTHROPIC_MONTHLY_BUDGET_USD pour relancer le service."
  );
}

export function resetAnthropicBudgetCacheForTests(): void {
  cachedReport = null;
}
