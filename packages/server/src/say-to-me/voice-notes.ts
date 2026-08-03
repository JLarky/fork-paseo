import { Readable } from "node:stream";
import express from "express";
import { sayToMeUrl } from "./base-url.js";

const SESSION_ID_PATTERN = /^pa_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_ID_PATTERN = /^[0-9]+$/;
const MESSAGE_STATUS_PATTERN = /^(queued|speaking|played|stopped)$/;

type FetchLike = typeof fetch;

function responseError(res: express.Response, status: number, error: string): void {
  res.status(status).json({ error });
}

function asyncHandler(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).then(undefined, next);
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createSayToMeVoiceNotesRouter(fetchImpl: FetchLike = fetch): express.Router {
  const router = express.Router();

  router.get(
    "/:sessionId",
    asyncHandler(async (req, res) => {
      const { sessionId } = req.params;
      if (!SESSION_ID_PATTERN.test(sessionId))
        return responseError(res, 400, "Invalid voice session id.");
      try {
        const upstream = await fetchImpl(
          sayToMeUrl(`/api/sessions/${encodeURIComponent(sessionId)}/messages`),
          { signal: AbortSignal.timeout(15_000) },
        );
        if (upstream.status === 404) return responseError(res, 404, "Voice session not found.");
        if (!upstream.ok) return responseError(res, 502, "Unable to load voice notes.");
        res.status(upstream.status).json(await readJson(upstream));
      } catch {
        responseError(res, 502, "Unable to load voice notes.");
      }
    }),
  );

  router.post(
    "/:sessionId",
    asyncHandler(async (req, res) => {
      const { sessionId } = req.params;
      if (!SESSION_ID_PATTERN.test(sessionId))
        return responseError(res, 400, "Invalid voice session id.");
      try {
        const upstream = await fetchImpl(
          sayToMeUrl(`/api/sessions/${encodeURIComponent(sessionId)}/import?instanceId=worktree`),
          { method: "POST", signal: AbortSignal.timeout(15_000) },
        );
        if (!upstream.ok) return responseError(res, 502, "Unable to create voice session.");
        res.status(upstream.status).json(await readJson(upstream));
      } catch {
        responseError(res, 502, "Unable to create voice session.");
      }
    }),
  );

  router.post(
    "/:sessionId/messages/:messageId/status",
    asyncHandler(async (req, res) => {
      const { sessionId, messageId } = req.params;
      const status = req.body?.status;
      if (
        !SESSION_ID_PATTERN.test(sessionId) ||
        !MESSAGE_ID_PATTERN.test(messageId) ||
        typeof status !== "string" ||
        !MESSAGE_STATUS_PATTERN.test(status)
      ) {
        return responseError(res, 400, "Invalid voice message status.");
      }
      try {
        const upstream = await fetchImpl(
          sayToMeUrl(`/api/messages/${encodeURIComponent(messageId)}/status`),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status }),
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!upstream.ok) return responseError(res, 502, "Unable to update voice message status.");
        res.status(upstream.status).json(await readJson(upstream));
      } catch {
        responseError(res, 502, "Unable to update voice message status.");
      }
    }),
  );

  router.get(
    "/:sessionId/events",
    asyncHandler(async (req, res) => {
      const { sessionId } = req.params;
      if (!SESSION_ID_PATTERN.test(sessionId))
        return responseError(res, 400, "Invalid voice session id.");
      const controller = new AbortController();
      req.once("close", () => controller.abort());
      try {
        const upstream = await fetchImpl(
          sayToMeUrl(`/api/sessions/${encodeURIComponent(sessionId)}/events`),
          { signal: controller.signal },
        );
        if (upstream.status === 404) return responseError(res, 404, "Voice session not found.");
        if (!upstream.ok || !upstream.body) {
          return responseError(res, 502, "Unable to open voice notes stream.");
        }
        res.status(upstream.status);
        res.setHeader("content-type", upstream.headers.get("content-type") ?? "text/event-stream");
        res.setHeader("cache-control", "no-cache, no-transform");
        res.setHeader("connection", "keep-alive");
        res.setHeader("x-accel-buffering", "no");
        Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream).pipe(
          res,
        );
      } catch {
        if (!res.headersSent) responseError(res, 502, "Unable to open voice notes stream.");
      }
    }),
  );

  return router;
}
