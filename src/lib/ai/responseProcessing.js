import { DEFAULT_VEHICLE_INFO } from "../constants";
import { createId } from "../helpers";
import { aiDebugLog } from "./debug";

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
    gen: "generation",
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

function extractGroundingChunks(payload) {
  const groundingMetadata = extractGroundingMetadata(payload);
  const chunks = groundingMetadata?.groundingChunks || groundingMetadata?.grounding_chunks;
  return Array.isArray(chunks) ? chunks : [];
}

export function extractGroundedSources(payload) {
  const dedupe = new Set();
  const sources = extractGroundingChunks(payload)
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
  aiDebugLog("response_processing", "extracted_sources", {
    count: sources.length,
  });
  return sources;
}

function parseYouTubeVideoId(uri) {
  try {
    const parsed = new URL(uri);
    const host = parsed.hostname.toLowerCase();
    const pathSegments = parsed.pathname.split("/").filter(Boolean);

    if (host === "youtu.be" && pathSegments[0]) {
      return pathSegments[0];
    }

    if (host.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (
        (pathSegments[0] === "shorts" || pathSegments[0] === "live") &&
        pathSegments[1]
      ) {
        return pathSegments[1];
      }
    }
  } catch {
    return "";
  }

  return "";
}

function extractYouTubeIdsFromText(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const matches = [];
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?[^ \n]*v=([A-Za-z0-9_-]{6,})/gi,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{6,})/gi,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/gi,
  ];

  patterns.forEach((pattern) => {
    let match = pattern.exec(text);
    while (match) {
      if (match[1]) {
        matches.push(match[1]);
      }
      match = pattern.exec(text);
    }
  });

  return matches;
}

function isGroundingRedirectUrl(uri) {
  try {
    const parsed = new URL(uri);
    return (
      parsed.hostname.toLowerCase() === "vertexaisearch.cloud.google.com" &&
      parsed.pathname.includes("/grounding-api-redirect/")
    );
  } catch {
    return false;
  }
}

export function extractGroundedVideos(payload, rawText = "") {
  const dedupe = new Set();
  const videosFromChunks = extractGroundingChunks(payload)
    .map((chunk) => {
      const web = chunk?.web;
      const uri = web?.uri ? String(web.uri) : "";
      if (!uri) {
        return null;
      }

      const videoId = parseYouTubeVideoId(uri);
      if (!videoId && !isGroundingRedirectUrl(uri)) {
        return null;
      }

      const canonicalUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : uri;

      return {
        videoId: videoId || "",
        url: canonicalUrl,
        sourceUrl: uri,
        title: web?.title ? String(web.title) : "YouTube Video",
        thumbnailUrl: videoId
          ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          : "",
      };
    })
    .filter((video) => {
      if (!video) {
        return false;
      }
      const dedupeKey = video.videoId || video.sourceUrl;
      if (dedupe.has(dedupeKey)) {
        return false;
      }
      dedupe.add(dedupeKey);
      return true;
    });

  const videosFromText = extractYouTubeIdsFromText(rawText)
    .map((videoId) => ({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title: "YouTube Video",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    }))
    .filter((video) => {
      if (!video?.videoId) {
        return false;
      }
      if (dedupe.has(video.videoId)) {
        return false;
      }
      dedupe.add(video.videoId);
      return true;
    });

  const videos = [...videosFromChunks, ...videosFromText];
  aiDebugLog("response_processing", "extracted_videos", {
    chunkVideos: videosFromChunks.length,
    textVideos: videosFromText.length,
    total: videos.length,
  });
  return videos;
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

  const result = {
    assistantMessage,
    proposedUpdates,
  };
  aiDebugLog("response_processing", "assistant_response_parsed", {
    assistantMessageLength: assistantMessage.length,
    proposedUpdateFields: Object.keys(proposedUpdates),
  });
  return result;
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
    generation: "Generation",
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
      videos: Array.isArray(item.videos)
        ? item.videos
            .map((video) => {
              if (!video || typeof video !== "object") {
                return null;
              }
              const videoId =
                typeof video.videoId === "string" ? video.videoId.trim() : "";
              const sourceUrl =
                typeof video.sourceUrl === "string" && video.sourceUrl.trim()
                  ? video.sourceUrl
                  : "";
              const url =
                typeof video.url === "string" && video.url.trim()
                  ? video.url
                  : sourceUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
              if (!url) {
                return null;
              }
              const title =
                typeof video.title === "string" && video.title.trim()
                  ? video.title
                  : "YouTube Video";
              const thumbnailUrl =
                typeof video.thumbnailUrl === "string" && video.thumbnailUrl.trim()
                  ? video.thumbnailUrl
                  : videoId
                    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                    : "";
              const thumbnailSrc =
                typeof video.thumbnailSrc === "string" && video.thumbnailSrc.trim()
                  ? video.thumbnailSrc
                  : thumbnailUrl;
              const loading = Boolean(video.loading);

              return {
                videoId,
                url,
                sourceUrl: sourceUrl || url,
                title,
                thumbnailUrl,
                thumbnailSrc,
                loading,
              };
            })
            .filter(Boolean)
        : [],
    }));
}
