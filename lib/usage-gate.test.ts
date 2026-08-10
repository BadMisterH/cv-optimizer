import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("./db", () => ({ pool: { query } }));
vi.mock("./auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("./admin", () => ({ isAdminEmail: () => false }));
vi.mock("./auth-verification", () => ({ isEmailVerified: () => true }));

import { refundCredit, reserveCredit } from "./usage-gate";

beforeEach(() => {
  query.mockReset();
});

/**
 * Simule le débit conditionnel de Postgres : `UPDATE ... WHERE credits > 0`
 * ne touche la ligne que si le solde est encore strictement positif, et le
 * fait de façon atomique — c'est exactement la garantie sur laquelle repose
 * la réservation de crédit.
 */
function fakeDatabase(initialCredits: number) {
  let credits = initialCredits;
  query.mockImplementation(async (sql: string) => {
    if (sql.includes("credits - 1")) {
      if (credits <= 0) return { rowCount: 0, rows: [] };
      credits -= 1;
      return { rowCount: 1, rows: [{ credits }] };
    }
    if (sql.includes("credits + 1")) {
      credits += 1;
      return { rowCount: 1, rows: [{ credits }] };
    }
    return { rowCount: 0, rows: [] };
  });
  return { balance: () => credits };
}

describe("reserveCredit", () => {
  it("débite et renvoie le solde restant", async () => {
    const db = fakeDatabase(3);

    await expect(reserveCredit("u1")).resolves.toBe(2);
    expect(db.balance()).toBe(2);
  });

  it("refuse quand le solde est à zéro", async () => {
    const db = fakeDatabase(0);

    await expect(reserveCredit("u1")).resolves.toBeNull();
    expect(db.balance()).toBe(0);
  });

  it("n'accorde qu'une seule génération à 5 requêtes concurrentes sur 1 crédit", async () => {
    // Le bug d'origine : le gate lisait le solde, la génération durait ~30 s,
    // le débit venait après — cinq requêtes simultanées généraient cinq CV et
    // n'en facturaient qu'un. Ici la réservation précède la génération.
    const db = fakeDatabase(1);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => reserveCredit("u1"))
    );

    const granted = results.filter((r) => r !== null);
    expect(granted).toHaveLength(1);
    expect(db.balance()).toBe(0);
  });

  it("ne descend jamais sous zéro, même sous concurrence", async () => {
    const db = fakeDatabase(2);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => reserveCredit("u1"))
    );

    expect(results.filter((r) => r !== null)).toHaveLength(2);
    expect(db.balance()).toBe(0);
  });
});

describe("refundCredit", () => {
  it("rend le crédit après un échec de génération", async () => {
    const db = fakeDatabase(1);

    await reserveCredit("u1");
    expect(db.balance()).toBe(0);

    await refundCredit("u1");
    expect(db.balance()).toBe(1);
  });

  it("ne lève pas si la base est injoignable — l'erreur d'origine doit remonter", async () => {
    query.mockRejectedValue(new Error("connection terminated"));

    await expect(refundCredit("u1")).resolves.toBeUndefined();
  });
});
