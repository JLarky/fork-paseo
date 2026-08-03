import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestPaseoDaemon, type TestPaseoDaemon } from "./test-utils/paseo-daemon.js";

const SESSION_ID = "pa_2f9c1a34-56b7-4c89-9d01-23e456f789ab";

interface UpstreamRequest {
  method: string;
  url: string;
  body: string;
}

function stubSayToMeUpstream(requests: UpstreamRequest[]): http.RequestListener {
  return (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      requests.push({
        method: req.method ?? "",
        url: req.url ?? "",
        body: Buffer.concat(chunks).toString("utf-8"),
      });
      if (req.url === "/embed/widget.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        res.end("// stub say-to-me widget bundle");
        return;
      }
      if (req.url === "/api/messages/5/status" && req.method === "POST") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
  };
}

describe("bootstrap Say To Me proxy mounting", () => {
  let daemon: TestPaseoDaemon;
  let upstream: http.Server;
  const upstreamRequests: UpstreamRequest[] = [];
  let previousBaseUrl: string | undefined;

  beforeAll(async () => {
    upstream = http.createServer(stubSayToMeUpstream(upstreamRequests));
    upstream.listen(0, "127.0.0.1");
    await once(upstream, "listening");
    const { port } = upstream.address() as AddressInfo;
    previousBaseUrl = process.env.PASEO_SAY_TO_ME_BASE_URL;
    process.env.PASEO_SAY_TO_ME_BASE_URL = `http://127.0.0.1:${port}`;
    daemon = await createTestPaseoDaemon();
  });

  afterAll(async () => {
    if (previousBaseUrl === undefined) delete process.env.PASEO_SAY_TO_ME_BASE_URL;
    else process.env.PASEO_SAY_TO_ME_BASE_URL = previousBaseUrl;
    await daemon?.close();
    await new Promise<void>((resolve, reject) => {
      upstream.closeAllConnections();
      upstream.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it("serves the widget bundle through the daemon", async () => {
    const response = await fetch(`http://127.0.0.1:${daemon.port}/api/say-to-me/embed/widget.js`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("stub say-to-me widget bundle");
  });

  it("parses JSON bodies for the status route mounted behind the API layer", async () => {
    const response = await fetch(
      `http://127.0.0.1:${daemon.port}/api/voice-notes/${SESSION_ID}/messages/5/status`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "played" }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const statusRequest = upstreamRequests.find((request) =>
      request.url.endsWith("/api/messages/5/status"),
    );
    expect(statusRequest?.body).toBe(JSON.stringify({ status: "played" }));
  });

  it("rejects invalid input before any upstream call", async () => {
    const before = upstreamRequests.length;
    const response = await fetch(`http://127.0.0.1:${daemon.port}/api/voice-notes/not-a-session`);

    expect(response.status).toBe(400);
    expect(upstreamRequests.length).toBe(before);
  });
});
