const { Readable } = require("node:stream");

const DEFAULT_DAEMON_ENDPOINT = "http://localhost:6767";
const EXACT_PROXY_PATHS = new Set([
  "/api/say-to-me-timers",
  "/api/say-to-me/embed/widget.js",
  "/park",
]);
const PREFIX_PROXY_PATHS = [
  "/api/voice-notes/",
  "/api/say-to-me-timers/",
  "/api/message-attachments/",
];
const REQUEST_HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "host",
  "keep-alive",
  "transfer-encoding",
]);
const RESPONSE_SAFE_HEADERS = new Set([
  "accept-ranges",
  "cache-control",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "retry-after",
  "x-accel-buffering",
]);

function normalizeDaemonEndpoint(endpoint) {
  const value = String(endpoint ?? "").trim();
  const candidate = value.length === 0 ? DEFAULT_DAEMON_ENDPOINT : value;
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
    ? candidate
    : `http://${candidate}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported Paseo daemon endpoint protocol: ${url.protocol}`);
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function isSayToMeProxyPath(pathname) {
  if (EXACT_PROXY_PATHS.has(pathname)) return true;
  return PREFIX_PROXY_PATHS.some(
    (prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length,
  );
}

function buildDaemonRequestUrl(endpoint, requestUrl) {
  const request = new URL(requestUrl, "http://metro.invalid");
  return `${normalizeDaemonEndpoint(endpoint)}${request.pathname}${request.search}`;
}

function copyRequestHeaders(request) {
  const headers = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (!REQUEST_HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) {
      headers[name] = Array.isArray(value) ? value.join(", ") : value;
    }
  }
  return headers;
}

function copySafeResponseHeaders(response, target) {
  for (const [name, value] of response.headers) {
    if (RESPONSE_SAFE_HEADERS.has(name.toLowerCase())) target.setHeader(name, value);
  }
}

function createSayToMeProxyMiddleware(
  endpoint = process.env.PASEO_STM_PROXY_ENDPOINT || process.env.PASEO_DEV_DAEMON_ENDPOINT,
) {
  const normalizedEndpoint = normalizeDaemonEndpoint(endpoint);
  return (request, response, next) => {
    const requestUrl = new URL(request.url ?? "/", "http://metro.invalid");
    if (!isSayToMeProxyPath(requestUrl.pathname)) {
      next();
      return;
    }

    const method = request.method ?? "GET";
    const init = {
      method,
      headers: copyRequestHeaders(request),
      redirect: "manual",
    };
    if (method !== "GET" && method !== "HEAD") {
      init.body = request;
      init.duplex = "half";
    }

    fetch(buildDaemonRequestUrl(normalizedEndpoint, request.url ?? "/"), init)
      .then((upstream) => {
        response.statusCode = upstream.status;
        copySafeResponseHeaders(upstream, response);
        if (!upstream.body) {
          response.end();
          return undefined;
        }
        Readable.fromWeb(upstream.body).pipe(response);
        return undefined;
      })
      .catch((error) => {
        if (response.headersSent) {
          response.destroy(error);
          return;
        }
        response.statusCode = 502;
        response.setHeader("content-type", "text/plain; charset=utf-8");
        response.end("Unable to reach the Paseo daemon");
      });
  };
}

module.exports = {
  buildDaemonRequestUrl,
  createSayToMeProxyMiddleware,
  isSayToMeProxyPath,
  normalizeDaemonEndpoint,
};
