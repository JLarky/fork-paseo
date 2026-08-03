import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { buildDaemonRequestUrl, isSayToMeProxyPath, normalizeDaemonEndpoint } =
  require("./metro-proxy.cjs") as {
    buildDaemonRequestUrl: (endpoint: string, requestUrl: string) => string;
    isSayToMeProxyPath: (pathname: string) => boolean;
    normalizeDaemonEndpoint: (endpoint?: string) => string;
  };

describe("Paseo dev STM Metro proxy", () => {
  it("normalizes configured daemon endpoints", () => {
    expect(normalizeDaemonEndpoint("localhost:6767")).toBe("http://localhost:6767");
    expect(normalizeDaemonEndpoint("http://localhost:6767/")).toBe("http://localhost:6767");
    expect(normalizeDaemonEndpoint("")).toBe("http://localhost:6767");
  });

  it("preserves the fixed route path and query", () => {
    expect(
      buildDaemonRequestUrl("localhost:6767/", "/api/voice-notes/pa_agent/events?since=3"),
    ).toBe("http://localhost:6767/api/voice-notes/pa_agent/events?since=3");
    expect(buildDaemonRequestUrl("http://daemon.test:6767", "/park?threadId=agent-1")).toBe(
      "http://daemon.test:6767/park?threadId=agent-1",
    );
  });

  it("matches only the fixed STM/Park routes", () => {
    for (const path of [
      "/api/voice-notes/pa_agent",
      "/api/say-to-me-timers?sessionId=pa_agent",
      "/api/say-to-me-timers/1/actions",
      "/api/message-attachments/42",
      "/api/say-to-me/embed/widget.js",
      "/park",
    ]) {
      expect(isSayToMeProxyPath(path.split("?")[0])).toBe(true);
    }
    for (const path of [
      "/api",
      "/api/voice-notes",
      "/api/other-secret-route",
      "/api/say-to-me/embed/widget.js/extra",
      "/park/extra",
    ]) {
      expect(isSayToMeProxyPath(path)).toBe(false);
    }
  });
});
