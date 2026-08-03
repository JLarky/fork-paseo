const { Readable } = require("node:stream");
const { Buffer } = require("node:buffer");

const DEFAULT_STM_ORIGIN = "http://localhost:5411";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_JSON_BODY_BYTES = 1_000_000;
const SESSION_ID_PATTERN = /^pa_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_PATTERN = /^[0-9]+$/;
const INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SESSION_ID_QUERY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const MESSAGE_STATUSES = new Set(["queued", "speaking", "played", "stopped"]);
const SAFE_RESPONSE_HEADERS = new Set([
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "retry-after",
  "vary",
  "x-accel-buffering",
]);
const ROUTES = [
  ["widget", "GET", /^\/api\/say-to-me\/embed\/widget\.js$/, []],
  ["voiceMessages", "GET", /^\/api\/voice-notes\/([^/]+)$/, []],
  ["voiceImport", "POST", /^\/api\/voice-notes\/([^/]+)$/, []],
  ["voiceEvents", "GET", /^\/api\/voice-notes\/([^/]+)\/events$/, []],
  ["voiceStatus", "POST", /^\/api\/voice-notes\/([^/]+)\/messages\/([^/]+)\/status$/, []],
  ["timersCollection", null, /^\/api\/say-to-me-timers\/?$/, []],
  ["timersItem", null, /^\/api\/say-to-me-timers\/([^/]+)$/, []],
  ["timersAction", "POST", /^\/api\/say-to-me-timers\/([^/]+)\/actions$/, []],
  ["attachment", "GET", /^\/api\/message-attachments\/([^/]+)$/, []],
];

function normalizeStmOrigin(origin = process.env.PASEO_STM_DEV_ORIGIN || DEFAULT_STM_ORIGIN) {
  const value = String(origin ?? "").trim();
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `http://${value}`);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error(`Unsupported STM origin protocol: ${url.protocol}`);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    throw new Error("STM origin must contain only an HTTP origin.");
  return url.origin;
}

function buildStmRequestUrl(origin, pathname, search = "") {
  const url = new URL(pathname, `${normalizeStmOrigin(origin)}/`);
  url.search = search;
  return url.toString();
}

function matchingRoute(pathname, method) {
  for (const [name, routeMethod, pattern] of ROUTES) {
    const match = pattern.exec(pathname);
    if (match && (!routeMethod || routeMethod === method)) return { name, match };
  }
  return null;
}

function isSayToMeProxyPath(pathname) {
  return ROUTES.some(([, , pattern]) => pattern.test(pathname));
}

function jsonError(response, status, message) {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ error: message }));
}

function safeResponseHeaders(upstream, response) {
  for (const [name, value] of upstream.headers)
    if (SAFE_RESPONSE_HEADERS.has(name.toLowerCase())) response.setHeader(name, value);
}

