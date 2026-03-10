const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function isGroundingRedirectUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.hostname.toLowerCase() === "vertexaisearch.cloud.google.com" &&
      parsed.pathname.includes("/grounding-api-redirect/")
    );
  } catch {
    return false;
  }
}

function parseYouTubeVideoId(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
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

async function resolveRedirect(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    const resolvedUrl = response.url || url;
    const videoId = parseYouTubeVideoId(resolvedUrl);
    return {
      url: resolvedUrl,
      videoId,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchYouTubeTitle(videoId) {
  if (!videoId) {
    return "";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const response = await fetch(oembedUrl, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return "";
    }
    const data = await response.json();
    return typeof data?.title === "string" ? data.title.trim() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveSingle(url) {
  const resolved = await resolveRedirect(url);
  if (!resolved.url.includes("youtube.com") && !resolved.url.includes("youtu.be")) {
    return {
      url,
      error: "Not a YouTube video",
    };
  }

  const title = await fetchYouTubeTitle(resolved.videoId);
  return {
    url,
    resolvedUrl: resolved.url,
    videoId: resolved.videoId || "",
    title,
  };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    let payload = null;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const url = typeof payload?.url === "string" ? payload.url.trim() : "";
    const urls = Array.isArray(payload?.urls) ? payload.urls : null;

    if (!url && (!urls || urls.length === 0)) {
      return jsonResponse({ error: "Missing url" }, 400);
    }

    if (urls && urls.length > 0) {
      const cleaned = urls
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
        .filter((value) => isGroundingRedirectUrl(value));

      if (cleaned.length === 0) {
        return jsonResponse({ error: "Unsupported url" }, 400);
      }

      try {
        const results = await Promise.all(cleaned.map((entry) => resolveSingle(entry)));
        return jsonResponse({ results });
      } catch {
        return jsonResponse({ error: "Resolution failed" }, 502);
      }
    }

    if (!isGroundingRedirectUrl(url)) {
      return jsonResponse({ error: "Unsupported url" }, 400);
    }

    try {
      const resolved = await resolveSingle(url);
      if (resolved?.error) {
        return jsonResponse({ error: resolved.error }, 400);
      }
      return jsonResponse(resolved);
    } catch {
      return jsonResponse({ error: "Resolution failed" }, 502);
    }
  },
};
