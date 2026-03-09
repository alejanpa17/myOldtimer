import { STORAGE_KEYS } from "../constants";

const MAX_DEPTH = 3;
const MAX_ARRAY_ITEMS = 8;
const MAX_OBJECT_KEYS = 20;
const MAX_STRING_LENGTH = 220;
const MAX_LOG_CHARS = 4000;

function readLocalStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseDebugFlag(value) {
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

export function isAiDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const queryEnabled = new URLSearchParams(window.location.search).get("aiDebug");
  if (parseDebugFlag(queryEnabled)) {
    return true;
  }

  const directValue = readLocalStorageValue(STORAGE_KEYS.aiDebug);
  if (parseDebugFlag(directValue)) {
    return true;
  }

  const fallbackValue = readLocalStorageValue(`myoldtimer-fallback:${STORAGE_KEYS.aiDebug}`);
  return parseDebugFlag(fallbackValue);
}

export function setAiDebugEnabled(enabled) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.aiDebug, enabled ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}

function shortenString(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}...(${value.length} chars)`;
}

function compactForLog(value, depth = 0, seen = new WeakSet()) {
  if (
    value === null ||
    typeof value === "undefined" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return shortenString(value);
  }

  if (typeof value === "function") {
    return "[function]";
  }

  if (depth >= MAX_DEPTH) {
    if (Array.isArray(value)) {
      return `[array:${value.length}]`;
    }
    return "[object]";
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      preview: value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => compactForLog(item, depth + 1, seen)),
      truncated: value.length > MAX_ARRAY_ITEMS,
    };
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);

    const keys = Object.keys(value);
    const limitedKeys = keys.slice(0, MAX_OBJECT_KEYS);
    const out = {};
    limitedKeys.forEach((key) => {
      out[key] = compactForLog(value[key], depth + 1, seen);
    });
    if (keys.length > MAX_OBJECT_KEYS) {
      out.__truncatedKeys = keys.length - MAX_OBJECT_KEYS;
    }
    return out;
  }

  return String(value);
}

function toLogString(data) {
  try {
    const compact = compactForLog(data);
    const json = JSON.stringify(compact);
    if (json.length <= MAX_LOG_CHARS) {
      return json;
    }
    return `${json.slice(0, MAX_LOG_CHARS)}...(truncated)`;
  } catch {
    return "[unserializable debug payload]";
  }
}

export function aiDebugLog(scope, event, data) {
  if (!isAiDebugEnabled()) {
    return;
  }
  if (typeof data === "undefined") {
    console.debug(`[AI][${scope}] ${event}`);
    return;
  }
  console.debug(`[AI][${scope}] ${event} ${toLogString(data)}`);
}

export function aiDebugError(scope, event, error, data) {
  if (!isAiDebugEnabled()) {
    return;
  }
  if (typeof data === "undefined") {
    console.error(`[AI][${scope}] ${event}`, error);
    return;
  }
  console.error(`[AI][${scope}] ${event}`, error, toLogString(data));
}
