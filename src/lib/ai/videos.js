import { aiDebugError, aiDebugLog } from "./debug";

const REDIRECT_RESOLVER_PREFIX = "https://r.jina.ai/http://";
const REDIRECT_RESOLVE_TIMEOUT_MS = 12000;
const YOUTUBE_OEMBED_BASE = "https://www.youtube.com/oembed";
const JINA_BLOCK_FALLBACK_MS = 30 * 60 * 1000;

const redirectResolutionInFlight = new Map();
let jinaBlockedUntilMs = 0;

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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

function decodeUntilStable(input, maxSteps = 6) {
  let current = String(input || "");
  for (let step = 0; step < maxSteps; step += 1) {
    try {
      const next = decodeURIComponent(current);
      if (!next || next === current) {
        break;
      }
      current = next;
    } catch {
      break;
    }
  }
  return current;
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

function isLikelyYouTubeVideoSource(sourceUrl, title) {
  if (!sourceUrl) {
    return false;
  }
  const directVideoId = parseYouTubeVideoId(sourceUrl);
  if (directVideoId) {
    return true;
  }
  if (!isGroundingRedirectUrl(sourceUrl)) {
    return false;
  }
  const normalizedTitle = String(title || "").toLowerCase();
  return normalizedTitle.includes("youtube") || normalizedTitle.includes("youtu.be");
}

function extractVideoIdFromText(text) {
  if (!text) {
    return "";
  }

  const signInMatches =
    text.match(/https?:\/\/accounts\.google\.com\/ServiceLogin[^\s)"']+/gi) || [];
  for (const rawSignInUrl of signInMatches) {
    try {
      const signInUrl = new URL(rawSignInUrl.replace(/&amp;/g, "&"));
      const continueParam = signInUrl.searchParams.get("continue") || "";
      if (!continueParam) {
        continue;
      }

      const decodedContinue = decodeUntilStable(continueParam);
      const continueUrl = new URL(decodedContinue);
      const nextParam = continueUrl.searchParams.get("next") || "";
      if (!nextParam) {
        continue;
      }

      const decodedNext = decodeUntilStable(nextParam);
      const nextUrl = new URL(decodedNext);
      const signInId = parseYouTubeVideoId(nextUrl.toString());
      if (/^[A-Za-z0-9_-]{11}$/.test(signInId || "")) {
        aiDebugLog("videos", "video_id_from_signin_pattern", { signInId });
        return signInId;
      }
    } catch {
      // ignore malformed candidates
    }
  }

  const variants = [text];
  let decoded = text;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (!next || next === decoded) {
        break;
      }
      decoded = next;
      variants.push(next);
    } catch {
      break;
    }
  }

  const candidateIds = [];

  const addId = (rawId) => {
    const normalized = String(rawId || "").trim();
    if (!normalized) {
      return;
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(normalized)) {
      return;
    }
    candidateIds.push(normalized);
  };

  for (const variant of variants) {
    const watchUrlRegex = /https?:\/\/(?:www\.)?youtube\.com\/watch\?[^\s)"']+/gi;
    let watchMatch = watchUrlRegex.exec(variant);
    while (watchMatch) {
      try {
        const parsed = new URL(watchMatch[0].replace(/&amp;/g, "&"));
        addId(parsed.searchParams.get("v"));
      } catch {
        // ignore malformed matches
      }
      watchMatch = watchUrlRegex.exec(variant);
    }

    const shortRegex = /https?:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{6,})/gi;
    let shortMatch = shortRegex.exec(variant);
    while (shortMatch) {
      addId(shortMatch[1]);
      shortMatch = shortRegex.exec(variant);
    }

    const shortsRegex = /https?:\/\/(?:www\.)?youtube\.com\/(?:shorts|live)\/([A-Za-z0-9_-]{6,})/gi;
    let shortsMatch = shortsRegex.exec(variant);
    while (shortsMatch) {
      addId(shortsMatch[1]);
      shortsMatch = shortsRegex.exec(variant);
    }

    const jsonVideoIdRegex = /"videoId"\s*:\s*"([A-Za-z0-9_-]{6,})"/gi;
    let jsonMatch = jsonVideoIdRegex.exec(variant);
    while (jsonMatch) {
      addId(jsonMatch[1]);
      jsonMatch = jsonVideoIdRegex.exec(variant);
    }
  }

  if (candidateIds.length === 0) {
    return "";
  }

  const frequency = candidateIds.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  const orderedUnique = [...new Set(candidateIds)];
  orderedUnique.sort((left, right) => frequency[right] - frequency[left]);
  return orderedUnique[0] || "";
}

