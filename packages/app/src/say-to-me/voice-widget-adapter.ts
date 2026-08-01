export const PASEO_VOICE_WIDGET_STORAGE_KEY = "paseo:say-to-me-banner-collapsed:v1";

export interface VoiceWidgetAttributes {
  readonly "session-id": string;
  readonly "notes-base-url": string;
  readonly "can-autoplay": "0" | "1";
  readonly "storage-key": string;
}

export function buildVoiceWidgetAttributes(input: {
  readonly sessionId: string;
  readonly apiBaseUrl: string;
  readonly canAutoplay: boolean;
}): VoiceWidgetAttributes {
  return {
    "session-id": input.sessionId,
    "notes-base-url": `${input.apiBaseUrl}/api/voice-notes`,
    "can-autoplay": input.canAutoplay ? "1" : "0",
    "storage-key": PASEO_VOICE_WIDGET_STORAGE_KEY,
  };
}
