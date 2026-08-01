export const PASEO_VOICE_WIDGET_STORAGE_KEY = "paseo:say-to-me-banner-collapsed:v1";

export interface VoiceWidgetAttributes {
  readonly "session-id": string;
  readonly "notes-base-url": string;
  readonly "can-autoplay": "0" | "1";
  readonly "storage-key": string;
  readonly layout: "inline";
  "ui-base-url"?: string;
  "timers-base-url"?: string;
  "session-title"?: string;
  "project-name"?: string;
  "working-directory"?: string;
  "branch-name"?: string;
}

export function buildVoiceWidgetAttributes(input: {
  readonly sessionId: string;
  readonly apiBaseUrl: string;
  readonly canAutoplay: boolean;
  readonly uiBaseUrl?: string | null;
  readonly timersBaseUrl?: string | null;
  readonly context?: {
    readonly sessionTitle?: string | null;
    readonly projectName?: string | null;
    readonly workingDirectory?: string | null;
    readonly branchName?: string | null;
  };
}): VoiceWidgetAttributes {
  const attributes: VoiceWidgetAttributes = {
    "session-id": input.sessionId,
    "notes-base-url": `${input.apiBaseUrl}/api/voice-notes`,
    "can-autoplay": input.canAutoplay ? "1" : "0",
    "storage-key": PASEO_VOICE_WIDGET_STORAGE_KEY,
    layout: "inline",
  };
  const contextAttributes = [
    ["ui-base-url", input.uiBaseUrl],
    ["timers-base-url", input.timersBaseUrl],
    ["session-title", input.context?.sessionTitle],
    ["project-name", input.context?.projectName],
    ["working-directory", input.context?.workingDirectory],
    ["branch-name", input.context?.branchName],
  ] as const;
  for (const [name, value] of contextAttributes) {
    const trimmed = value?.trim();
    if (trimmed) attributes[name] = trimmed;
  }
  return attributes;
}
