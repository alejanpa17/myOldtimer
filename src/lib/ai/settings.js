import { dbGet, dbSet } from "../db";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_TEMPERATURE,
} from "./constants";

const LOCAL_FALLBACK_PREFIX = "myoldtimer-fallback";

export function normalizeModel(rawModel) {
  return AI_MODELS.some((model) => model.id === rawModel) ? rawModel : DEFAULT_AI_MODEL;
}

export function normalizeTemperature(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TEMPERATURE;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 2) {
    return 2;
  }
  return parsed;
}

export function normalizeMaxOutputTokens(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_OUTPUT_TOKENS;
  }
  const rounded = Math.round(parsed);
  if (rounded < 1) {
    return 1;
  }
  return rounded;
}

export function normalizeDebugFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }
  return false;
}

function fallbackKey(storageKey) {
  return `${LOCAL_FALLBACK_PREFIX}:${storageKey}`;
}

function readFallbackValue(storageKey, fallbackValue) {
  try {
    const raw = localStorage.getItem(fallbackKey(storageKey));
    if (!raw) {
      return fallbackValue;
    }
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

function writeFallbackValue(storageKey, value) {
  try {
    localStorage.setItem(fallbackKey(storageKey), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function loadValueWithFallback(storageKey, fallbackValue) {
  try {
    const value = await dbGet(storageKey, fallbackValue);
    writeFallbackValue(storageKey, value);
    return value;
  } catch {
    return readFallbackValue(storageKey, fallbackValue);
  }
}

export async function saveValueWithFallback(storageKey, value) {
  try {
    await dbSet(storageKey, value);
    writeFallbackValue(storageKey, value);
    return true;
  } catch {
    return writeFallbackValue(storageKey, value);
  }
}
