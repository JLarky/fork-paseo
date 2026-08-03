import { afterEach, describe, expect, it } from "vitest";
import { createSayToMeWidgetScriptHandler, SAY_TO_ME_WIDGET_SCRIPT_PATH } from "./widget-script.js";
import { fakeUpstream, listenWithJson, type TestProxyApp } from "./test-utils.js";

describe("Say To Me widget script proxy", () => {
  let app: TestProxyApp | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it("serves the classic widget bundle from the fixed upstream path", async () => {
    process.env.PASEO_SAY_TO_ME_BASE_URL = "http://stm.test:9999";
    try {
      const upstream = fakeUpstream(
        () =>
          new Response("customElements.define('say-to-me-widget', class {});", {
            status: 200,
            headers: {
              "content-type": "text/javascript",
              "cache-control": "no-store",
              "set-cookie": "not-forwarded",
            },
          }),
      );
      app = await listenWithJson((server) => {
        server.get(
          SAY_TO_ME_WIDGET_SCRIPT_PATH,
          createSayToMeWidgetScriptHandler(upstream.fetchImpl),
        );
      });

      const response = await fetch(`${app.baseUrl}${SAY_TO_ME_WIDGET_SCRIPT_PATH}`);

      expect(SAY_TO_ME_WIDGET_SCRIPT_PATH).toBe("/api/say-to-me/embed/widget.js");
      expect(upstream.calls).toHaveLength(1);
      expect(upstream.calls[0]?.url).toBe("http://stm.test:9999/embed/widget.js");
      expect(upstream.calls[0]?.signal).toBeInstanceOf(AbortSignal);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("say-to-me-widget");
      expect(response.headers.get("content-type")).toContain("text/javascript");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("set-cookie")).toBeNull();
    } finally {
      delete process.env.PASEO_SAY_TO_ME_BASE_URL;
    }
  });

  it("returns a stable 502 for upstream failures without leaking details", async () => {
    const failing = fakeUpstream(() => {
      throw new Error("ECONNREFUSED 127.0.0.1:5411 secret-internal-detail");
    });
    app = await listenWithJson((server) => {
      server.get(SAY_TO_ME_WIDGET_SCRIPT_PATH, createSayToMeWidgetScriptHandler(failing.fetchImpl));
    });

    const response = await fetch(`${app.baseUrl}${SAY_TO_ME_WIDGET_SCRIPT_PATH}`);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Unable to load Say To Me widget." });
  });

  it("maps non-ok upstream responses to 502", async () => {
    const upstream = fakeUpstream(() => new Response("boom", { status: 500 }));
    app = await listenWithJson((server) => {
      server.get(
        SAY_TO_ME_WIDGET_SCRIPT_PATH,
        createSayToMeWidgetScriptHandler(upstream.fetchImpl),
      );
    });

    const response = await fetch(`${app.baseUrl}${SAY_TO_ME_WIDGET_SCRIPT_PATH}`);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Unable to load Say To Me widget." });
  });
});
