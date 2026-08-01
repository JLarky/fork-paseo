export const PASEO_VOICE_WIDGET_THEME_STYLE_MARKER = "paseo-say-to-me-voice-widget-theme-s1";

export function buildPaseoVoiceWidgetThemeCss(): string {
  return `/* ${PASEO_VOICE_WIDGET_THEME_STYLE_MARKER} */
[data-paseo-say-to-me-theme="light"] > say-to-me-voice-widget {
  --stm-bg: #ffffff;
  --stm-fg: #1a1a1e;
  --stm-muted: #71717a;
  --stm-border: #e4e4e7;
  --stm-surface: #f4f4f5;
  --stm-accent: #20744a;
  --stm-accent-fg: #ffffff;
  --stm-danger: #b91c1c;
  --stm-radius: 12px;
  --stm-shadow: 0 2px 8px rgb(24 24 27 / 12%);
  --stm-font: inherit;
  --stm-max-width: 100%;
  --stm-focus-ring: 0 0 0 2px rgb(32 116 74 / 30%);
}

[data-paseo-say-to-me-theme="dark"] > say-to-me-voice-widget {
  --stm-bg: #181b1a;
  --stm-fg: #f4f5f4;
  --stm-muted: #a1a5a4;
  --stm-border: #252b2a;
  --stm-surface: #272a29;
  --stm-accent: #7ccba0;
  --stm-accent-fg: #181b1a;
  --stm-danger: #c64f43;
  --stm-radius: 12px;
  --stm-shadow: 0 2px 8px rgb(0 0 0 / 30%);
  --stm-font: inherit;
  --stm-max-width: 100%;
  --stm-focus-ring: 0 0 0 2px rgb(124 203 160 / 35%);
}`;
}

export function ensurePaseoVoiceWidgetThemeStylesheet(): void {
  if (
    document.querySelector(`style[data-paseo-style="${PASEO_VOICE_WIDGET_THEME_STYLE_MARKER}"]`)
  ) {
    return;
  }
  const style = document.createElement("style");
  style.dataset.paseoStyle = PASEO_VOICE_WIDGET_THEME_STYLE_MARKER;
  style.textContent = buildPaseoVoiceWidgetThemeCss();
  document.head.appendChild(style);
}
