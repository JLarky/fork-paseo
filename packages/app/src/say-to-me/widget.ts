/** Host adapter for Say To Me's STM-owned `<say-to-me-widget>`. */

export const SAY_TO_ME_WIDGET_TAG = "say-to-me-widget";
export const SAY_TO_ME_PARK_SESSION_EVENT = "say-to-me-park-session";
export const SAY_TO_ME_WIDGET_BANNER_API_VERSION = 2 as const;
export const SAY_TO_ME_WIDGET_PARK_SESSION_VERSION = 1 as const;
export const SAY_TO_ME_WIDGET_DEV_ORIGIN = "http://localhost:5511";
export const SAY_TO_ME_WIDGET_SRC = "/embed/widget.js";
export const SAY_TO_ME_WIDGET_NOTES_BASE_URL = `${SAY_TO_ME_WIDGET_DEV_ORIGIN}/api/voice-notes`;
export const SAY_TO_ME_WIDGET_TIMERS_BASE_URL = `${SAY_TO_ME_WIDGET_DEV_ORIGIN}/api/say-to-me-timers`;
export const SAY_TO_ME_WIDGET_UI_BASE_URL = SAY_TO_ME_WIDGET_DEV_ORIGIN;
export const SAY_TO_ME_WIDGET_STORAGE_KEY = "paseo:say-to-me-widget-collapsed:v1";
export const SAY_TO_ME_WIDGET_CAPABILITY_ATTRIBUTE = "data-banner-api-version";
const SAY_TO_ME_WIDGET_HMR_PATH = "/server/embed/solid/widget-hmr.ts";

const WIDGET_SOURCE = "say-to-me-widget";
const PARK_SESSION_VERSION = SAY_TO_ME_WIDGET_PARK_SESSION_VERSION;
const PARK_SESSION_TYPE = "park-session";

export const SAY_TO_ME_WIDGET_HOST_STYLE = {
  position: "relative",
  display: "block",
  width: "100%",
  minWidth: 0,
  flexShrink: 0,
} as const;

export function getSayToMeWidgetAttributes(sessionId: string): Record<string, string> {
  return {
    "session-id": sessionId,
    "notes-base-url": SAY_TO_ME_WIDGET_NOTES_BASE_URL,
    "timers-base-url": SAY_TO_ME_WIDGET_TIMERS_BASE_URL,
    "ui-base-url": SAY_TO_ME_WIDGET_UI_BASE_URL,
    "storage-key": SAY_TO_ME_WIDGET_STORAGE_KEY,
  };
}

export function isSayToMeWidgetV2(element: Element): boolean {
  return (
    element.getAttribute(SAY_TO_ME_WIDGET_CAPABILITY_ATTRIBUTE) ===
    String(SAY_TO_ME_WIDGET_BANNER_API_VERSION)
  );
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
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timeoutId = setTimeout(() => resolve(false), timeoutMs);
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
    input?.stmOrigin ?? process.env.EXPO_PUBLIC_STM_DEV_ORIGIN ?? SAY_TO_ME_WIDGET_DEV_ORIGIN;
  if (!isDev || !isLocalHostname(hostname) || !stmOrigin.trim()) {
    return null;
  }

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

export function resolveSayToMeWidgetClassicModuleUrl(
  stmOrigin = SAY_TO_ME_WIDGET_DEV_ORIGIN,
): string {
  return new URL(SAY_TO_ME_WIDGET_SRC, stmOrigin).toString();
}

export function isSayToMeParkSessionDetail(detail: unknown, expectedSessionId?: string): boolean {
  if (detail === null || typeof detail !== "object") {
    return false;
  }
  const record = detail as Record<string, unknown>;
  if (
    record.source !== WIDGET_SOURCE ||
    record.version !== PARK_SESSION_VERSION ||
    record.type !== PARK_SESSION_TYPE ||
    typeof record.sessionId !== "string" ||
    record.sessionId.trim().length === 0
  ) {
    return false;
  }
  return expectedSessionId === undefined || record.sessionId === expectedSessionId;
}

export function isSayToMeParkSessionEvent(event: Event, expectedSessionId?: string): boolean {
  return (
    event.type === SAY_TO_ME_PARK_SESSION_EVENT &&
    event instanceof CustomEvent &&
    isSayToMeParkSessionDetail(event.detail, expectedSessionId)
  );
}
