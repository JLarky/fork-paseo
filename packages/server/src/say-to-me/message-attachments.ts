import express from "express";
import { sayToMeUrl } from "./base-url.js";
import {
  asyncProxyHandler,
  forwardSafeHeaders,
  SAY_TO_ME_UPSTREAM_TIMEOUT_MS,
  sendProxyError,
  type FetchLike,
} from "./proxy-util.js";

export const SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH = "/api/message-attachments";

const ATTACHMENT_ID_PATTERN = /^[0-9]+$/;
const FORWARDED_HEADERS = ["cache-control", "content-disposition", "content-type", "etag"];

export function createSayToMeMessageAttachmentsRouter(
  fetchImpl: FetchLike = fetch,
): express.Router {
  const router = express.Router();

  router.get(
    "/:attachmentId",
    asyncProxyHandler(async (req, res) => {
      const { attachmentId } = req.params;
      if (!ATTACHMENT_ID_PATTERN.test(attachmentId)) {
        sendProxyError(res, 400, "Invalid message attachment id.");
        return;
      }
      const upstream = await fetchImpl(
        sayToMeUrl(`/api/message-attachments/${encodeURIComponent(attachmentId)}`),
        { signal: AbortSignal.timeout(SAY_TO_ME_UPSTREAM_TIMEOUT_MS) },
      );
      if (upstream.status === 404) {
        sendProxyError(res, 404, "Message attachment not found.");
        return;
      }
      if (!upstream.ok) {
        sendProxyError(res, 502, "Unable to load message attachment.");
        return;
      }
      res.status(upstream.status);
      forwardSafeHeaders(res, upstream, FORWARDED_HEADERS);
      res.send(Buffer.from(await upstream.arrayBuffer()));
    }, "Unable to load message attachment."),
  );

  return router;
}
