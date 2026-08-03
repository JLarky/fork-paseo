import { describe, expect, it } from "vitest";
import {
  handleVoiceWidgetEvent,
  VOICE_WIDGET_OPEN_SESSION_EVENT,
  VOICE_WIDGET_PARK_SESSION_EVENT,
} from "./voice-widget-events";

function widgetEvent(detail: Record<string, unknown>): Event {
  const eventName = {
    "collapse-change": "say-to-me-collapse-change",
    error: "say-to-me-error",
    "insert-usage-prompt": "say-to-me-insert-usage-prompt",
    "permission-issue": "say-to-me-permission-issue",
    "playback-change": "say-to-me-playback-change",
  }[String(detail.type)];
  return new CustomEvent(eventName ?? "say-to-me-event", { detail });
}

describe("Say To Me voice widget events", () => {
  it("accepts only the STM source/version envelope", () => {
    const calls: string[] = [];
    const handlers = {
      onInsertUsagePrompt: (prompt: string) => calls.push(prompt),
      onCollapseChange: (collapsed: boolean) => calls.push(String(collapsed)),
      onError: (message: string) => calls.push(message),
      onPermissionIssue: (reason: string, noteId: string) => calls.push(`${reason}:${noteId}`),
      onPlaybackChange: (playingId: string | null) => calls.push(String(playingId)),
    };

    handleVoiceWidgetEvent(
      widgetEvent({
        source: "say-to-me-widget",
        version: 1,
        type: "collapse-change",
        collapsed: true,
      }),
      handlers,
    );
    handleVoiceWidgetEvent(
      new CustomEvent("say-to-me-collapse-change", {
        detail: { source: "other", version: 1, type: "collapse-change", collapsed: false },
      }),
      handlers,
    );

    expect(calls).toEqual(["true"]);
  });

  it("routes fields defined by the frozen event names without accepting malformed details", () => {
    const calls: string[] = [];
    const handlers = {
      onInsertUsagePrompt: (prompt: string) => calls.push(`prompt:${prompt}`),
      onCollapseChange: (collapsed: boolean) => calls.push(`collapse:${collapsed}`),
      onError: (message: string) => calls.push(`error:${message}`),
      onPermissionIssue: (reason: string, noteId: string) =>
        calls.push(`permission:${reason}:${noteId}`),
      onPlaybackChange: (playingId: string | null) => calls.push(`playback:${playingId}`),
    };

    handleVoiceWidgetEvent(
      widgetEvent({
        source: "say-to-me-widget",
        version: 1,
        type: "insert-usage-prompt",
        sessionId: "pa_session",
        prompt: "draft",
      }),
      handlers,
    );
    handleVoiceWidgetEvent(
      widgetEvent({ source: "say-to-me-widget", version: 1, type: "error", message: "broken" }),
      handlers,
    );
    handleVoiceWidgetEvent(
      new CustomEvent("say-to-me-error", {
        detail: { source: "say-to-me-widget", version: 1, type: "error", message: 42 },
      }),
      handlers,
    );
    handleVoiceWidgetEvent(
      new CustomEvent("say-to-me-permission-issue", {
        detail: {
          source: "say-to-me-widget",
          version: 1,
          type: "permission-issue",
          reason: "not-allowed",
          noteId: "7",
        },
      }),
      handlers,
    );
    handleVoiceWidgetEvent(
      new CustomEvent("say-to-me-playback-change", {
        detail: {
          source: "say-to-me-widget",
          version: 1,
          type: "playback-change",
          playingId: null,
        },
      }),
      handlers,
    );

    expect(calls).toEqual([
      "prompt:draft",
      "error:broken",
      "permission:not-allowed:7",
      "playback:null",
    ]);
  });

  it("routes the allowed open and park events when they include a session id", () => {
    const opened: string[] = [];
    const parked: string[] = [];
    const handlers = {
      onInsertUsagePrompt: () => undefined,
      onCollapseChange: () => undefined,
      onError: () => undefined,
      onPermissionIssue: () => undefined,
      onPlaybackChange: () => undefined,
      onOpenSession: (sessionId: string) => opened.push(sessionId),
      onParkSession: (sessionId: string) => parked.push(sessionId),
    };

    handleVoiceWidgetEvent(
      new CustomEvent(VOICE_WIDGET_OPEN_SESSION_EVENT, {
        detail: {
          source: "say-to-me-widget",
          version: 1,
          type: "open-session",
          sessionId: "pa_current",
        },
      }),
      handlers,
    );
    handleVoiceWidgetEvent(
      new CustomEvent(VOICE_WIDGET_PARK_SESSION_EVENT, {
        detail: {
          source: "say-to-me-widget",
          version: 1,
          type: "park-session",
          sessionId: "pa_current",
        },
      }),
      handlers,
    );

    expect(opened).toEqual(["pa_current"]);
    expect(parked).toEqual(["pa_current"]);
  });
});
