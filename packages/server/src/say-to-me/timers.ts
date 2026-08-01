import express from "express";
import { sayToMeUrl } from "./base-url.js";

export const SAY_TO_ME_TIMERS_PATH = "/api/say-to-me/timers";
const FORWARDED_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "expires",
  "last-modified",
  "vary",
];

type FetchLike = typeof fetch;

function upstreamPath(req: express.Request): string {
  const suffix = req.params.timerId ? `/${encodeURIComponent(req.params.timerId)}` : "";
  const action = req.params.action ? `/${req.params.action}` : "";
  const query = new URLSearchParams(req.query as Record<string, string>);
  const queryString = query.toString();
  return `/api/jarvis-timers${suffix}${action}${queryString ? `?${queryString}` : ""}`;
}

export async function fetchSayToMeTimers(
  req: Pick<express.Request, "method" | "params" | "query" | "body">,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const headers = new Headers();
  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined;
  if (hasBody) headers.set("content-type", "application/json");
  return fetchImpl(sayToMeUrl(upstreamPath(req as express.Request)), {
    method: req.method,
    headers,
    body: hasBody ? JSON.stringify(req.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
}

function asyncHandler(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).then(undefined, next);
  };
}

export function createSayToMeTimersRouter(fetchImpl: FetchLike = fetch): express.Router {
  const router = express.Router();
  const proxy = asyncHandler(async (req, res) => {
    const upstream = await fetchSayToMeTimers(req, fetchImpl);
    res.status(upstream.status);
    for (const header of FORWARDED_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  });
  router.get("/", proxy);
  router.post("/", proxy);
  router.patch("/:timerId", proxy);
  router.delete("/:timerId", proxy);
  router.post("/:timerId/actions", proxy);
  return router;
}
