import express from "express";
import { sayToMeUrl } from "./base-url.js";
import {
  asyncProxyHandler,
  forwardSafeHeaders,
  SAY_TO_ME_UPSTREAM_TIMEOUT_MS,
  sendProxyError,
  type FetchLike,
} from "./proxy-util.js";

export const SAY_TO_ME_TIMERS_PATH = "/api/say-to-me-timers";

const TIMER_ID_PATTERN = /^[0-9]+$/;
const SESSION_ID_QUERY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const FORWARDED_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "expires",
  "last-modified",
  "vary",
];

/** Only the documented list filter is forwarded; every other query key is dropped. */
function timersQuery(req: express.Request): string {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
  if (!sessionId || !SESSION_ID_QUERY_PATTERN.test(sessionId)) return "";
  return `?${new URLSearchParams({ sessionId }).toString()}`;
}

export function createSayToMeTimersRouter(fetchImpl: FetchLike = fetch): express.Router {
  const router = express.Router();

  function proxyTimers(upstreamPath: (req: express.Request) => string): express.RequestHandler {
    return asyncProxyHandler(async (req, res) => {
      const timerId = req.params.timerId;
      if (timerId !== undefined && !TIMER_ID_PATTERN.test(timerId)) {
        sendProxyError(res, 400, "Invalid timer id.");
        return;
      }
      const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined;
      const upstream = await fetchImpl(sayToMeUrl(upstreamPath(req)), {
        method: req.method,
        headers: hasBody ? { "content-type": "application/json" } : undefined,
        body: hasBody ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(SAY_TO_ME_UPSTREAM_TIMEOUT_MS),
      });
      res.status(upstream.status);
      forwardSafeHeaders(res, upstream, FORWARDED_HEADERS);
      res.send(Buffer.from(await upstream.arrayBuffer()));
    }, "Unable to reach Say To Me timers.");
  }

  const collection = proxyTimers((req) => `/api/jarvis-timers${timersQuery(req)}`);
  const item = proxyTimers((req) => `/api/jarvis-timers/${encodeURIComponent(req.params.timerId)}`);
  const actions = proxyTimers(
    (req) => `/api/jarvis-timers/${encodeURIComponent(req.params.timerId)}/actions`,
  );

  router.get("/", collection);
  router.post("/", collection);
  router.patch("/:timerId", item);
  router.delete("/:timerId", item);
  router.post("/:timerId/actions", actions);

  return router;
}
