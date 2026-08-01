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

  it("styles STM markdown semantics in normal and compact inline states", () => {
    const css = buildPaseoVoiceWidgetThemeCss();
    for (const selector of [
      ".stm-md table",
      ".stm-md code",
      ".stm-md pre",
      ".stm-md ul",
      ".stm-md ol",
      ".stm-md blockquote",
      ".stm-md a",
      ".stm-md-wrap--compact",
      ".stm-md--compact",
    ]) {
      expect(css).toContain(`say-to-me-voice-widget ${selector}`);
    }
    expect(css).toContain("--stm-md-code-bg:");
    expect(css).toContain("--stm-md-quote-border:");
    expect(css).toContain("text-decoration: underline");
  });
});
