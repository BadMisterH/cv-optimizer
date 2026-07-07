import { describe, expect, it } from "vitest";
import {
  getPackBonusCredits,
  getPackTotalCredits,
  isLaunchOfferActive,
} from "./stripe-packs";

describe("offre de lancement crédits", () => {
  it("ajoute le bonus pendant la période de lancement", () => {
    const duringLaunch = new Date("2026-07-15T12:00:00+02:00");

    expect(isLaunchOfferActive(duringLaunch)).toBe(true);
    expect(getPackBonusCredits("starter", duringLaunch)).toBe(2);
    expect(getPackTotalCredits("starter", duringLaunch)).toBe(7);
    expect(getPackTotalCredits("pro", duringLaunch)).toBe(21);
    expect(getPackTotalCredits("premium", duringLaunch)).toBe(70);
  });

  it("revient aux crédits standards après la fin de l'offre", () => {
    const afterLaunch = new Date("2026-08-01T00:00:00+02:00");

    expect(isLaunchOfferActive(afterLaunch)).toBe(false);
    expect(getPackBonusCredits("pro", afterLaunch)).toBe(0);
    expect(getPackTotalCredits("pro", afterLaunch)).toBe(15);
  });
});
