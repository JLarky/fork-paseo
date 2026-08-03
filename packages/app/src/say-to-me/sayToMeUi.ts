/** Browser UI origin for Say To Me preview and session links. */
export const SAY_TO_ME_UI_URL = "https://say.localhost:1311";

interface SayToMeWidgetUiBaseInput {
  readonly configuredUrl?: string | null;
  readonly hostname?: string;
  readonly origin?: string;
}

function validHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Resolve only an explicitly configured or same-origin Say To Me UI. */
export function resolveSayToMeWidgetUiBaseUrl(input: SayToMeWidgetUiBaseInput = {}): string | null {
  const configured =
    input.configuredUrl ??
    (typeof process !== "undefined" ? process.env.EXPO_PUBLIC_SAY_TO_ME_UI_URL : undefined);
  const configuredUrl = validHttpUrl(configured);
  if (configuredUrl) return configuredUrl;

  const hostname =
    input.hostname ?? (typeof window === "undefined" ? "" : window.location.hostname);
  if (hostname === "say.localhost" || hostname.endsWith(".say.localhost")) {
    return validHttpUrl(
      input.origin ?? (typeof window === "undefined" ? null : window.location.origin),
    );
  }
  return null;
}
