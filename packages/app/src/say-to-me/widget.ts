/** Host adapter for Say To Me's STM-owned `<say-to-me-widget>`. */

export const SAY_TO_ME_WIDGET_TAG = "say-to-me-widget";
export const SAY_TO_ME_PARK_SESSION_EVENT = "say-to-me-park-session";
export const SAY_TO_ME_WIDGET_DEV_ORIGIN = "http://localhost:5411";
export const SAY_TO_ME_WIDGET_SRC = "/embed/widget.js";
const SAY_TO_ME_WIDGET_HMR_PATH = "/server/embed/solid/widget-hmr.ts";

const WIDGET_SOURCE = "say-to-me-widget";
const PARK_SESSION_VERSION = 1;
const PARK_SESSION_TYPE = "park-session";

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
