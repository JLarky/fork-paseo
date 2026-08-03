import { createElement, useEffect, useRef, useState } from "react";

import {
  assignParkSessionFromEvent,
  getSayToMeWidgetAttributes,
  insertSayToMeUsagePromptFromEvent,
  resolveMountedSayToMeWidget,
  resolveSayToMeWidgetHmrModuleUrl,
  SAY_TO_ME_WIDGET_SRC,
  SAY_TO_ME_PARK_SESSION_EVENT,
  SAY_TO_ME_USAGE_PROMPT_EVENT,
  SAY_TO_ME_WIDGET_HOST_STYLE,
  SAY_TO_ME_WIDGET_TAG,
  waitForSayToMeWidgetV2,
} from "./widget";
import type { SayToMeWidgetHostProps } from "./SayToMeWidgetHost";

const CAPABILITY_TIMEOUT_MS = 5_000;

function loadSayToMeWidgetScript(url: string, isHmr: boolean): Promise<void> {
  if (customElements.get(SAY_TO_ME_WIDGET_TAG)) return Promise.resolve();

  const existing = Array.from(document.scripts).find(
    (script) => script.dataset.sayToMeWidgetLoader === url,
  );
  const script = existing ?? document.createElement("script");
  if (!existing) {
    script.dataset.sayToMeWidgetLoader = url;
    script.src = url;
    script.type = isHmr ? "module" : "text/javascript";
    script.async = true;
    document.head.append(script);
  }

  if (script.dataset.sayToMeWidgetLoaded === "true") return Promise.resolve();
  if (script.dataset.sayToMeWidgetFailed === "true") {
    return Promise.reject(new Error("STM widget script failed to load"));
  }

  return new Promise<void>((resolve, reject) => {
    script.addEventListener(
      "load",
      () => {
        script.dataset.sayToMeWidgetLoaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        script.dataset.sayToMeWidgetFailed = "true";
        reject(new Error("STM widget script failed to load"));
      },
      { once: true },
    );
  });
}

export function SayToMeWidgetHost({
  sessionId,
  environmentId,
  threadId,
  title,
  project,
  cwd,
  branch,
  onInsertUsagePrompt,
}: SayToMeWidgetHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [capability, setCapability] = useState<"loading" | "ready" | "unavailable">("loading");
  const hmrModuleUrl = resolveSayToMeWidgetHmrModuleUrl();

  useEffect(() => {
    const node = hostRef.current;
    const widget = node ? resolveMountedSayToMeWidget(node) : null;
    if (!node || !widget) return;

    let disposed = false;
    const context = { environmentId, threadId, title, project, cwd, branch };
    const onPark = (event: Event) => {
      assignParkSessionFromEvent(event, sessionId, context);
    };
    const onUsagePrompt = (event: Event) => {
      insertSayToMeUsagePromptFromEvent(event, widget, onInsertUsagePrompt);
    };
    node.addEventListener(SAY_TO_ME_PARK_SESSION_EVENT, onPark);
    node.addEventListener(SAY_TO_ME_USAGE_PROMPT_EVENT, onUsagePrompt);

    const loaderUrl = hmrModuleUrl ?? SAY_TO_ME_WIDGET_SRC;
    void loadSayToMeWidgetScript(loaderUrl, hmrModuleUrl !== null)
      .then(() => waitForSayToMeWidgetV2(widget, CAPABILITY_TIMEOUT_MS))
      .then((isV2) => {
        if (disposed) return undefined;
        setCapability(isV2 ? "ready" : "unavailable");
        if (!isV2) {
          console.error("[say-to-me-widget] STM v2 widget capability is unavailable");
        }
        return undefined;
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setCapability("unavailable");
        console.error("[say-to-me-widget] Failed to load STM v2 widget", error);
      });

    return () => {
      disposed = true;
      node.removeEventListener(SAY_TO_ME_PARK_SESSION_EVENT, onPark);
      node.removeEventListener(SAY_TO_ME_USAGE_PROMPT_EVENT, onUsagePrompt);
    };
  }, [
    branch,
    cwd,
    environmentId,
    hmrModuleUrl,
    onInsertUsagePrompt,
    project,
    sessionId,
    threadId,
    title,
  ]);

  return (
    <div ref={hostRef} data-testid="say-to-me-widget-host" style={SAY_TO_ME_WIDGET_HOST_STYLE}>
      {createElement(SAY_TO_ME_WIDGET_TAG, {
        ...getSayToMeWidgetAttributes(sessionId),
        "data-testid": "say-to-me-widget-element",
        hidden: capability !== "ready",
      })}
      {capability === "unavailable" ? (
        <div role="status" data-testid="say-to-me-widget-unavailable">
          Say To Me is unavailable. Update Paseo to use the STM v2 widget.
        </div>
      ) : null}
    </div>
  );
}
