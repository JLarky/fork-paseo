import express from "express";
import { sayToMeUrl } from "./base-url.js";

export const SAY_TO_ME_VOICE_WIDGET_PATH = "/api/say-to-me/embed/voice-widget.js";
const FORWARDED_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "expires",
  "last-modified",
  "vary",
];

type FetchLike = typeof fetch;

export async function fetchSayToMeVoiceWidget(fetchImpl: FetchLike = fetch): Promise<Response> {
  const upstream = await fetchImpl(sayToMeUrl("/embed/voice-widget.js"), {
    signal: AbortSignal.timeout(15_000),
  });
  const headers = new Headers();
  for (const header of FORWARDED_HEADERS) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
}

export function createSayToMeVoiceWidgetRouter(fetchImpl: FetchLike = fetch): express.Router {
  const router = express.Router();
  router.get(SAY_TO_ME_VOICE_WIDGET_PATH, (req, res) => {
    if (req.method !== "GET") {
      res.status(404).end();
      return;
    }
    fetchSayToMeVoiceWidget(fetchImpl).then(
      (response) => {
        res.status(response.status);
        response.headers.forEach((value, header) => res.setHeader(header, value));
        return response.arrayBuffer().then(
          (body) => res.send(Buffer.from(body)),
          () => res.status(502).json({ error: "Unable to load Say To Me voice widget." }),
        );
      },
      () => {
        res.status(502).json({ error: "Unable to load Say To Me voice widget." });
      },
    );
  });
  return router;
}
