import { describe, expect, it } from "vitest";
import {
  VOICE_WIDGET_DEV_MODULE_URL,
  VOICE_WIDGET_PROXY_PATH,
  loadVoiceWidget,
  voiceWidgetLoadMode,
} from "./voice-widget-loader";

describe("Say To Me voice widget loader", () => {
  it("uses the STM Vite module only for local development", () => {
    expect(voiceWidgetLoadMode({ isLocalhost: true, isDevelopment: true })).toBe("dev-module");
    expect(VOICE_WIDGET_DEV_MODULE_URL).toBe(
      "http://localhost:5411/server/embed/solid/voice-widget-hmr.ts",
    );
  });

  it("uses the fixed daemon script everywhere else", () => {
    expect(voiceWidgetLoadMode({ isLocalhost: false, isDevelopment: true })).toBe("classic-script");
    expect(voiceWidgetLoadMode({ isLocalhost: true, isDevelopment: false })).toBe("classic-script");
    expect(VOICE_WIDGET_PROXY_PATH).toBe("/api/say-to-me/embed/voice-widget.js");
  });

  it("falls back to the fixed daemon script when direct HMR import fails", async () => {
    const calls: string[] = [];
    await loadVoiceWidget(
      "dev-module",
      VOICE_WIDGET_PROXY_PATH,
      async () => {
        throw new Error("CORS blocked");
      },
      async (src) => {
        calls.push(src);
      },
    );
    expect(calls).toEqual([VOICE_WIDGET_PROXY_PATH]);
  });
});
