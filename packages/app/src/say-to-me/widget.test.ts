import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assignParkSessionFromEvent,
  assignParkSessionUrl,
  buildParkSessionUrl,
  getSayToMeWidgetAttributes,
  isSayToMeParkSessionDetail,
  isSayToMeParkSessionEvent,
  resolveSayToMeWidgetHmrModuleUrl,
  SAY_TO_ME_PARK_SESSION_EVENT,
  SAY_TO_ME_WIDGET_BANNER_API_VERSION,
  SAY_TO_ME_WIDGET_HOST_STYLE,
  SAY_TO_ME_WIDGET_NOTES_BASE_URL,
  SAY_TO_ME_WIDGET_PARK_SESSION_VERSION,
  SAY_TO_ME_WIDGET_SRC,
  SAY_TO_ME_WIDGET_STORAGE_KEY,
  SAY_TO_ME_WIDGET_TAG,
} from "./widget";
import { resolveSayToMeWidgetUiBaseUrl } from "./sayToMeUi";

describe("Say To Me widget host adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses same-origin data and classic routes, not the upstream port", () => {
    expect(SAY_TO_ME_WIDGET_SRC).toBe("/api/say-to-me/embed/widget.js");
    expect(SAY_TO_ME_WIDGET_TAG).toBe("say-to-me-widget");
    expect(getSayToMeWidgetAttributes("pa_agent-1", "")).toEqual({
      "session-id": "pa_agent-1",
      "notes-base-url": SAY_TO_ME_WIDGET_NOTES_BASE_URL,
      "timers-base-url": "/api/say-to-me-timers",
      "ui-base-url": "",
      "storage-key": SAY_TO_ME_WIDGET_STORAGE_KEY,
    });
    expect(getSayToMeWidgetAttributes("pa_agent-1")["notes-base-url"]).not.toContain("5411");
  });

  it("uses the canonical local STM HMR entry and blocks it elsewhere", async () => {
    const moduleUrl = resolveSayToMeWidgetHmrModuleUrl({
      isDev: true,
      hostname: "localhost",
      stmOrigin: "http://localhost:5411",
    });
    expect(moduleUrl).toBe("http://localhost:5411/server/embed/solid/widget-hmr.ts");

    expect(
      resolveSayToMeWidgetHmrModuleUrl({
        isDev: true,
        hostname: "tailnet.example",
        stmOrigin: "http://localhost:5411",
      }),
    ).toBeNull();
    expect(
      resolveSayToMeWidgetHmrModuleUrl({
        isDev: false,
        hostname: "localhost",
        stmOrigin: "http://localhost:5411",
      }),
    ).toBeNull();
  });

  it("keeps UI base resolution separate from same-origin data routes", () => {
    expect(
      resolveSayToMeWidgetUiBaseUrl({ hostname: "localhost", origin: "http://localhost:6770" }),
    ).toBeNull();
    expect(
      resolveSayToMeWidgetUiBaseUrl({
        configuredUrl: "https://say.example.test:1311/base/ignored",
        hostname: "tailnet.example",
      }),
    ).toBe("https://say.example.test:1311");
    expect(
      resolveSayToMeWidgetUiBaseUrl({
        hostname: "say.localhost",
        origin: "https://say.localhost:1311",
      }),
    ).toBe("https://say.localhost:1311");
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

  it("accepts only STM's exact Park event for the mounted session", () => {
    const sessionId = "pa_agent-1";
    const detail = {
      source: "say-to-me-widget",
      version: SAY_TO_ME_WIDGET_PARK_SESSION_VERSION,
      type: "park-session",
      sessionId,
    } as const;
    const event = new CustomEvent(SAY_TO_ME_PARK_SESSION_EVENT, { detail });

    expect(isSayToMeParkSessionDetail(detail, sessionId)).toBe(true);
    expect(isSayToMeParkSessionEvent(event, sessionId)).toBe(true);
    expect(isSayToMeParkSessionDetail({ ...detail, source: "other" }, sessionId)).toBe(false);
    expect(
      isSayToMeParkSessionDetail(
        { ...detail, version: SAY_TO_ME_WIDGET_BANNER_API_VERSION },
        sessionId,
      ),
    ).toBe(false);
    expect(isSayToMeParkSessionDetail({ ...detail, sessionId: " " }, sessionId)).toBe(false);
    expect(isSayToMeParkSessionEvent(new CustomEvent("other-event", { detail }), sessionId)).toBe(
      false,
    );
    expect(isSayToMeParkSessionEvent(new Event(SAY_TO_ME_PARK_SESSION_EVENT), sessionId)).toBe(
      false,
    );
  });

  it("builds the exact static Park document URL and omits blank optional fields", () => {
    expect(
      buildParkSessionUrl(
        {
          environmentId: "server with spaces",
          threadId: "agent/1",
          title: "Fix parking",
          project: "paseo",
          cwd: "/home/ylapin/work/fork-paseo",
          branch: "feat/stm-park",
        },
        "https://paseo.example",
      ).toString(),
    ).toBe(
      "https://paseo.example/park.html?environmentId=server+with+spaces&threadId=agent%2F1&title=Fix+parking&project=paseo&cwd=%2Fhome%2Fylapin%2Fwork%2Ffork-paseo&branch=feat%2Fstm-park",
    );
    expect(
      buildParkSessionUrl(
        { environmentId: "server-1", threadId: "agent-1", title: " ", branch: "" },
        "https://paseo.example",
      ).toString(),
    ).toBe("https://paseo.example/park.html?environmentId=server-1&threadId=agent-1");
  });

  it("hard-navigates only for a valid nonblank matching Park event", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { origin: "https://paseo.example", assign } });
    const context = { environmentId: "server-1", threadId: "agent-1", cwd: "/repo" };
    const validEvent = new CustomEvent(SAY_TO_ME_PARK_SESSION_EVENT, {
      detail: {
        source: "say-to-me-widget",
        version: SAY_TO_ME_WIDGET_PARK_SESSION_VERSION,
        type: "park-session",
        sessionId: "pa_agent-1",
      },
    });

    expect(assignParkSessionFromEvent(validEvent, "pa_agent-1", context)).toBe(true);
    expect(assign).toHaveBeenCalledWith(
      new URL(
        "https://paseo.example/park.html?environmentId=server-1&threadId=agent-1&cwd=%2Frepo",
      ),
    );

    assign.mockClear();
    expect(assignParkSessionFromEvent(validEvent, "", context)).toBe(false);
    expect(assignParkSessionFromEvent(validEvent, "pa_other", context)).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("uses window.location.assign for direct Park navigation", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { origin: "https://paseo.example", assign } });
    assignParkSessionUrl({ environmentId: "server-1", threadId: "agent-1" });
    expect(assign).toHaveBeenCalledOnce();
  });
});
