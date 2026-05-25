#!/usr/bin/env node

const http = require("node:http");

const PORT = Number(process.env.PORT || 8789);
const MAX_PLAYLIST_BYTES = 5 * 1024 * 1024;

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range",
    ...headers,
  });
  response.end(body);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getProxyUrl(requestUrl, targetUrl, userAgent) {
  const proxied = new URL("/proxy", requestUrl.origin);
  proxied.searchParams.set("url", targetUrl);
  if (userAgent) {
    proxied.searchParams.set("ua", userAgent);
  }
  return proxied.toString();
}

function rewriteTagUris(line, targetUrl, requestUrl, userAgent) {
  return line.replace(/URI="([^"]+)"/gi, (match, uri) => {
    try {
      const absoluteUrl = new URL(uri, targetUrl).toString();
      return `URI="${getProxyUrl(requestUrl, absoluteUrl, userAgent)}"`;
    } catch {
      return match;
    }
  });
}

function rewritePlaylist(text, targetUrl, requestUrl, userAgent) {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return rewriteTagUris(line, targetUrl, requestUrl, userAgent);
      }

      try {
        const absoluteUrl = new URL(trimmed, targetUrl).toString();
        return getProxyUrl(requestUrl, absoluteUrl, userAgent);
      } catch {
        return line;
      }
    })
    .join("\n");
}

async function handleProxy(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const targetUrl = requestUrl.searchParams.get("url") || "";
  const userAgent = requestUrl.searchParams.get("ua") || "";

  if (!isHttpUrl(targetUrl)) {
    send(response, 400, "Missing or invalid url parameter.");
    return;
  }

  const headers = {};
  if (userAgent) {
    headers["User-Agent"] = userAgent;
  }
  if (request.headers.range) {
    headers.Range = request.headers.range;
  }

  const upstream = await fetch(targetUrl, { headers });
  const contentType = upstream.headers.get("content-type") || "";
  const isPlaylist =
    contentType.includes("mpegurl") ||
    contentType.includes("application/vnd.apple.mpegurl") ||
    targetUrl.includes(".m3u8") ||
    targetUrl.includes(".m3u");

  if (isPlaylist) {
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > MAX_PLAYLIST_BYTES) {
      send(response, 502, "Playlist is too large.");
      return;
    }

    const text = await upstream.text();
    send(response, upstream.status, rewritePlaylist(text, targetUrl, requestUrl, userAgent), {
      "Content-Type": contentType || "application/vnd.apple.mpegurl; charset=utf-8",
    });
    return;
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  const responseHeaders = {
    "Content-Type": contentType || "application/octet-stream",
  };
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) {
    responseHeaders["Content-Range"] = contentRange;
  }
  if (upstream.headers.get("accept-ranges")) {
    responseHeaders["Accept-Ranges"] = upstream.headers.get("accept-ranges");
  }

  send(response, upstream.status, body, responseHeaders);
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    send(response, 204, "");
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname !== "/proxy") {
    send(response, 404, "Not found.");
    return;
  }

  handleProxy(request, response).catch((error) => {
    console.error(error);
    send(response, 502, error.message || "Proxy request failed.");
  });
});

server.listen(PORT, () => {
  console.log(`CloudCast playback proxy listening on http://localhost:${PORT}/proxy`);
});
