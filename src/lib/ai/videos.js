import { aiDebugError, aiDebugLog } from "./debug";

const REDIRECT_RESOLVE_TIMEOUT_MS = 12000;
const VIDEO_RESOLVER_URL = (import.meta.env.VITE_VIDEO_RESOLVER_URL || "").trim();


// Convert a Blob into a data URL for cache storage.
function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Ensure the thumbnail cache is a plain object of "<videoId>.jpg" -> dataUrl.
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

// Build the cache key for a thumbnail.
function thumbnailCacheKey(videoId) {
  return `${videoId}.jpg`;
}

// Read a cached thumbnail data URL for a video ID.
function readCachedThumbnail(cache, videoId) {
  if (!videoId) {
    return "";
  }
  const namedKey = thumbnailCacheKey(videoId);
  return cache[namedKey] || "";
}

// Ensure the redirect cache is a plain object of redirect URL -> video ID.
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

// Fetch and convert a thumbnail to a data URL for offline caching.
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

// Normalize a worker response entry into consistent fields.
function parseWorkerVideoMetadata(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      videoId: "",
      videoTitle: "",
      resolvedUrl: "",
    };
  }

  const resolvedUrl = String(
    payload.url || payload.youtubeUrl || payload.resolvedUrl || ""
  ).trim();

  const videoId = String(payload.videoId || "").trim();
  const videoTitle = String(
    payload.title || payload.videoTitle || payload.resolvedTitle || ""
  ).trim();

  return {
    videoId,
    videoTitle,
    resolvedUrl,
  };
}

// Map batch worker results into { redirectUrl: metadata }.
function parseWorkerBatchResults(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  if (results.length === 0) {
    return {};
  }

  return results.reduce((acc, entry) => {
    if (!entry || typeof entry !== "object") {
      return acc;
    }
    const sourceUrl = String(entry.url || "").trim();
    if (!sourceUrl) {
      return acc;
    }
    acc[sourceUrl] = parseWorkerVideoMetadata(entry);
    return acc;
  }, {});
}

// Resolve a list of grounding redirect URLs in one worker call.
async function resolveRedirectsViaWorkerBatch(uris) {
  const unique = Array.from(
    new Set((uris || []).filter((value) => typeof value === "string" && value.trim()))
  );

  if (!VIDEO_RESOLVER_URL) {
    aiDebugLog("videos", "resolver_missing", { batchSize: unique.length });
    return {};
  }

  if (unique.length === 0) {
    return {};
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REDIRECT_RESOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(VIDEO_RESOLVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({ urls: unique }),
    });

    if (!response.ok) {
      aiDebugLog("videos", "redirect_batch_non_ok", {
        status: response.status,
        count: unique.length,
      });
      return {};
    }

    const payload = await response.json();
    const parsed = parseWorkerBatchResults(payload);
    aiDebugLog("videos", "redirect_batch_result", {
      input: unique.length,
      output: Object.keys(parsed).length,
    });
    return parsed;
  } catch (error) {
    aiDebugError("videos", "redirect_batch_failed", error, { count: unique.length });
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}

// Synchronously prepare UI data from grounding videos and caches.
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
      const videoId = (video.videoId || cachedRedirectId || "").trim();
      const title = video.title || "YouTube Video";
      const thumbnailUrl = videoId
        ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        : "";
      const thumbnailSrc = videoId ? readCachedThumbnail(thumbnailCache, videoId) || thumbnailUrl : "";
      const loading = !videoId;

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

// Asynchronously resolve redirects, titles, and thumbnails.
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

  const pendingRedirects = [];
  const preparedList = Array.isArray(preparedVideos) ? preparedVideos : [];

  for (const video of preparedList) {
    if (!video || typeof video !== "object") {
      continue;
    }
    const sourceUrl = (video.sourceUrl || video.url || "").trim();
    const hasVideoId = Boolean((video.videoId || "").trim());
    if (!hasVideoId && sourceUrl) {
      if (!nextVideoRedirectCache[sourceUrl]) {
        pendingRedirects.push(sourceUrl);
      }
    }
  }

  const batchResolved = await resolveRedirectsViaWorkerBatch(pendingRedirects);

  for (const video of preparedList) {
    if (!video || typeof video !== "object") {
      continue;
    }

    const sourceUrl = (video.sourceUrl || video.url || "").trim();
    let videoId = (video.videoId || "").trim();
    let resolvedTitle = String(video.title || "").trim();

    if (!videoId && sourceUrl) {
      const cachedId = nextVideoRedirectCache[sourceUrl];
      if (cachedId) {
        videoId = cachedId;
      } else {
        const resolvedBatch = batchResolved[sourceUrl];
        const resolvedId = resolvedBatch?.videoId || "";
        const resolvedTitleFromBatch = resolvedBatch?.videoTitle || "";
        if (resolvedId) {
          videoId = resolvedId;
          resolvedTitle = resolvedTitleFromBatch || resolvedTitle;
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
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    const cachedThumbnail = readCachedThumbnail(nextThumbnailCache, videoId);
    let thumbnailSrc = cachedThumbnail || "";

    if (!thumbnailSrc) {
      const fetched = await fetchThumbnailAsDataUrl(thumbnailUrl);
      thumbnailSrc = fetched || thumbnailUrl;
      nextThumbnailCache[thumbnailCacheKey(videoId)] = thumbnailSrc;
      thumbnailCacheChanged = true;
    }

    const resolvedVideo = {
      ...video,
      videoId,
      url: canonicalUrl,
      title: resolvedTitle || "YouTube Video",
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
