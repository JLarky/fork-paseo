import { createElement, useEffect, useRef } from "react";

import {
  isSayToMeParkSessionEvent,
  resolveSayToMeWidgetClassicModuleUrl,
  resolveSayToMeWidgetHmrModuleUrl,
  SAY_TO_ME_PARK_SESSION_EVENT,
  SAY_TO_ME_WIDGET_TAG,
} from "./widget";
import type { SayToMeWidgetHostProps } from "./SayToMeWidgetHost";

export function SayToMeWidgetHost({ sessionId, onParkSession }: SayToMeWidgetHostProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
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
    <span ref={hostRef} data-testid="say-to-me-widget-host">
      {createElement(SAY_TO_ME_WIDGET_TAG, {
        "session-id": sessionId,
        "data-testid": "say-to-me-widget-element",
      })}
    </span>
  );
}
