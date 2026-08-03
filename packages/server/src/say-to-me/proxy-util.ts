import type express from "express";

/** Upstream requests time out after this except SSE streams, which live until the client disconnects. */
export const SAY_TO_ME_UPSTREAM_TIMEOUT_MS = 15_000;

export type FetchLike = typeof fetch;

export function sendProxyError(res: express.Response, status: number, error: string): void {
  res.status(status).json({ error });
}

/** Routes async rejections into a stable 502 instead of Express's default 500 stack page. */
export function asyncProxyHandler(
  handler: (req: express.Request, res: express.Response) => Promise<void>,
  upstreamFailureMessage: string,
): express.RequestHandler {
  return (req, res) => {
    handler(req, res).catch(() => {
      if (!res.headersSent) sendProxyError(res, 502, upstreamFailureMessage);
    });
  };
}

/** Copies only the named upstream headers; everything else (set-cookie, server, ...) is dropped. */
export function forwardSafeHeaders(
  res: express.Response,
  upstream: Response,
  headers: readonly string[],
): void {
  for (const header of headers) {
    const value = upstream.headers.get(header);
    if (value) res.setHeader(header, value);
  }
}
