import { Readable } from "node:stream";
import express from "express";
import { sayToMeUrl } from "./base-url.js";
import {
  asyncProxyHandler,
  SAY_TO_ME_UPSTREAM_TIMEOUT_MS,
  sendProxyError,
  type FetchLike,
} from "./proxy-util.js";

export const SAY_TO_ME_VOICE_NOTES_PATH = "/api/voice-notes";

const SESSION_ID_PATTERN = /^pa_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_ID_PATTERN = /^[0-9]+$/;
const INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MESSAGE_STATUSES = new Set(["queued", "speaking", "played", "stopped"]);

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
    asyncProxyHandler(async (req, res) => {
      const { sessionId } = req.params;
      if (!SESSION_ID_PATTERN.test(sessionId)) {
        sendProxyError(res, 400, "Invalid voice session id.");
        return;
      }
      const upstream = await fetchImpl(
        sayToMeUrl(`/api/sessions/${encodeURIComponent(sessionId)}/messages`),
        { signal: AbortSignal.timeout(SAY_TO_ME_UPSTREAM_TIMEOUT_MS) },
      );
      if (upstream.status === 404) {
        sendProxyError(res, 404, "Voice session not found.");
        return;
      }
      if (!upstream.ok) {
        sendProxyError(res, 502, "Unable to load voice notes.");
        return;
      }
      res.status(upstream.status).json(await readJson(upstream));
    }, "Unable to load voice notes."),
  );

  router.post(
    "/:sessionId",
    asyncProxyHandler(async (req, res) => {
      const { sessionId } = req.params;
      if (!SESSION_ID_PATTERN.test(sessionId)) {
        sendProxyError(res, 400, "Invalid voice session id.");
        return;
      }
      const instanceId = typeof req.query.instanceId === "string" ? req.query.instanceId : null;
      if (instanceId !== null && !INSTANCE_ID_PATTERN.test(instanceId)) {
        sendProxyError(res, 400, "Invalid instance id.");
        return;
      }
      const query = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : "";
      const upstream = await fetchImpl(
        sayToMeUrl(`/api/sessions/${encodeURIComponent(sessionId)}/import${query}`),
        { method: "POST", signal: AbortSignal.timeout(SAY_TO_ME_UPSTREAM_TIMEOUT_MS) },
      );
      if (!upstream.ok) {
        sendProxyError(res, 502, "Unable to create voice session.");
        return;
      }
      res.status(upstream.status).json(await readJson(upstream));
    }, "Unable to create voice session."),
  );

  router.post(
    "/:sessionId/messages/:messageId/status",
    asyncProxyHandler(async (req, res) => {
      const { sessionId, messageId } = req.params;
      const status: unknown = (req.body as { status?: unknown } | undefined)?.status;
      if (
        !SESSION_ID_PATTERN.test(sessionId) ||
        !MESSAGE_ID_PATTERN.test(messageId) ||
        typeof status !== "string" ||
        !MESSAGE_STATUSES.has(status)
      ) {
        sendProxyError(res, 400, "Invalid voice message status.");
        return;
      }
      const upstream = await fetchImpl(
        sayToMeUrl(`/api/messages/${encodeURIComponent(messageId)}/status`),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
          signal: AbortSignal.timeout(SAY_TO_ME_UPSTREAM_TIMEOUT_MS),
        },
      );
      if (!upstream.ok) {
        sendProxyError(res, 502, "Unable to update voice message status.");
        return;
      }
      res.status(upstream.status).json(await readJson(upstream));
    }, "Unable to update voice message status."),
  );

  router.get(
    "/:sessionId/events",
    asyncProxyHandler(async (req, res) => {
      const { sessionId } = req.params;
      if (!SESSION_ID_PATTERN.test(sessionId)) {
        sendProxyError(res, 400, "Invalid voice session id.");
        return;
      }
      // SSE: no upstream timeout; the client disconnect is the only terminator.
      const controller = new AbortController();
      req.once("close", () => controller.abort());
      const upstream = await fetchImpl(
        sayToMeUrl(`/api/sessions/${encodeURIComponent(sessionId)}/events`),
        { signal: controller.signal },
      );
      if (upstream.status === 404) {
        sendProxyError(res, 404, "Voice session not found.");
        return;
      }
      if (!upstream.ok || !upstream.body) {
        sendProxyError(res, 502, "Unable to open voice notes stream.");
        return;
      }
      res.status(upstream.status);
      res.setHeader("content-type", upstream.headers.get("content-type") ?? "text/event-stream");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      res.setHeader("x-accel-buffering", "no");
      res.flushHeaders();
      const body = Readable.fromWeb(
        upstream.body as unknown as import("node:stream/web").ReadableStream,
      );
      body.on("error", () => res.destroy());
      body.pipe(res);
    }, "Unable to open voice notes stream."),
  );

  return router;
}
