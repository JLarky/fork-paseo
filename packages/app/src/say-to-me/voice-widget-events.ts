export const VOICE_WIDGET_COLLAPSE_EVENT = "say-to-me-collapse-change";
export const VOICE_WIDGET_ERROR_EVENT = "say-to-me-error";
export const VOICE_WIDGET_USAGE_PROMPT_EVENT = "say-to-me-insert-usage-prompt";
export const VOICE_WIDGET_PERMISSION_EVENT = "say-to-me-permission-issue";
export const VOICE_WIDGET_PLAYBACK_EVENT = "say-to-me-playback-change";
export const VOICE_WIDGET_OPEN_SESSION_EVENT = "say-to-me-open-session";
export const VOICE_WIDGET_PARK_SESSION_EVENT = "say-to-me-park-session";

const EVENT_TYPES = new Set([
  "insert-usage-prompt",
  "open-session",
  "park-session",
  "collapse-change",
  "permission-issue",
  "playback-change",
  "error",
]);

interface VoiceWidgetEventDetail {
  readonly source: "say-to-me-widget";
  readonly version: 1;
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface VoiceWidgetEventHandlers {
  readonly onInsertUsagePrompt: (prompt: string) => void;
  readonly onCollapseChange: (collapsed: boolean) => void;
  readonly onError: (message: string) => void;
  readonly onPermissionIssue: (reason: string, noteId: string) => void;
  readonly onPlaybackChange: (playingId: string | null) => void;
  readonly onOpenSession?: (sessionId: string) => void;
  readonly onParkSession?: (sessionId: string) => void;
}

function dispatchVoiceWidgetDetail(
  detail: VoiceWidgetEventDetail,
  handlers: VoiceWidgetEventHandlers,
): void {
  switch (detail.type) {
    case "collapse-change":
      if (typeof detail.collapsed === "boolean") handlers.onCollapseChange(detail.collapsed);
      return;
    case "error":
      if (typeof detail.message === "string") handlers.onError(detail.message);
      return;
    case "insert-usage-prompt":
      if (typeof detail.sessionId === "string" && typeof detail.prompt === "string") {
        handlers.onInsertUsagePrompt(detail.prompt);
      }
      return;
    case "permission-issue":
      if (typeof detail.reason === "string" && typeof detail.noteId === "string") {
        handlers.onPermissionIssue(detail.reason, detail.noteId);
      }
      return;
    case "playback-change":
      if (detail.playingId === null || typeof detail.playingId === "string") {
        handlers.onPlaybackChange(detail.playingId);
      }
      return;
    case "open-session":
      if (typeof detail.sessionId === "string") handlers.onOpenSession?.(detail.sessionId);
      return;
    case "park-session":
      if (typeof detail.sessionId === "string") handlers.onParkSession?.(detail.sessionId);
      return;
  }
}

function readDetail(event: Event): VoiceWidgetEventDetail | null {
  if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== "object") {
    return null;
  }
  const detail = event.detail as Record<string, unknown>;
  if (
    detail.source !== "say-to-me-widget" ||
    detail.version !== 1 ||
    typeof detail.type !== "string" ||
    !EVENT_TYPES.has(detail.type)
  ) {
    return null;
  }
  const expectedType = {
    [VOICE_WIDGET_COLLAPSE_EVENT]: "collapse-change",
    [VOICE_WIDGET_ERROR_EVENT]: "error",
    [VOICE_WIDGET_USAGE_PROMPT_EVENT]: "insert-usage-prompt",
    [VOICE_WIDGET_PERMISSION_EVENT]: "permission-issue",
    [VOICE_WIDGET_PLAYBACK_EVENT]: "playback-change",
    [VOICE_WIDGET_OPEN_SESSION_EVENT]: "open-session",
    [VOICE_WIDGET_PARK_SESSION_EVENT]: "park-session",
  }[event.type];
  if (expectedType !== detail.type) return null;
  return detail as VoiceWidgetEventDetail;
}

export function handleVoiceWidgetEvent(event: Event, handlers: VoiceWidgetEventHandlers): void {
  const detail = readDetail(event);
  if (!detail) return;
  dispatchVoiceWidgetDetail(detail, handlers);
}
