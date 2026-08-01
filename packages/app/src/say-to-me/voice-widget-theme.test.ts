import { describe, expect, it } from "vitest";
import {
  buildPaseoVoiceWidgetThemeCss,
  PASEO_VOICE_WIDGET_THEME_STYLE_MARKER,
} from "./voice-widget-theme";

describe("Paseo voice widget theme", () => {
  it("defines light and dark host token overrides for the inline widget", () => {
    const css = buildPaseoVoiceWidgetThemeCss();
    expect(css).toContain(PASEO_VOICE_WIDGET_THEME_STYLE_MARKER);
    expect(css).toContain('[data-paseo-say-to-me-theme="light"] > say-to-me-voice-widget');
    expect(css).toContain('[data-paseo-say-to-me-theme="dark"] > say-to-me-voice-widget');
    expect(css).toContain("--stm-max-width: 100%");
    expect(css).toContain("--stm-focus-ring:");
  });
});
