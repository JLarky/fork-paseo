import { createElement, useEffect, useRef, useState } from "react";

import {
  getSayToMeWidgetAttributes,
  isSayToMeParkSessionEvent,
  resolveSayToMeWidgetClassicModuleUrl,
  resolveSayToMeWidgetHmrModuleUrl,
  SAY_TO_ME_PARK_SESSION_EVENT,
  SAY_TO_ME_WIDGET_HOST_STYLE,
  SAY_TO_ME_WIDGET_TAG,
  waitForSayToMeWidgetV2,
} from "./widget";
import type { SayToMeWidgetHostProps } from "./SayToMeWidgetHost";

const CAPABILITY_TIMEOUT_MS = 5_000;

export function SayToMeWidgetHost({ sessionId, onParkSession }: SayToMeWidgetHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [capability, setCapability] = useState<"loading" | "ready" | "unavailable">("loading");
  const hmrModuleUrl = resolveSayToMeWidgetHmrModuleUrl();
  const loaderUrl = hmrModuleUrl ?? resolveSayToMeWidgetClassicModuleUrl();

  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-say-to-me-widget-loader="${loaderUrl}"]`,
    );
    if (existing) return;

    const script = document.createElement("script");
    script.dataset.sayToMeWidgetLoader = loaderUrl;
    script.src = loaderUrl;
    script.type = hmrModuleUrl ? "module" : "text/javascript";
    document.head.append(script);
  }, [hmrModuleUrl, loaderUrl]);

  useEffect(() => {
    const node = hostRef.current;
    const widget = node?.querySelector<HTMLElement>(SAY_TO_ME_WIDGET_TAG);
    if (!node || !widget) return;

    let disposed = false;
    setCapability("loading");
    void waitForSayToMeWidgetV2(widget, CAPABILITY_TIMEOUT_MS).then((isV2) => {
      if (disposed) return false;
      setCapability(isV2 ? "ready" : "unavailable");
      return true;
    });
    return () => {
      disposed = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const onPark = (event: Event) => {
      if (isSayToMeParkSessionEvent(event, sessionId)) {
        onParkSession();
      }
    };
    node.addEventListener(SAY_TO_ME_PARK_SESSION_EVENT, onPark);
    return () => node.removeEventListener(SAY_TO_ME_PARK_SESSION_EVENT, onPark);
  }, [onParkSession, sessionId]);

  return (
    <div ref={hostRef} data-testid="say-to-me-widget-host" style={SAY_TO_ME_WIDGET_HOST_STYLE}>
      {createElement(SAY_TO_ME_WIDGET_TAG, {
        ...getSayToMeWidgetAttributes(sessionId),
        "data-testid": "say-to-me-widget-element",
        hidden: capability !== "ready",
      })}
      {capability === "unavailable" ? (
        <div role="status" data-testid="say-to-me-widget-unavailable">
          Say To Me is unavailable.
        </div>
      ) : null}
    </div>
  );
}