function extractJinaBlockUntilMs(text) {
  if (!text) {
    return 0;
  }
  const match = text.match(/blocked until\s+([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{2}\s+\d{4}\s+[0-9:]+\s+GMT[+-][0-9]{4})/i);
  if (!match?.[1]) {
    return 0;
  }
  const parsed = Date.parse(match[1]);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function shouldSkipJinaNow() {
  return Date.now() < jinaBlockedUntilMs;
}

function markJinaBlockedUntil(timestampMs) {
  const fallbackTimestamp = Date.now() + JINA_BLOCK_FALLBACK_MS;
  const next = Number.isFinite(timestampMs) && timestampMs > Date.now() ? timestampMs : fallbackTimestamp;
  jinaBlockedUntilMs = Math.max(jinaBlockedUntilMs, next);
  aiDebugLog("videos", "jina_marked_blocked", {
    blockedUntil: new Date(jinaBlockedUntilMs).toISOString(),
  });
}

function extractVideoTitleFromText(text) {
  if (!text) {
    return "";
  }

  const titleLine = text.match(/^Title:\s*(.+)$/im);
  if (titleLine?.[1]) {
    return titleLine[1].trim();
  }

  const markdownHeading = text.match(/^#\s+(.+)$/im);
  if (markdownHeading?.[1]) {
    return markdownHeading[1].trim();
  }

  return "";
}

function normalizeVideoTitle(title) {
  if (!title || typeof title !== "string") {
    return "";
  }

  let normalized = title.trim();
  if (!normalized) {
    return "";
  }

  normalized = normalized.replace(/\s*-\s*YouTube\s*$/i, "").trim();
  return normalized;
}

function isGenericVideoTitle(title) {
  const normalized = normalizeVideoTitle(title).toLowerCase();
  if (!normalized) {
    return true;
  }

  const genericTokens = [
    "youtube",
    "youtube.com",
    "youtu.be",
    "video",
    "youtube video",
  ];

  return genericTokens.includes(normalized);
}

function normalizeThumbnailCache(rawCache) {
  if (!rawCache || typeof rawCache !== "object" || Array.isArray(rawCache)) {
    return {};
  }

  return Object.entries(rawCache).reduce((acc, [cacheKey, value]) => {
    if (!cacheKey || typeof cacheKey !== "string") {
      return acc;
    }
    if (typeof value !== "string" || !value.trim()) {
      return acc;
    }

    if (!cacheKey.endsWith(".jpg")) {
      return acc;
    }

    acc[cacheKey] = value.trim();
    return acc;
  }, {});
}

function thumbnailCacheKey(videoId) {
  return `${videoId}.jpg`;
}

function readCachedThumbnail(cache, videoId) {
  if (!videoId) {
    return "";
  }
  const namedKey = thumbnailCacheKey(videoId);
  return cache[namedKey] || "";
}

function normalizeVideoRedirectCache(rawCache) {
  if (!rawCache || typeof rawCache !== "object" || Array.isArray(rawCache)) {
    return {};
  }

  return Object.entries(rawCache).reduce((acc, [redirectUrl, videoId]) => {
    if (!redirectUrl || typeof redirectUrl !== "string") {
      return acc;
    }
    if (!videoId || typeof videoId !== "string") {
      return acc;
    }
    const normalizedId = videoId.trim();
    if (!normalizedId) {
      return acc;
    }
    acc[redirectUrl] = normalizedId;
    return acc;
  }, {});
}

async function fetchYouTubeTitle(videoId) {
  if (!videoId) {
    return "";
  }

  try {
    const oembedUrl = `${YOUTUBE_OEMBED_BASE}?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const response = await fetch(oembedUrl, { method: "GET" });
    if (!response.ok) {
      aiDebugLog("videos", "oembed_non_ok", { videoId, status: response.status });
      return "";
    }
    const data = await response.json();
    const title = normalizeVideoTitle(data?.title || "");
    aiDebugLog("videos", "oembed_title_loaded", {
      videoId,
      hasTitle: Boolean(title),
    });
    return title;
  } catch (error) {
    aiDebugError("videos", "oembed_title_failed", error, { videoId });
    return "";
  }
}

async function fetchThumbnailAsDataUrl(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      aiDebugLog("videos", "thumbnail_fetch_non_ok", { url, status: response.status });
      return null;
    }
    const blob = await response.blob();
    if (!blob || !blob.size) {
      return null;
    }
    const dataUrl = await readBlobAsDataUrl(blob);
    aiDebugLog("videos", "thumbnail_fetch_ok", { url });
    return dataUrl || null;
  } catch {
    aiDebugError("videos", "thumbnail_fetch_failed", new Error("thumbnail_fetch_failed"), {
      url,
    });
    return null;
  }
}

async function resolveRedirectViaProxy(uri) {
  if (shouldSkipJinaNow()) {
    aiDebugLog("videos", "jina_skipped_circuit_breaker", {
      uri,
      blockedUntil: new Date(jinaBlockedUntilMs).toISOString(),
    });
    return {
      videoId: "",
      videoTitle: "",
    };
  }

  const proxyUrl = `${REDIRECT_RESOLVER_PREFIX}${uri.replace(/^https?:\/\//i, "")}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REDIRECT_RESOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(proxyUrl, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch {
        // ignore body parsing error
      }
      const blockUntil = extractJinaBlockUntilMs(bodyText);
      if (blockUntil || /SecurityCompromiseError/i.test(bodyText)) {
        markJinaBlockedUntil(blockUntil);
      }
      aiDebugLog("videos", "redirect_resolve_non_ok", {
        uri,
        proxyUrl,
        status: response.status,
        bodyPreview: bodyText ? bodyText.slice(0, 220) : "",
      });
      return {
        videoId: "",
        videoTitle: "",
      };
    }

    const text = await response.text();
    const blockUntil = extractJinaBlockUntilMs(text);
    if (blockUntil || /SecurityCompromiseError/i.test(text)) {
      markJinaBlockedUntil(blockUntil);
      return {
        videoId: "",
        videoTitle: "",
      };
    }
    const trimmed = text.slice(0, 180000);
    const videoId = extractVideoIdFromText(trimmed);
    const videoTitle = normalizeVideoTitle(extractVideoTitleFromText(trimmed));
    aiDebugLog("videos", "redirect_resolve_proxy_result", {
      uri,
      foundVideoId: Boolean(videoId),
      foundTitle: Boolean(videoTitle),
    });
    return {
      videoId,
      videoTitle,
    };
  } catch (error) {
    aiDebugError("videos", "redirect_resolve_proxy_failed", error, { uri, proxyUrl });
    return {
      videoId: "",
      videoTitle: "",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveGroundingRedirectToVideoMetadata(uri) {
  if (!uri || !isGroundingRedirectUrl(uri)) {
    return {
      videoId: "",
      videoTitle: "",
    };
  }

  if (redirectResolutionInFlight.has(uri)) {
    return redirectResolutionInFlight.get(uri);
  }

  const task = (async () => resolveRedirectViaProxy(uri))();

  redirectResolutionInFlight.set(uri, task);
  try {
    return await task;
  } finally {
    redirectResolutionInFlight.delete(uri);
  }
}

export function prepareGroundedVideosForDisplay(
  videos,
  rawThumbnailCache,
  rawVideoRedirectCache
) {
  const thumbnailCache = normalizeThumbnailCache(rawThumbnailCache);
  const videoRedirectCache = normalizeVideoRedirectCache(rawVideoRedirectCache);

  const preparedVideos = (videos || [])
    .map((video) => {
      if (!video || typeof video !== "object") {
        return null;
      }

      const sourceUrl = (video.sourceUrl || video.url || "").trim();
      if (!sourceUrl) {
        return null;
      }

      const cachedRedirectId = videoRedirectCache[sourceUrl] || "";
      const videoId = (
        video.videoId ||
        parseYouTubeVideoId(sourceUrl) ||
        cachedRedirectId
      ).trim();
      const title = video.title || "YouTube Video";
      if (!isLikelyYouTubeVideoSource(sourceUrl, title)) {
        return null;
      }
      const thumbnailUrl = videoId
        ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        : "";
      const thumbnailSrc = videoId ? readCachedThumbnail(thumbnailCache, videoId) || thumbnailUrl : "";
      const loading = !videoId && isGroundingRedirectUrl(sourceUrl);

      return {
        videoId,
        sourceUrl,
        url: sourceUrl,
        title,
        thumbnailUrl,
        thumbnailSrc,
        loading,
      };
    })
    .filter(Boolean);

  return {
    videos: preparedVideos,
    nextThumbnailCache: thumbnailCache,
    nextVideoRedirectCache: videoRedirectCache,
    thumbnailCacheChanged: false,
    videoRedirectCacheChanged: false,
  };
}

export async function resolveGroundedVideosInBackground(
  preparedVideos,
  rawThumbnailCache,
  rawVideoRedirectCache,
  options = {}
) {
  const nextThumbnailCache = normalizeThumbnailCache(rawThumbnailCache);
  const nextVideoRedirectCache = normalizeVideoRedirectCache(rawVideoRedirectCache);
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  let thumbnailCacheChanged = false;
  let videoRedirectCacheChanged = false;

  const resolvedVideos = [];

  for (const video of preparedVideos || []) {
    if (!video || typeof video !== "object") {
      continue;
    }

    const sourceUrl = (video.sourceUrl || video.url || "").trim();
    let videoId = (video.videoId || "").trim();
    let resolvedTitle = normalizeVideoTitle(video.title || "");

    if (!videoId && sourceUrl && isGroundingRedirectUrl(sourceUrl)) {
      const cachedId = nextVideoRedirectCache[sourceUrl];
      if (cachedId) {
        videoId = cachedId;
      } else {
        const { videoId: resolvedId, videoTitle } =
          await resolveGroundingRedirectToVideoMetadata(sourceUrl);
        if (resolvedId) {
          videoId = resolvedId;
          resolvedTitle = normalizeVideoTitle(videoTitle) || resolvedTitle;
          nextVideoRedirectCache[sourceUrl] = resolvedId;
          videoRedirectCacheChanged = true;
        }
      }
    }

    if (!videoId) {
      aiDebugLog("videos", "drop_unresolved_non_youtube", {
        sourceUrl,
      });
      if (onProgress) {
        try {
          onProgress({
            sourceUrl,
            resolvedVideo: null,
            removed: true,
          });
        } catch {
          // ignore progress handler errors
        }
      }
      continue;
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailVideoId = parseYouTubeVideoId(canonicalUrl) || videoId;
    const thumbnailUrl = `https://img.youtube.com/vi/${thumbnailVideoId}/mqdefault.jpg`;
    const cachedThumbnail = readCachedThumbnail(nextThumbnailCache, thumbnailVideoId);
    let thumbnailSrc = cachedThumbnail || "";
    let finalTitle = resolvedTitle;

    if (isGenericVideoTitle(finalTitle)) {
      const oembedTitle = await fetchYouTubeTitle(videoId);
      if (oembedTitle) {
        finalTitle = oembedTitle;
      }
    }

    if (!thumbnailSrc) {
      const fetched = await fetchThumbnailAsDataUrl(thumbnailUrl);
      thumbnailSrc = fetched || thumbnailUrl;
      nextThumbnailCache[thumbnailCacheKey(thumbnailVideoId)] = thumbnailSrc;
      thumbnailCacheChanged = true;
    }

    const resolvedVideo = {
      ...video,
      videoId,
      url: canonicalUrl,
      title: finalTitle || "YouTube Video",
      thumbnailUrl,
      thumbnailSrc,
      loading: false,
    };

    resolvedVideos.push(resolvedVideo);

    if (onProgress) {
      try {
        onProgress({
          sourceUrl,
          resolvedVideo,
          removed: false,
        });
      } catch {
        // ignore progress handler errors
      }
    }
  }

  aiDebugLog("videos", "background_resolution_completed", {
    input: Array.isArray(preparedVideos) ? preparedVideos.length : 0,
    output: resolvedVideos.length,
    thumbnailCacheChanged,
    videoRedirectCacheChanged,
  });

  return {
    videos: resolvedVideos,
    nextThumbnailCache,
    nextVideoRedirectCache,
    thumbnailCacheChanged,
    videoRedirectCacheChanged,
  };
}

export { normalizeThumbnailCache, normalizeVideoRedirectCache };
