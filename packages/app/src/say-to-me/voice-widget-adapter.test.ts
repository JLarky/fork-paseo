import { describe, expect, it } from "vitest";
import { buildVoiceWidgetAttributes, PASEO_VOICE_WIDGET_STORAGE_KEY } from "./voice-widget-adapter";

describe("Paseo voice widget adapter", () => {
  it("maps the canonical session and selected daemon notes base", () => {
    expect(
      buildVoiceWidgetAttributes({
        sessionId: "pa_9c4b3da4-2bfa-4aae-ac85-4932cabfc859",
        apiBaseUrl: "http://127.0.0.1:6768",
        canAutoplay: false,
      }),
    ).toEqual({
      "session-id": "pa_9c4b3da4-2bfa-4aae-ac85-4932cabfc859",
      "notes-base-url": "http://127.0.0.1:6768/api/voice-notes",
      "can-autoplay": "0",
      "storage-key": PASEO_VOICE_WIDGET_STORAGE_KEY,
      layout: "inline",
    });
  });

  it("passes trimmed canonical agent context and omits empty values", () => {
    expect(
      buildVoiceWidgetAttributes({
        sessionId: "pa_session",
        apiBaseUrl: "http://127.0.0.1:6768",
        canAutoplay: false,
        context: {
          sessionTitle: "  Fix the widget  ",
          projectName: "Paseo",
          workingDirectory: "/tmp/paseo",
          branchName: "  ",
        },
      }),
    ).toMatchObject({
      "session-title": "Fix the widget",
      "project-name": "Paseo",
      "working-directory": "/tmp/paseo",
      layout: "inline",
    });
    expect(
      buildVoiceWidgetAttributes({
        sessionId: "pa_session",
        apiBaseUrl: "http://127.0.0.1:6768",
        canAutoplay: false,
        context: { branchName: "  " },
      }),
    ).not.toHaveProperty("branch-name");
  });

  it("encodes the existing autoplay policy as the STM attribute contract", () => {
    expect(
      buildVoiceWidgetAttributes({
        sessionId: "pa_session",
        apiBaseUrl: "https://daemon.example",
        canAutoplay: true,
      })["can-autoplay"],
    ).toBe("1");
  });
});
