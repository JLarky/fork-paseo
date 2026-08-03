import { describe, expect, it } from "vitest";

import {
  isSayToMeParkSessionDetail,
  isSayToMeParkSessionEvent,
  getSayToMeWidgetAttributes,
  resolveSayToMeWidgetClassicModuleUrl,
  resolveSayToMeWidgetHmrModuleUrl,
  SAY_TO_ME_PARK_SESSION_EVENT,
  SAY_TO_ME_WIDGET_BANNER_API_VERSION,
  SAY_TO_ME_WIDGET_HOST_STYLE,
  SAY_TO_ME_WIDGET_NOTES_BASE_URL,
  SAY_TO_ME_WIDGET_PARK_SESSION_VERSION,
  SAY_TO_ME_WIDGET_STORAGE_KEY,
  SAY_TO_ME_WIDGET_TAG,
} from "./widget";

describe("Say To Me widget host adapter", () => {
  it("uses the current STM generic widget and local HMR entry", () => {
    expect(SAY_TO_ME_WIDGET_TAG).toBe("say-to-me-widget");
    expect(
      resolveSayToMeWidgetHmrModuleUrl({
        isDev: true,
        hostname: "localhost",
        stmOrigin: "http://localhost:5511",
      }),
    ).toBe("http://localhost:5511/server/embed/solid/widget-hmr.ts");
    expect(resolveSayToMeWidgetClassicModuleUrl()).toBe("http://localhost:5511/embed/widget.js");
  });

  it("mounts the STM v2 contract without sharing T3 collapse state", () => {
    expect(SAY_TO_ME_WIDGET_BANNER_API_VERSION).toBe(2);
    expect(SAY_TO_ME_WIDGET_PARK_SESSION_VERSION).toBe(1);
    expect(getSayToMeWidgetAttributes("pa_agent-1")).toEqual({
      "session-id": "pa_agent-1",
      "notes-base-url": SAY_TO_ME_WIDGET_NOTES_BASE_URL,
      "timers-base-url": "http://localhost:5511/api/say-to-me-timers",
      "ui-base-url": "http://localhost:5511",
      "storage-key": SAY_TO_ME_WIDGET_STORAGE_KEY,
    });
    expect(SAY_TO_ME_WIDGET_STORAGE_KEY).not.toBe("t3code:say-to-me-banner-collapsed:v1");
  });

  it("uses a full-width positioned block host for STM's collapsed anchor", () => {
    expect(SAY_TO_ME_WIDGET_HOST_STYLE).toEqual({
      position: "relative",
      display: "block",
      width: "100%",
      minWidth: 0,
      flexShrink: 0,
    });
  });

  it("does not direct-load HMR from a production or non-local page", () => {
    expect(
      resolveSayToMeWidgetHmrModuleUrl({
        isDev: false,
        hostname: "localhost",
        stmOrigin: "http://localhost:5511",
      }),
    ).toBeNull();
    expect(
      resolveSayToMeWidgetHmrModuleUrl({
        isDev: true,
        hostname: "example.test",
        stmOrigin: "http://localhost:5511",
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
