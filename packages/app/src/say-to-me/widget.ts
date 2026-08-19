/** Host adapter for Say To Me's STM-owned `<say-to-me-widget>`. */

import { resolveSayToMeWidgetUiBaseUrl } from "./sayToMeUi";

export const SAY_TO_ME_WIDGET_TAG = "say-to-me-widget" as const;
export const SAY_TO_ME_WIDGET_SRC = "/api/say-to-me/embed/widget.js" as const;
export const SAY_TO_ME_WIDGET_NOTES_BASE_URL = "/api/voice-notes" as const;
export const SAY_TO_ME_WIDGET_TIMERS_BASE_URL = "/api/say-to-me-timers" as const;
export const SAY_TO_ME_WIDGET_BANNER_API_VERSION = 2 as const;
export const SAY_TO_ME_WIDGET_PARK_SESSION_VERSION = 1 as const;
export const SAY_TO_ME_WIDGET_USAGE_PROMPT_VERSION = 2 as const;
export const SAY_TO_ME_PARK_SESSION_EVENT = "say-to-me-park-session" as const;
export const SAY_TO_ME_USAGE_PROMPT_EVENT = "say-to-me-insert-usage-prompt" as const;
export const SAY_TO_ME_WIDGET_STORAGE_KEY = "paseo:say-to-me-widget-collapsed:v1" as const;
export const SAY_TO_ME_WIDGET_CAPABILITY_ATTRIBUTE = "data-banner-api-version" as const;

const SAY_TO_ME_WIDGET_HMR_PATH = "/server/embed/solid/widget-hmr.ts";
const WIDGET_SOURCE = "say-to-me-widget";
const PARK_SESSION_TYPE = "park-session";
const USAGE_PROMPT_TYPE = "insert-usage-prompt";

export interface ParkSessionContext {
  readonly environmentId: string;
  readonly threadId: string;
  readonly title?: string | null | undefined;
  readonly project?: string | null | undefined;
  readonly cwd?: string | null | undefined;
  readonly branch?: string | null | undefined;
}

export const SAY_TO_ME_WIDGET_HOST_STYLE = {
  position: "relative",
  display: "block",
  width: "100%",
  minWidth: 0,
  flexShrink: 0,
} as const;

export const SAY_TO_ME_WIDGET_EDGE_INSET = 8;

// STM's collapsed banner is `position: absolute` on this host. Stretch to the
// pane so that anchor uses the right gutter; stay in the chat column when
// expanded. Drop host top margin when collapsed so the banner inset is the
// only top offset and can match right.
export function getSayToMeWidgetHostBoxStyle(input: {
  readonly collapsed: boolean;
  readonly maxContentWidth: number;
}): {
  readonly alignSelf: "center" | "stretch";
  readonly maxWidth: number | "none";
  readonly marginTop: number;
} {
  if (input.collapsed) {
    return { alignSelf: "stretch", maxWidth: "none", marginTop: 0 };
  }
  return {
    alignSelf: "center",
    maxWidth: input.maxContentWidth,
    marginTop: SAY_TO_ME_WIDGET_EDGE_INSET,
  };
}

export function getSayToMeWidgetCollapsedInsetCss(insetPx = SAY_TO_ME_WIDGET_EDGE_INSET): string {
  return `[data-testid="say-to-me-widget-host"] .stm-voice-widget--collapsed{top:${insetPx}px;right:${insetPx}px}`;
}

export function isSayToMeWidgetCollapsed(root: ParentNode): boolean | null {
  const section = root.querySelector("[data-collapsed]");
  if (!section) return null;
  return section.getAttribute("data-collapsed") === "true";
}

export function readSayToMeWidgetCollapsedFromStorage(
  storage: Pick<Storage, "getItem"> = localStorage,
  storageKey = SAY_TO_ME_WIDGET_STORAGE_KEY,
): boolean {
  return storage.getItem(storageKey) === "true";
}

export function subscribeSayToMeWidgetCollapsed(
  root: ParentNode,
  onChange: (collapsed: boolean) => void,
): () => void {
  const emit = () => {
    const collapsed = isSayToMeWidgetCollapsed(root);
    if (collapsed === null) return;
    onChange(collapsed);
  };
  if (typeof MutationObserver === "undefined") {
    emit();
    return () => {};
  }
  const observer = new MutationObserver(emit);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-collapsed"],
  });
  emit();
  return () => observer.disconnect();
}

export function getSayToMeWidgetAttributes(
  sessionId: string,
  uiBaseUrl = resolveSayToMeWidgetUiBaseUrl() ?? "",
): Record<string, string> {
  return {
    "session-id": sessionId,
    "notes-base-url": SAY_TO_ME_WIDGET_NOTES_BASE_URL,
    "timers-base-url": SAY_TO_ME_WIDGET_TIMERS_BASE_URL,
    "ui-base-url": uiBaseUrl,
    "storage-key": SAY_TO_ME_WIDGET_STORAGE_KEY,
  };
}

export function isSayToMeWidgetV2(element: Element): boolean {
  return (
    element.getAttribute(SAY_TO_ME_WIDGET_CAPABILITY_ATTRIBUTE) ===
    String(SAY_TO_ME_WIDGET_BANNER_API_VERSION)
  );
}

