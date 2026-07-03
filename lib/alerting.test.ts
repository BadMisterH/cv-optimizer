import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}));

vi.mock("./email", () => ({
  sendEmail,
  buildEmailHtml: (opts: { title: string; intro: string }) => `<html>${opts.title}::${opts.intro}</html>`,
}));

vi.mock("./admin", () => ({
  ADMIN_EMAILS: new Set(["admin@example.com"]),
}));

import { alertAnthropicApiError, sendOpsAlert } from "./alerting";

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(undefined);
});

describe("sendOpsAlert", () => {
  it("envoie un email à chaque adresse admin", async () => {
    await sendOpsAlert("test_key_a", "Sujet", "Détails");

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin@example.com", subject: "Sujet" })
    );
  });

  it("throttle : un 2e appel immédiat avec la même clé n'envoie rien", async () => {
    await sendOpsAlert("test_key_b", "Sujet", "Détails");
    sendEmail.mockClear();

    await sendOpsAlert("test_key_b", "Sujet", "Détails");

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("deux clés différentes ne se throttlent pas l'une l'autre", async () => {
    await sendOpsAlert("test_key_c1", "Sujet", "Détails");
    sendEmail.mockClear();

    await sendOpsAlert("test_key_c2", "Sujet", "Détails");

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("un échec d'envoi pour un admin ne fait pas planter l'appelant", async () => {
    sendEmail.mockRejectedValueOnce(new Error("resend down"));

    await expect(sendOpsAlert("test_key_d", "Sujet", "Détails")).resolves.not.toThrow();
  });
});

describe("alertAnthropicApiError", () => {
  it("envoie une alerte au premier échec puis throttle les suivants (clé partagée)", async () => {
    await alertAnthropicApiError(400, "Your credit balance is too low", "/api/optimize");

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.subject).toContain("400");
    expect(call.html).toContain("/api/optimize");
    expect(call.html).toContain("Your credit balance is too low");

    sendEmail.mockClear();
    await alertAnthropicApiError(429, "Rate limited", "/api/cover-letter");

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
