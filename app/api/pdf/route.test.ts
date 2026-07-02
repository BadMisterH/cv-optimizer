import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OptimizedCV } from "@/app/types";

const { renderCVToBuffer, countPdfPages } = vi.hoisted(() => ({
  renderCVToBuffer: vi.fn(),
  countPdfPages: vi.fn(),
}));

vi.mock("@/lib/cv-pdf", () => ({
  renderCVToBuffer,
}));

vi.mock("@/lib/pdf-utils", () => ({
  countPdfPages,
}));

import { POST } from "./route";

const VALID_CV: OptimizedCV = {
  fullName: "Jean Dupont",
  title: "Développeur",
  accroche: "",
  contact: {
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
  },
  sections: [],
};

function makeRequest(cv: unknown): Request {
  return new Request("http://localhost/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cv }),
  });
}

beforeEach(() => {
  renderCVToBuffer.mockReset();
  countPdfPages.mockReset();
  renderCVToBuffer.mockResolvedValue(Buffer.from("fake-pdf"));
});

describe("POST /api/pdf — seuil de pages", () => {
  it("expédie normalement un PDF qui tient sur 1 page", async () => {
    countPdfPages.mockReturnValue(1);

    const res = await POST(makeRequest(VALID_CV));

    expect(res.status).toBe(200);
  });

  it("expédie un PDF qui tient sur 2 pages après densité max (nouveau fallback)", async () => {
    countPdfPages.mockReturnValue(2);

    const res = await POST(makeRequest(VALID_CV));

    expect(res.status).toBe(200);
  });

  it("bloque avec une erreur claire un PDF qui reste à 3 pages ou plus", async () => {
    countPdfPages.mockReturnValue(3);

    const res = await POST(makeRequest(VALID_CV));

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toMatch(/trop long/i);
  });
});
