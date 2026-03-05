import { DEFAULT_VEHICLE_INFO } from "../constants";
import { createId } from "../helpers";

const VEHICLE_FIELDS = Object.keys(DEFAULT_VEHICLE_INFO);

function tryParseJson(text) {
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") {
      const reparsed = JSON.parse(parsed);
      return reparsed;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseFirstJsonObjectInText(text) {
  if (!text) {
    return null;
  }

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let end = start; end < text.length; end += 1) {
      const char = text[end];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, end + 1);
          const parsed = tryParseJson(candidate);
          if (parsed && typeof parsed === "object") {
            return parsed;
          }
          break;
        }
      }
    }
  }

  return null;
}

function parseAssistantPayload(rawText) {
  const direct = tryParseJson(rawText);
  if (direct) {
    return direct;
  }

  const fencedMatches = rawText.match(/```(?:json)?\s*([\s\S]*?)```/gi) || [];
  for (const fencedBlock of fencedMatches) {
    const candidate = fencedBlock.replace(/```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const parsed = tryParseJson(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    const candidate = rawText.slice(firstBrace, lastBrace + 1);
    const parsed = tryParseJson(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const inTextParsed = parseFirstJsonObjectInText(rawText);
  if (inTextParsed) {
    return inTextParsed;
  }

  return null;
}

function stripCitationNoise(text) {
  if (!text) {
    return "";
  }

  const withoutCiteTags = text.replace(/\s*\[cite:[^\]]*]/gi, "");
  const withoutJsonBlocks = withoutCiteTags
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*$/gi, "");
  const withoutSourceDump = withoutJsonBlocks.replace(
    /(?:\n|^)\s*Sources\s*(?:\n\d+\.\s[^\n]+)+\s*$/i,
    ""
  );
  return withoutSourceDump.replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeProposedUpdates(rawUpdates) {
  if (!rawUpdates || typeof rawUpdates !== "object" || Array.isArray(rawUpdates)) {
    return {};
  }

  const aliasToField = {
    year: "modelYear",
    model_year: "modelYear",
    modelyear: "modelYear",
    fuel: "fuelType",
    fuel_type: "fuelType",
    gearbox_type: "gearbox",
  };

  const candidates = [rawUpdates];
  if (
    rawUpdates.vehicle &&
    typeof rawUpdates.vehicle === "object" &&
    !Array.isArray(rawUpdates.vehicle)
  ) {
    candidates.push(rawUpdates.vehicle);
  }

  return candidates.reduce((acc, source) => {
    Object.entries(source).forEach(([rawKey, value]) => {
      if (value === null || value === undefined) {
        return;
      }
      const mappedKey = VEHICLE_FIELDS.includes(rawKey)
        ? rawKey
        : aliasToField[rawKey.toLowerCase()];
      if (!mappedKey || !VEHICLE_FIELDS.includes(mappedKey)) {
        return;
      }
      const normalized = String(value).trim();
      if (!normalized) {
        return;
      }
      acc[mappedKey] = normalized;
    });
    return acc;
  }, {});
}

export function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractGroundingMetadata(payload) {
  const candidate = payload?.candidates?.[0];
  return candidate?.groundingMetadata || candidate?.grounding_metadata || null;
}

export function extractGroundedSources(payload) {
  const groundingMetadata = extractGroundingMetadata(payload);
  const chunks = groundingMetadata?.groundingChunks || groundingMetadata?.grounding_chunks;
  if (!Array.isArray(chunks)) {
    return [];
  }

  const dedupe = new Set();
  return chunks
    .map((chunk) => {
      const web = chunk?.web;
      if (!web?.uri) {
        return null;
      }
      return {
        uri: String(web.uri),
        title: web.title ? String(web.title) : web.uri,
      };
    })
    .filter((source) => {
      if (!source) {
        return false;
      }
      if (dedupe.has(source.uri)) {
        return false;
      }
      dedupe.add(source.uri);
      return true;
    });
}

export function extractAssistantResponse(rawText) {
  const parsed = parseAssistantPayload(rawText);
  let assistantMessage = stripCitationNoise(rawText);
  let proposedUpdates = {};

  if (parsed && typeof parsed === "object") {
    if (typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim()) {
      assistantMessage = stripCitationNoise(parsed.assistantMessage.trim());
    }
    proposedUpdates = normalizeProposedUpdates(parsed.proposedVehicleUpdates);
  }

  if (!assistantMessage) {
    assistantMessage = "I have a response ready.";
  }

  return {
    assistantMessage,
    proposedUpdates,
  };
}

export function removeInlineUrls(text) {
  if (!text) {
    return "";
  }

  return text
    .replace(/\s*:\s*https?:\/\/\S+/gi, "")
    .replace(/\s*-\s*https?:\/\/\S+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s*:\s*(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/gi, "")
    .replace(/\s*-\s*(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/gi, "")
    .replace(/(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/gi, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/:\s*$/gm, "")
    .replace(/^\s*[*-]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toPlainTextWithoutLinkWords(text) {
  if (!text) {
    return "";
  }

  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\blinks?\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildUpdateRows(currentVehicle, proposedUpdates) {
  return Object.entries(proposedUpdates).map(([field, newValue]) => ({
    field,
    previousValue: currentVehicle[field] ? String(currentVehicle[field]) : "-",
    newValue: String(newValue),
  }));
}

export function formatFieldLabel(field) {
  const labels = {
    vin: "VIN",
    brand: "Brand",
    model: "Model",
    engine: "Engine",
    fuelType: "Fuel Type",
    gearbox: "Gearbox",
    modelYear: "Model Year",
    drive: "Drive",
    steering: "Steering",
    region: "Region",
    exteriorColor: "Exterior Color",
    interiorColor: "Interior Color",
    horsepower: "Horsepower",
  };
  return labels[field] || field;
}

export function createGreetingMessage(vehicleModel) {
  return {
    id: createId("ai"),
    role: "ai",
    text: `Hello! I'm your assistant for your ${vehicleModel}. How can I help you today?`,
  };
}

export function sanitizeChatLog(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item) => item && (item.role === "ai" || item.role === "user"))
    .map((item) => ({
      id: item.id || createId(item.role),
      role: item.role,
      text: typeof item.text === "string" ? item.text : "",
      sources: Array.isArray(item.sources)
        ? item.sources
            .map((source) => {
              if (!source || typeof source !== "object") {
                return null;
              }
              if (!source.uri || typeof source.uri !== "string") {
                return null;
              }
              return {
                uri: source.uri,
                title:
                  typeof source.title === "string" && source.title.trim()
                    ? source.title
                    : source.uri,
              };
            })
            .filter(Boolean)
        : [],
    }));
}
