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
  --stm-md-code-bg: color-mix(in srgb, #1a1a1e 7%, #f4f4f5);
  --stm-md-quote-border: #20744a;
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
  --stm-md-code-bg: color-mix(in srgb, #f4f5f4 10%, #272a29);
  --stm-md-quote-border: #7ccba0;
}

say-to-me-voice-widget .stm-md-wrap {
  margin-top: 0.45rem;
  border: 1px solid var(--stm-border);
  border-radius: var(--stm-radius);
  background: var(--stm-surface);
  padding: 0.45rem 0.55rem;
}

say-to-me-voice-widget .stm-md-wrap--compact,
say-to-me-voice-widget .stm-md--compact {
  max-height: 9rem;
  overflow: auto;
  overscroll-behavior: contain;
}

say-to-me-voice-widget .stm-md-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.25rem;
}

say-to-me-voice-widget .stm-md {
  color: var(--stm-fg);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

say-to-me-voice-widget .stm-md p {
  margin: 0 0 0.4rem;
}

say-to-me-voice-widget .stm-md p:last-child {
  margin-bottom: 0;
}

say-to-me-voice-widget .stm-md table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.45rem 0;
  font-size: 11px;
}

say-to-me-voice-widget .stm-md th,
say-to-me-voice-widget .stm-md td {
  border: 1px solid var(--stm-border);
  padding: 0.25rem 0.4rem;
  text-align: left;
  vertical-align: top;
}

say-to-me-voice-widget .stm-md th {
  background: var(--stm-md-code-bg);
  font-weight: 600;
}

say-to-me-voice-widget .stm-md ul,
say-to-me-voice-widget .stm-md ol {
  margin: 0.35rem 0;
  padding-inline-start: 1.25rem;
}

say-to-me-voice-widget .stm-md li {
  margin: 0.15rem 0;
}

say-to-me-voice-widget .stm-md blockquote {
  margin: 0.45rem 0;
  border-inline-start: 3px solid var(--stm-md-quote-border);
  color: var(--stm-muted);
  padding-inline-start: 0.65rem;
}

say-to-me-voice-widget .stm-md pre,
say-to-me-voice-widget .stm-md code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}

say-to-me-voice-widget .stm-md code {
  background: var(--stm-md-code-bg);
  border-radius: 3px;
  padding: 0.05rem 0.2rem;
}

say-to-me-voice-widget .stm-md pre {
  overflow: auto;
  margin: 0.45rem 0;
  padding: 0.35rem 0.45rem;
  border-radius: calc(var(--stm-radius) - 2px);
  background: var(--stm-md-code-bg);
}

say-to-me-voice-widget .stm-md pre code {
  background: transparent;
  padding: 0;
}

say-to-me-voice-widget .stm-md a {
  color: var(--stm-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

say-to-me-voice-widget .stm-md--compact {
  font-size: 11px;
  line-height: 1.35;
}

say-to-me-voice-widget .stm-md--compact table {
  min-width: 24rem;
}

say-to-me-voice-widget .stm-md--compact pre {
  max-height: 5rem;
}
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
