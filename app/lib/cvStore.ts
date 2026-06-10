"use client";

import type { OptimizedCV } from "../types";

const LEGACY_KEY = "cv-optimizer:last-cv";
const HISTORY_KEY = "cv-optimizer:cv-history";
const PHOTO_KEY = "cv-optimizer:last-photo";
const CV_GENERATE_COUNT_KEY = "cv-optimizer:cv-generate-count";
const LETTER_GENERATE_COUNT_KEY = "cv-optimizer:letter-generate-count";

const HISTORY_MAX = 5;

export type StoredCV = {
  id: string;
  cv: OptimizedCV;
  offer: string;
  savedAt: string;
};

// Generation counter (free tier)
export function getGenerationCount(type: "cv" | "letter"): number {
  if (typeof window === "undefined") return 0;
  try {
    const key = type === "cv" ? CV_GENERATE_COUNT_KEY : LETTER_GENERATE_COUNT_KEY;
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function incrementGenerationCount(type: "cv" | "letter"): number {
  if (typeof window === "undefined") return 0;
  try {
    const key = type === "cv" ? CV_GENERATE_COUNT_KEY : LETTER_GENERATE_COUNT_KEY;
    const current = getGenerationCount(type);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return 0;
  }
}

export function canGenerateWithoutAuth(type: "cv" | "letter"): boolean {
  return getGenerationCount(type) === 0;
}

export function saveLastCV(cv: OptimizedCV, offer: string): void {
  if (typeof window === "undefined") return;
  try {
    const entry: StoredCV = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      cv,
      offer,
      savedAt: new Date().toISOString(),
    };

    const history = readCVHistory();
    const updated = [entry, ...history].slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

    // Legacy key — conservé pour la compat page /lettre
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ cv, offer, savedAt: entry.savedAt }));
  } catch {
    // localStorage indisponible — silently ignore
  }
}

export function readCVHistory(): StoredCV[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredCV[];
  } catch {
    return [];
  }
}

export function readLastCV(): { cv: OptimizedCV; offer: string; savedAt: string } | null {
  if (typeof window === "undefined") return null;
  try {
    // Priorité : tête de l'historique, fallback legacy key
    const history = readCVHistory();
    if (history.length > 0) {
      const { cv, offer, savedAt } = history[0];
      return { cv, offer, savedAt };
    }
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { cv: OptimizedCV; offer: string; savedAt: string };
  } catch {
    return null;
  }
}

export function savePhoto(dataUrl: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (dataUrl) localStorage.setItem(PHOTO_KEY, dataUrl);
    else localStorage.removeItem(PHOTO_KEY);
  } catch {
    // ignore
  }
}

export function readPhoto(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PHOTO_KEY);
  } catch {
    return null;
  }
}

export function clearLastCV(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
