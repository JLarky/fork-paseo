import { afterEach, describe, expect, it } from "vitest";
import { createSayToMeVoiceNotesRouter, SAY_TO_ME_VOICE_NOTES_PATH } from "./voice-notes.js";
import { fakeUpstream, listenWithJson, type TestProxyApp } from "./test-utils.js";

const SESSION_ID = "pa_2f9c1a34-56b7-4c89-9d01-23e456f789ab";

describe("Say To Me voice notes proxy", () => {
  let app: TestProxyApp | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
    delete process.env.PASEO_SAY_TO_ME_BASE_URL;
  });

  async function mount(upstream: ReturnType<typeof fakeUpstream>) {
    process.env.PASEO_SAY_TO_ME_BASE_URL = "http://stm.test:9999";
    app = await listenWithJson((server) => {
      server.use(SAY_TO_ME_VOICE_NOTES_PATH, createSayToMeVoiceNotesRouter(upstream.fetchImpl));
    });
    return app;
  }

  it("loads messages for a valid pa_ session id", async () => {
    const upstream = fakeUpstream(
      () => new Response(JSON.stringify({ messages: [{ id: 1 }] }), { status: 200 }),
    );
    const { baseUrl } = await mount(upstream);

    const response = await fetch(`${baseUrl}/api/voice-notes/${SESSION_ID}`);

    expect(upstream.calls[0]?.url).toBe(`http://stm.test:9999/api/sessions/${SESSION_ID}/messages`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messages: [{ id: 1 }] });
  });

  it("rejects invalid session ids without contacting upstream", async () => {
    const upstream = fakeUpstream(() => new Response("{}"));
    const { baseUrl } = await mount(upstream);

    for (const bad of ["pc_room", "pa_notauuid", "..%2Fetc", "pa_"]) {
      const response = await fetch(`${baseUrl}/api/voice-notes/${encodeURIComponent(bad)}`);
      expect(response.status).toBe(400);
    }
    expect(upstream.calls).toHaveLength(0);
  });

  it("creates sessions via import, forwarding only a validated instanceId", async () => {
    const upstream = fakeUpstream(() => new Response("{}", { status: 200 }));
    const { baseUrl } = await mount(upstream);

    await fetch(`${baseUrl}/api/voice-notes/${SESSION_ID}`, { method: "POST" });
    await fetch(`${baseUrl}/api/voice-notes/${SESSION_ID}?instanceId=worktree`, {
      method: "POST",
    });
    const invalid = await fetch(
      `${baseUrl}/api/voice-notes/${SESSION_ID}?instanceId=${encodeURIComponent("../evil")}`,
      { method: "POST" },
    );

    expect(upstream.calls.map((call) => call.url)).toEqual([
      `http://stm.test:9999/api/sessions/${SESSION_ID}/import`,
      `http://stm.test:9999/api/sessions/${SESSION_ID}/import?instanceId=worktree`,
    ]);
    expect(upstream.calls.every((call) => call.method === "POST")).toBe(true);
    expect(invalid.status).toBe(400);
  });

  it("forwards only the exact allowed message statuses", async () => {
    const upstream = fakeUpstream(() => new Response("{}", { status: 200 }));
    const { baseUrl } = await mount(upstream);
    const statusUrl = `${baseUrl}/api/voice-notes/${SESSION_ID}/messages/42/status`;

    const played = await fetch(statusUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "played" }),
    });
    const rejectedStatus = await fetch(statusUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "deleted" }),
    });
    const rejectedMessageId = await fetch(
      `${baseUrl}/api/voice-notes/${SESSION_ID}/messages/not-a-number/status`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "played" }),
      },
    );

    expect(played.status).toBe(200);
    expect(upstream.calls).toHaveLength(1);
    expect(upstream.calls[0]?.url).toBe("http://stm.test:9999/api/messages/42/status");
    expect(upstream.calls[0]?.body).toBe(JSON.stringify({ status: "played" }));
    expect(rejectedStatus.status).toBe(400);
    expect(rejectedMessageId.status).toBe(400);
  });

  it("maps upstream 404s and failures to stable statuses", async () => {
    const upstream = fakeUpstream((call) =>
      call.url.endsWith("/messages")
        ? new Response("missing", { status: 404 })
        : Promise.reject(new Error("network down")),
    );
    const { baseUrl } = await mount(upstream);

    const notFound = await fetch(`${baseUrl}/api/voice-notes/${SESSION_ID}`);
    const failed = await fetch(`${baseUrl}/api/voice-notes/${SESSION_ID}`, { method: "POST" });

    expect(notFound.status).toBe(404);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "Unable to create voice session." });
  });

  it("streams SSE without buffering and aborts upstream on client disconnect", async () => {
    let upstreamSignal: AbortSignal | null | undefined;
    let firstChunkSent: (() => void) | undefined;
    const firstChunk = new Promise<void>((resolve) => {
      firstChunkSent = resolve;
    });
    const upstream = fakeUpstream((call) => {
      upstreamSignal = call.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: first\n\n"));
          firstChunkSent?.();
          // Held open: only the proxied client disconnect may end this stream.
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });
    const { baseUrl } = await mount(upstream);

    const clientAbort = new AbortController();
    const response = await fetch(`${baseUrl}/api/voice-notes/${SESSION_ID}/events`, {
      signal: clientAbort.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(upstream.calls[0]?.url).toBe(`http://stm.test:9999/api/sessions/${SESSION_ID}/events`);

    await firstChunk;
    const reader = response.body?.getReader();
    const first = await reader?.read();
    expect(new TextDecoder().decode(first?.value)).toBe("data: first\n\n");

    const upstreamAborted = new Promise<void>((resolve) => {
      upstreamSignal?.addEventListener("abort", () => resolve(), { once: true });
    });
    clientAbort.abort();
    await upstreamAborted;
    expect(upstreamSignal?.aborted).toBe(true);
  });
});
