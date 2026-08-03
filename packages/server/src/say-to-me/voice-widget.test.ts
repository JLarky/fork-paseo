import { describe, expect, it } from "vitest";
import { fetchSayToMeVoiceWidget, SAY_TO_ME_VOICE_WIDGET_PATH } from "./voice-widget";
import { sayToMeBaseUrl, sayToMeUrl } from "./base-url";

describe("Say To Me voice widget proxy", () => {
  it("constructs fixed upstream URLs without accepting a caller-supplied path", () => {
    expect(sayToMeBaseUrl({ PASEO_SAY_TO_ME_BASE_URL: "http://localhost:5411/" })).toBe(
      "http://localhost:5411",
    );
    expect(sayToMeUrl("/embed/voice-widget.js", "http://localhost:5411")).toBe(
      "http://localhost:5411/embed/voice-widget.js",
    );
  });

  it("exposes one fixed script path", () => {
    expect(SAY_TO_ME_VOICE_WIDGET_PATH).toBe("/api/say-to-me/embed/voice-widget.js");
  });

  it("forwards only safe script/cache headers and the upstream body", async () => {
    const response = await fetchSayToMeVoiceWidget(
      async () =>
        new Response("custom-element-script", {
          status: 200,
          headers: {
            "content-type": "text/javascript",
            "cache-control": "no-store",
            "set-cookie": "not-forwarded",
          },
        }),
    );

    expect(await response.text()).toBe("custom-element-script");
    expect(response.headers.get("content-type")).toBe("text/javascript");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
