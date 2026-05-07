"use client";

import type { OptimizedCV } from "../types";

const KEY = "cv-optimizer:last-cv";
const PHOTO_KEY = "cv-optimizer:last-photo";

type Stored = {
  cv: OptimizedCV;
  offer: string;
  savedAt: string;
};

export function saveLastCV(cv: OptimizedCV, offer: string): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Stored = { cv, offer, savedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponible — silently ignore
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

export function readLastCV(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

export function clearLastCV(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
