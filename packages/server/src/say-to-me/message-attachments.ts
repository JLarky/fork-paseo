import express from "express";
import { sayToMeUrl } from "./base-url.js";

export const SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH = "/api/message-attachments";

type FetchLike = typeof fetch;

const ATTACHMENT_ID_PATTERN = /^[0-9]+$/;
const FORWARDED_HEADERS = ["cache-control", "content-disposition", "content-type", "etag"];

function asyncHandler(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).then(undefined, next);
  };
}

export async function fetchSayToMeMessageAttachment(
  attachmentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  return fetchImpl(sayToMeUrl(`/api/message-attachments/${encodeURIComponent(attachmentId)}`), {
    signal: AbortSignal.timeout(15_000),
  });
}

export function createSayToMeMessageAttachmentsRouter(
  fetchImpl: FetchLike = fetch,
): express.Router {
  const router = express.Router();
  router.get(
    "/:attachmentId",
    asyncHandler(async (req, res) => {
      const { attachmentId } = req.params;
      if (!ATTACHMENT_ID_PATTERN.test(attachmentId)) {
        res.status(400).json({ error: "Invalid message attachment id." });
        return;
      }
      const upstream = await fetchSayToMeMessageAttachment(attachmentId, fetchImpl);
      res.status(upstream.status);
      for (const header of FORWARDED_HEADERS) {
        const value = upstream.headers.get(header);
        if (value) res.setHeader(header, value);
      }
      res.send(Buffer.from(await upstream.arrayBuffer()));
    }),
  );
  return router;
}
