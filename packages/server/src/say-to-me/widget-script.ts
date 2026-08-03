import type express from "express";
import { sayToMeUrl } from "./base-url.js";
import {
  asyncProxyHandler,
  forwardSafeHeaders,
  SAY_TO_ME_UPSTREAM_TIMEOUT_MS,
  sendProxyError,
  type FetchLike,
} from "./proxy-util.js";

export const SAY_TO_ME_WIDGET_SCRIPT_PATH = "/api/say-to-me/embed/widget.js";

const UPSTREAM_WIDGET_SCRIPT_PATH = "/embed/widget.js";
const FORWARDED_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "expires",
  "last-modified",
  "vary",
];

/** Proxies the Say To Me classic-script widget bundle so clients never load the STM origin directly. */
export function createSayToMeWidgetScriptHandler(
  fetchImpl: FetchLike = fetch,
): express.RequestHandler {
  return asyncProxyHandler(async (_req, res) => {
    const upstream = await fetchImpl(sayToMeUrl(UPSTREAM_WIDGET_SCRIPT_PATH), {
      signal: AbortSignal.timeout(SAY_TO_ME_UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      sendProxyError(res, 502, "Unable to load Say To Me widget.");
      return;
    }
    res.status(upstream.status);
    forwardSafeHeaders(res, upstream, FORWARDED_HEADERS);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }, "Unable to load Say To Me widget.");
}
