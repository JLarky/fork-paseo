export const VOICE_WIDGET_DEV_MODULE_URL =
  "http://localhost:5411/server/embed/solid/voice-widget-hmr.ts";
export const VOICE_WIDGET_PROXY_PATH = "/api/say-to-me/embed/voice-widget.js";

export type VoiceWidgetLoadMode = "dev-module" | "classic-script";

export function voiceWidgetLoadMode(input: {
  readonly isLocalhost: boolean;
  readonly isDevelopment: boolean;
}): VoiceWidgetLoadMode {
  return input.isLocalhost && input.isDevelopment ? "dev-module" : "classic-script";
}

let directModulePromise: Promise<unknown> | null = null;
let classicScriptPromise: Promise<void> | null = null;

const loadRemoteModule = new Function("url", "return import(url);") as (
  url: string,
) => Promise<unknown>;

export function loadVoiceWidgetModule(): Promise<unknown> {
  directModulePromise ??= loadRemoteModule(VOICE_WIDGET_DEV_MODULE_URL);
  return directModulePromise;
}

export function loadVoiceWidgetScript(src: string): Promise<void> {
  classicScriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error(`Unable to load Say To Me voice widget from ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
  return classicScriptPromise;
}

export function loadVoiceWidget(
  mode: VoiceWidgetLoadMode,
  fallbackSrc: string,
  loadModule: () => Promise<unknown> = loadVoiceWidgetModule,
  loadScript: (src: string) => Promise<void> = loadVoiceWidgetScript,
): Promise<unknown> {
  if (mode === "classic-script") return loadScript(fallbackSrc);
  return loadModule().catch(() => loadScript(fallbackSrc));
}