function hasBody(request) {
  return (
    Number(request.headers["content-length"] ?? 0) > 0 ||
    Boolean(request.headers["transfer-encoding"])
  );
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function readJsonBody(request) {
  const raw = await readBody(request);
  const contentType = String(request.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!raw.length || contentType !== "application/json")
    throw Object.assign(new Error("JSON request body is required."), { statusCode: 400 });
  try {
    const value = JSON.parse(raw.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw Object.assign(new Error("Request body must be a JSON object."), { statusCode: 400 });
  }
}

function requestInit(method, body) {
  if (body === undefined) return { method };
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function proxyBuffered(response, origin, path, search, method, body) {
  const upstream = await fetchWithTimeout(
    buildStmRequestUrl(origin, path, search),
    requestInit(method, body),
  );
  response.statusCode = upstream.status;
  safeResponseHeaders(upstream, response);
  if (!upstream.body) return response.end();
  Readable.fromWeb(upstream.body).pipe(response);
}

async function proxySse(request, response, origin, sessionId) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };
  const cleanup = () => {
    request.removeListener("aborted", abort);
    response.removeListener("close", abort);
  };
  request.once("aborted", abort);
  response.once("close", abort);
  try {
    const upstream = await fetch(
      buildStmRequestUrl(origin, `/api/sessions/${encodeURIComponent(sessionId)}/events`),
      { signal: controller.signal },
    );
    if (!upstream.ok || !upstream.body) {
      cleanup();
      return jsonError(
        response,
        upstream.status === 404 ? 404 : 502,
        upstream.status === 404 ? "Voice session not found." : "Unable to open voice notes stream.",
      );
    }
    response.statusCode = upstream.status;
    response.setHeader("content-type", upstream.headers.get("content-type") ?? "text/event-stream");
    response.setHeader("cache-control", "no-cache, no-transform");
    response.setHeader("connection", "keep-alive");
    response.setHeader("x-accel-buffering", "no");
    response.flushHeaders?.();
    const stream = Readable.fromWeb(upstream.body);
    stream.on("error", () => {
      cleanup();
      response.destroy();
    });
    stream.once("end", cleanup);
    stream.once("close", cleanup);
    stream.pipe(response);
  } catch {
    cleanup();
    if (!response.headersSent && !controller.signal.aborted)
      jsonError(response, 502, "Unable to open voice notes stream.");
  }
}

// eslint-disable-next-line complexity
async function handle(request, response, origin, requestUrl, route) {
  const { name, match } = route;
  if (name === "widget") return proxyBuffered(response, origin, "/embed/widget.js", "", "GET");
  if (["voiceMessages", "voiceImport", "voiceEvents"].includes(name)) {
    const sessionId = match[1];
    if (!SESSION_ID_PATTERN.test(sessionId))
      return jsonError(response, 400, "Invalid voice session id.");
    if (name === "voiceEvents") {
      if (hasBody(request)) return jsonError(response, 400, "GET requests cannot have a body.");
      return proxySse(request, response, origin, sessionId);
    }
    if (name === "voiceMessages") {
      if (hasBody(request)) return jsonError(response, 400, "GET requests cannot have a body.");
      return proxyBuffered(
        response,
        origin,
        `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
        "",
        "GET",
      );
    }
    const keys = [...requestUrl.searchParams.keys()];
    if (keys.some((key) => key !== "instanceId"))
      return jsonError(response, 400, "Only instanceId is supported.");
    const instanceId = requestUrl.searchParams.get("instanceId");
    if (instanceId !== null && !INSTANCE_ID_PATTERN.test(instanceId))
      return jsonError(response, 400, "Invalid instance id.");
    if (hasBody(request)) return jsonError(response, 400, "Import requests cannot have a body.");
    const search = instanceId ? `?${new URLSearchParams({ instanceId }).toString()}` : "";
    return proxyBuffered(
      response,
      origin,
      `/api/sessions/${encodeURIComponent(sessionId)}/import`,
      search,
      "POST",
    );
  }
  if (name === "voiceStatus") {
    if (!SESSION_ID_PATTERN.test(match[1]) || !NUMERIC_ID_PATTERN.test(match[2]))
      return jsonError(response, 400, "Invalid voice message status.");
    let body;
    try {
      body = await readJsonBody(request);
      if (
        Object.keys(body).length !== 1 ||
        typeof body.status !== "string" ||
        !MESSAGE_STATUSES.has(body.status)
      )
        throw Object.assign(new Error("Invalid voice message status."), { statusCode: 400 });
    } catch (error) {
      return jsonError(response, error.statusCode ?? 400, error.message);
    }
    return proxyBuffered(
      response,
      origin,
      `/api/messages/${encodeURIComponent(match[2])}/status`,
      "",
      "POST",
      body,
    );
  }
  if (["timersCollection", "timersItem", "timersAction"].includes(name)) {
    const keys = [...requestUrl.searchParams.keys()];
    if (keys.some((key) => key !== "sessionId"))
      return jsonError(response, 400, "Only sessionId is supported.");
    const sessionId = requestUrl.searchParams.get("sessionId");
    if (sessionId !== null && !SESSION_ID_QUERY_PATTERN.test(sessionId))
      return jsonError(response, 400, "Invalid sessionId.");
    if (name !== "timersCollection" && !NUMERIC_ID_PATTERN.test(match[1]))
      return jsonError(response, 400, "Invalid timer id.");
    let allowed;
    if (name === "timersCollection") allowed = ["GET", "POST"];
    else if (name === "timersItem") allowed = ["PATCH", "DELETE"];
    else allowed = ["POST"];
    if (!allowed.includes(request.method)) return jsonError(response, 405, "Method not allowed.");
    let body;
    if (request.method !== "GET" && request.method !== "DELETE") {
      try {
        body = await readJsonBody(request);
      } catch (error) {
        return jsonError(response, error.statusCode ?? 400, error.message);
      }
    } else if (hasBody(request))
      return jsonError(response, 400, "This request cannot have a body.");
    const suffix =
      name === "timersCollection"
        ? ""
        : `/${encodeURIComponent(match[1])}${name === "timersAction" ? "/actions" : ""}`;
    const search =
      name === "timersCollection" && sessionId
        ? `?${new URLSearchParams({ sessionId }).toString()}`
        : "";
    return proxyBuffered(
      response,
      origin,
      `/api/jarvis-timers${suffix}`,
      search,
      request.method,
      body,
    );
  }
  if (name === "attachment") {
    if (!NUMERIC_ID_PATTERN.test(match[1]) || hasBody(request))
      return jsonError(response, 400, "Invalid message attachment request.");
    return proxyBuffered(
      response,
      origin,
      `/api/message-attachments/${encodeURIComponent(match[1])}`,
      "",
      "GET",
    );
  }
  return jsonError(response, 404, "Not found.");
}

function createSayToMeProxyMiddleware(
  origin = process.env.PASEO_STM_DEV_ORIGIN || DEFAULT_STM_ORIGIN,
) {
  const normalizedOrigin = normalizeStmOrigin(origin);
  return (request, response, next) => {
    const requestUrl = new URL(request.url ?? "/", "http://metro.invalid");
    const route = matchingRoute(requestUrl.pathname, request.method ?? "GET");
    if (!route) {
      if (isSayToMeProxyPath(requestUrl.pathname)) jsonError(response, 405, "Method not allowed.");
      else next();
      return;
    }
    void handle(request, response, normalizedOrigin, requestUrl, route).catch((error) => {
      if (!response.headersSent)
        jsonError(
          response,
          502,
          error instanceof Error ? error.message : "Unable to reach Say To Me.",
        );
      else response.destroy(error);
    });
  };
}

module.exports = {
  buildStmRequestUrl,
  createSayToMeProxyMiddleware,
  isSayToMeProxyPath,
  normalizeStmOrigin,
};
