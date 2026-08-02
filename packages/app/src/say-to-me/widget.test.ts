import { describe, expect, it } from "vitest";

import {
  isSayToMeParkSessionDetail,
  isSayToMeParkSessionEvent,
  resolveSayToMeWidgetClassicModuleUrl,
  resolveSayToMeWidgetHmrModuleUrl,
  SAY_TO_ME_PARK_SESSION_EVENT,
  SAY_TO_ME_WIDGET_TAG,
} from "./widget";

describe("Say To Me widget host adapter", () => {
  it("uses the current STM generic widget and local HMR entry", () => {
    expect(SAY_TO_ME_WIDGET_TAG).toBe("say-to-me-widget");
    expect(
      resolveSayToMeWidgetHmrModuleUrl({
        isDev: true,
        hostname: "localhost",
        stmOrigin: "http://localhost:5411",
      }),
    ).toBe("http://localhost:5411/server/embed/solid/widget-hmr.ts");
    expect(resolveSayToMeWidgetClassicModuleUrl()).toBe("http://localhost:5411/embed/widget.js");
  });

  it("does not direct-load HMR from a production or non-local page", () => {
    expect(
      resolveSayToMeWidgetHmrModuleUrl({
        isDev: false,
        hostname: "localhost",
        stmOrigin: "http://localhost:5411",
      }),
    ).toBeNull();
    expect(
      resolveSayToMeWidgetHmrModuleUrl({
        isDev: true,
        hostname: "example.test",
        stmOrigin: "http://localhost:5411",
      }),
    ).toBeNull();
  });

  it("accepts only STM's exact Park event payload for the mounted session", () => {
    const sessionId = "pa_agent-1";
    const event = new CustomEvent(SAY_TO_ME_PARK_SESSION_EVENT, {
      detail: {
        source: "say-to-me-widget",
        version: 1,
        type: "park-session",
        sessionId,
      },
    });
    expect(isSayToMeParkSessionDetail(event.detail, sessionId)).toBe(true);
    expect(isSayToMeParkSessionEvent(event, sessionId)).toBe(true);
    expect(isSayToMeParkSessionDetail({ ...event.detail, sessionId: "pa_other" }, sessionId)).toBe(
      false,
    );
    expect(isSayToMeParkSessionDetail({ ...event.detail, source: "other" }, sessionId)).toBe(false);
  });
});
