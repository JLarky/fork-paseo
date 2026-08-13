import { createElement, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { withUnistyles } from "react-native-unistyles";

import { Alert } from "@/components/ui/alert";
import { MAX_CONTENT_WIDTH } from "@/constants/layout";
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

const UNAVAILABLE_DESCRIPTION_STYLE = {
  display: "grid",
  gap: 8,
  color: "var(--muted-foreground)",
  fontSize: 12,
  lineHeight: 1.4,
} satisfies CSSProperties;

const UNAVAILABLE_URL_STYLE = {
  display: "block",
  maxWidth: "100%",
  padding: "5px 8px",
  borderRadius: 6,
  background: "var(--muted)",
  color: "var(--muted-foreground)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 12,
  lineHeight: 1.4,
  overflowWrap: "anywhere",
} satisfies CSSProperties;

type WidgetThemeVariables = CSSProperties & {
  "--background": string;
  "--foreground": string;
  "--border": string;
  "--muted": string;
  "--muted-foreground": string;
  "--accent": string;
  "--popover": string;
  "--input": string;
  "--ring": string;
};

interface WidgetHostDivProps {
  readonly children: ReactNode;
  readonly themeVariables?: WidgetThemeVariables;
}

const WidgetHostDiv = forwardRef<HTMLDivElement, WidgetHostDivProps>(
  ({ children, themeVariables }, ref) => {
    const hostStyle = useMemo(
      () => ({
        ...SAY_TO_ME_WIDGET_HOST_STYLE,
        // Match the chat/composer column so the widget doesn't float detached
        // from the thread on ultra-wide screens.
        alignSelf: "center",
        maxWidth: MAX_CONTENT_WIDTH,
        marginTop: 8,
        marginBottom: 8,
        ...themeVariables,
      }),
      [themeVariables],
    );

    return (
      <div ref={ref} data-testid="say-to-me-widget-host" style={hostStyle}>
        {children}
      </div>
    );
  },
);
WidgetHostDiv.displayName = "WidgetHostDiv";

// The <say-to-me-widget> stylesheet reads shadcn-style CSS custom properties
// with light-mode fallbacks. Paseo themes live in Unistyles rather than CSS,
// so map the live colors onto a small leaf component for the embedded widget.
const ThemedWidgetHostDiv = withUnistyles(WidgetHostDiv, (theme) => ({
  themeVariables: {
    "--background": theme.colors.background,
    "--foreground": theme.colors.foreground,
    "--border": theme.colors.border,
    "--muted": theme.colors.muted,
    "--muted-foreground": theme.colors.mutedForeground,
    "--accent": theme.colors.accent,
    "--popover": theme.colors.popover,
    "--input": theme.colors.input,
    "--ring": theme.colors.ring,
  },
}));

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
  const widgetUrl = hmrModuleUrl ?? SAY_TO_ME_WIDGET_SRC;
  const attemptedWidgetUrl =
    typeof window === "undefined" ? widgetUrl : new URL(widgetUrl, window.location.href).toString();
  const unavailableDescription = useMemo(
    () => (
      <div style={UNAVAILABLE_DESCRIPTION_STYLE}>
        <span>
          The voice service could not be reached. Check that the Say To Me server is running, then
          reload this page.
        </span>
        <code style={UNAVAILABLE_URL_STYLE} title={attemptedWidgetUrl}>
          Widget URL: {attemptedWidgetUrl}
        </code>
      </div>
    ),
    [attemptedWidgetUrl],
  );

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

    void loadSayToMeWidgetScript(widgetUrl, hmrModuleUrl !== null)
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
    widgetUrl,
  ]);

  return (
    <ThemedWidgetHostDiv ref={hostRef}>
      {createElement(SAY_TO_ME_WIDGET_TAG, {
        ...getSayToMeWidgetAttributes(sessionId),
        "data-testid": "say-to-me-widget-element",
        hidden: capability !== "ready",
      })}
      {capability === "unavailable" ? (
        <Alert
          variant="warning"
          title="Say To Me unavailable"
          description={unavailableDescription}
          testID="say-to-me-widget-unavailable"
        />
      ) : null}
    </ThemedWidgetHostDiv>
  );
}
