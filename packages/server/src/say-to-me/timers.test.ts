import { afterEach, describe, expect, it } from "vitest";
import { createSayToMeTimersRouter, SAY_TO_ME_TIMERS_PATH } from "./timers.js";
import { fakeUpstream, listenWithJson, type TestProxyApp } from "./test-utils.js";

describe("Say To Me timers proxy", () => {
  let app: TestProxyApp | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
    delete process.env.PASEO_SAY_TO_ME_BASE_URL;
  });

  async function mount(upstream: ReturnType<typeof fakeUpstream>) {
    process.env.PASEO_SAY_TO_ME_BASE_URL = "http://stm.test:9999";
    app = await listenWithJson((server) => {
      server.use(SAY_TO_ME_TIMERS_PATH, createSayToMeTimersRouter(upstream.fetchImpl));
    });
    return app;
  }

  it("maps every widget method to the fixed jarvis-timers paths", async () => {
    const upstream = fakeUpstream(() => new Response("[]", { status: 200 }));
    const { baseUrl } = await mount(upstream);
    const timers = `${baseUrl}${SAY_TO_ME_TIMERS_PATH}`;

    await fetch(timers);
    await fetch(timers, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "tea" }),
    });
    await fetch(`${timers}/42`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "coffee" }),
    });
    await fetch(`${timers}/42`, { method: "DELETE" });
    await fetch(`${timers}/42/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });

    expect(SAY_TO_ME_TIMERS_PATH).toBe("/api/say-to-me-timers");
    expect(upstream.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "GET http://stm.test:9999/api/jarvis-timers",
      "POST http://stm.test:9999/api/jarvis-timers",
      "PATCH http://stm.test:9999/api/jarvis-timers/42",
      "DELETE http://stm.test:9999/api/jarvis-timers/42",
      "POST http://stm.test:9999/api/jarvis-timers/42/actions",
    ]);
    expect(upstream.calls[1]?.body).toBe(JSON.stringify({ label: "tea" }));
    expect(upstream.calls[4]?.body).toBe(JSON.stringify({ action: "pause" }));
  });

  it("forwards only the documented sessionId list filter", async () => {
    const upstream = fakeUpstream(() => new Response("[]", { status: 200 }));
    const { baseUrl } = await mount(upstream);
    const timers = `${baseUrl}${SAY_TO_ME_TIMERS_PATH}`;

    await fetch(`${timers}?sessionId=pa_session-1&debug=1&path=..%2Fetc`);
    await fetch(`${timers}?sessionId=${encodeURIComponent("bad session id!")}`);

    expect(upstream.calls.map((call) => call.url)).toEqual([
      "http://stm.test:9999/api/jarvis-timers?sessionId=pa_session-1",
      "http://stm.test:9999/api/jarvis-timers",
    ]);
  });

  it("rejects non-numeric timer ids without contacting upstream", async () => {
    const upstream = fakeUpstream(() => new Response("[]", { status: 200 }));
    const { baseUrl } = await mount(upstream);

    const patch = await fetch(`${baseUrl}${SAY_TO_ME_TIMERS_PATH}/not-a-number`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const action = await fetch(
      `${baseUrl}${SAY_TO_ME_TIMERS_PATH}/${encodeURIComponent("../escape")}/actions`,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    );

    expect(patch.status).toBe(400);
    expect(action.status).toBe(400);
    expect(upstream.calls).toHaveLength(0);
  });

  it("returns a stable 502 when upstream is unreachable", async () => {
    const upstream = fakeUpstream(() => Promise.reject(new Error("connect ECONNREFUSED")));
    const { baseUrl } = await mount(upstream);

    const response = await fetch(`${baseUrl}${SAY_TO_ME_TIMERS_PATH}`);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Unable to reach Say To Me timers." });
  });
});