export function resolveMountedSayToMeWidget(root: ParentNode): Element | null {
  const widgets = root.querySelectorAll(SAY_TO_ME_WIDGET_TAG);
  return widgets.length === 1 ? widgets[0] : null;
}

export function isSayToMeUsagePromptDetail(detail: unknown): detail is {
  readonly source: typeof WIDGET_SOURCE;
  readonly version: typeof SAY_TO_ME_WIDGET_USAGE_PROMPT_VERSION;
  readonly type: typeof USAGE_PROMPT_TYPE;
  readonly prompt: string;
} {
  return (
    isRecord(detail) &&
    detail.source === WIDGET_SOURCE &&
    detail.version === SAY_TO_ME_WIDGET_USAGE_PROMPT_VERSION &&
    detail.type === USAGE_PROMPT_TYPE &&
    typeof detail.prompt === "string"
  );
}

export function insertSayToMeUsagePromptFromEvent(
  event: Event,
  widget: Element | null,
  insertPrompt: ((prompt: string) => void) | undefined,
): boolean {
  if (
    !insertPrompt ||
    !widget ||
    event.type !== SAY_TO_ME_USAGE_PROMPT_EVENT ||
    event.target !== widget ||
    !(event instanceof CustomEvent) ||
    !isSayToMeUsagePromptDetail(event.detail)
  ) {
    return false;
  }
  insertPrompt(event.detail.prompt);
  return true;
}

export function waitForSayToMeWidgetV2(element: Element, timeoutMs = 5_000): Promise<boolean> {
  if (isSayToMeWidgetV2(element)) return Promise.resolve(true);
  if (typeof MutationObserver === "undefined") return Promise.resolve(false);

  let observer: MutationObserver | null = null;
  const widgetReady = new Promise<true>((resolve) => {
    const currentObserver = new MutationObserver(() => {
      if (isSayToMeWidgetV2(element)) resolve(true);
    });
    observer = currentObserver;
    currentObserver.observe(element, {
      attributes: true,
      attributeFilter: [SAY_TO_ME_WIDGET_CAPABILITY_ATTRIBUTE],
    });
  });
  let timeoutId: number | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(false), timeoutMs);
  });
  return Promise.race([widgetReady, timedOut]).finally(() => {
    observer?.disconnect();
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function resolveSayToMeWidgetHmrModuleUrl(input?: {
  readonly isDev?: boolean;
  readonly hostname?: string;
  readonly stmOrigin?: string;
}): string | null {
  const isDev = input?.isDev ?? process.env.NODE_ENV !== "production";
  const hostname =
    input?.hostname ?? (typeof window === "undefined" ? "" : window.location.hostname);
  const stmOrigin =
    input?.stmOrigin ?? process.env.EXPO_PUBLIC_STM_DEV_ORIGIN ?? "http://localhost:5411";
  if (!isDev || !isLocalHostname(hostname) || !stmOrigin.trim()) return null;

  try {
    const origin = new URL(stmOrigin);
    if (
      (origin.protocol !== "http:" && origin.protocol !== "https:") ||
      !isLocalHostname(origin.hostname)
    ) {
      return null;
    }
    return new URL(SAY_TO_ME_WIDGET_HMR_PATH, origin.origin).toString();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSayToMeParkSessionDetail(detail: unknown, expectedSessionId?: string): boolean {
  if (!isRecord(detail)) return false;
  if (
    detail.source !== WIDGET_SOURCE ||
    detail.version !== SAY_TO_ME_WIDGET_PARK_SESSION_VERSION ||
    detail.type !== PARK_SESSION_TYPE ||
    typeof detail.sessionId !== "string" ||
    detail.sessionId.trim().length === 0
  ) {
    return false;
  }
  return expectedSessionId === undefined || detail.sessionId === expectedSessionId;
}

export function isSayToMeParkSessionEvent(event: Event, expectedSessionId?: string): boolean {
  return (
    event.type === SAY_TO_ME_PARK_SESSION_EVENT &&
    event instanceof CustomEvent &&
    isSayToMeParkSessionDetail(event.detail, expectedSessionId)
  );
}

export function buildParkSessionUrl(
  context: ParkSessionContext,
  origin = typeof window !== "undefined" ? window.location.origin : "http://localhost",
): URL {
  const url = new URL("/park.html", origin);
  url.searchParams.set("environmentId", context.environmentId);
  url.searchParams.set("threadId", context.threadId);
  for (const [key, value] of [
    ["title", context.title],
    ["project", context.project],
    ["cwd", context.cwd],
    ["branch", context.branch],
  ] as const) {
    if (typeof value === "string" && value.trim().length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

export function assignParkSessionUrl(context: ParkSessionContext): void {
  window.location.assign(buildParkSessionUrl(context));
}

export function assignParkSessionFromEvent(
  event: Event,
  expectedSessionId: string,
  context: ParkSessionContext,
): boolean {
  if (!expectedSessionId.trim() || !isSayToMeParkSessionEvent(event, expectedSessionId)) {
    return false;
  }
  assignParkSessionUrl(context);
  return true;
}
