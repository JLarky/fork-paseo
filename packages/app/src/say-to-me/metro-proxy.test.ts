import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { buildStmRequestUrl, createSayToMeProxyMiddleware, isSayToMeProxyPath, normalizeStmOrigin } =
  require("./metro-proxy.cjs") as {
    buildStmRequestUrl: (origin: string, pathname: string, search?: string) => string;
    createSayToMeProxyMiddleware: (origin?: string) => Function;
    isSayToMeProxyPath: (pathname: string) => boolean;
    normalizeStmOrigin: (origin?: string) => string;
  };

class TestRequest extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string>;

  constructor(method: string, url: string, body?: string, headers: Record<string, string> = {}) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers;
    if (body !== undefined) {
      this.headers["content-length"] = String(Buffer.byteLength(body));
      queueMicrotask(() => {
        this.emit("data", Buffer.from(body));
        this.emit("end");
      });
    }
  }
}

function responseFixture() {
  const chunks: Buffer[] = [];
  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  }) as Writable & {
    statusCode: number;
    headers: Record<string, string>;
    headersSent: boolean;
    setHeader(name: string, value: string): void;
    flushHeaders(): void;
    body: string;
  };
  response.statusCode = 200;
  response.headers = {};
  response.headersSent = false;
  response.setHeader = (name, value) => {
    response.headers[name.toLowerCase()] = String(value);
  };
  response.flushHeaders = () => {
    response.headersSent = true;
  };
  const originalEnd = response.end.bind(response);
  response.end = ((...args: Parameters<typeof response.end>) => {
    const [chunk] = args;
    if (chunk) chunks.push(Buffer.from(chunk as string | Uint8Array));
    response.headersSent = true;
    return originalEnd(...args);
  }) as typeof response.end;
  Object.defineProperty(response, "body", {
    get: () => Buffer.concat(chunks).toString("utf8"),
  });
  return response;
}

async function invoke(
  method: string,
  url: string,
  body?: string,
  headers?: Record<string, string>,
) {
  const request = new TestRequest(method, url, body, headers);
  const response = responseFixture();
  const next = vi.fn();
  createSayToMeProxyMiddleware("http://stm.test:5411")(request, response, next);
  await new Promise<void>((resolve) => {
    if (response.writableFinished) resolve();
    else response.once("finish", resolve);
  });
  return { request, response, next };
}

afterEach(() => vi.unstubAllGlobals());

describe("Paseo dev STM Metro adapter", () => {
  it("uses a fixed HTTP origin and maps paths without daemon hops", () => {
    expect(normalizeStmOrigin()).toBe("http://localhost:5411");
    expect(normalizeStmOrigin("localhost:5411/")).toBe("http://localhost:5411");
    expect(normalizeStmOrigin("https://stm.example.test")).toBe("https://stm.example.test");
    expect(() => normalizeStmOrigin("http://stm.test/base")).toThrow();
    expect(buildStmRequestUrl("http://stm.test:5411", "/api/sessions/pa_x/messages", "?x=1")).toBe(
      "http://stm.test:5411/api/sessions/pa_x/messages?x=1",
    );
  });

  it("allowlists every widget route but not Park or arbitrary paths", () => {
    for (const path of [
      "/api/say-to-me/embed/widget.js",
      "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc",
      "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc/events",
      "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc/messages/7/status",
      "/api/say-to-me-timers",
      "/api/say-to-me-timers/7/actions",
      "/api/message-attachments/7",
    ])
      expect(isSayToMeProxyPath(path)).toBe(true);
    for (const path of ["/park", "/api", "/api/voice-notes", "/api/secret/1"]) {
      expect(isSayToMeProxyPath(path)).toBe(false);
    }
  });

  it.each([
    ["GET", "/api/say-to-me/embed/widget.js", "http://stm.test:5411/embed/widget.js"],
    [
      "GET",
      "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc",
      "http://stm.test:5411/api/sessions/pa_12345678-1234-1234-1234-123456789abc/messages",
    ],
    [
      "POST",
      "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc?instanceId=local_1",
      "http://stm.test:5411/api/sessions/pa_12345678-1234-1234-1234-123456789abc/import?instanceId=local_1",
    ],
    ["PATCH", "/api/say-to-me-timers/7", "http://stm.test:5411/api/jarvis-timers/7"],
    ["DELETE", "/api/say-to-me-timers/7", "http://stm.test:5411/api/jarvis-timers/7"],
    ["POST", "/api/say-to-me-timers/7/actions", "http://stm.test:5411/api/jarvis-timers/7/actions"],
    [
      "GET",
      "/api/say-to-me-timers?sessionId=pa_agent",
      "http://stm.test:5411/api/jarvis-timers?sessionId=pa_agent",
    ],
    ["GET", "/api/message-attachments/7", "http://stm.test:5411/api/message-attachments/7"],
  ])("maps %s %s to %s", async (method, path, expectedUrl) => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(expectedUrl);
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const body =
      path.includes("say-to-me-timers") && method !== "GET" && method !== "DELETE"
        ? "{}"
        : undefined;
    const headers = body === undefined ? undefined : { "content-type": "application/json" };
    const { response } = await invoke(method, path, body, headers);
    expect(response.statusCode, response.body).toBe(204);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("maps voice status and forwards only the exact status payload", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "content-type": "application/json" });
      expect(init.body).toBe(JSON.stringify({ status: "played" }));
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await invoke(
      "POST",
      "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc/messages/7/status",
      JSON.stringify({ status: "played" }),
      { "content-type": "application/json" },
    );
    expect(result.response.statusCode).toBe(200);
  });

  it("rejects invalid ids, methods, query keys, and JSON bodies before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cases = [
      ["GET", "/api/voice-notes/not-pa"],
      ["POST", "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc?bad=1"],
      [
        "POST",
        "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc",
        "{}",
        { "content-type": "application/json" },
      ],
      [
        "POST",
        "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc/messages/7/status",
        JSON.stringify({ status: "bad" }),
        { "content-type": "application/json" },
      ],
      ["GET", "/api/say-to-me-timers/abc"],
      ["GET", "/api/say-to-me-timers?other=1"],
      ["POST", "/api/message-attachments/7"],
    ] as const;
    for (const [method, path, body, headers] of cases) {
      const { response } = await invoke(method, path, body, headers);
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
      expect(response.headers["content-type"]).toContain("application/json");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not forward request secrets and only copies safe response headers", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toBeUndefined();
      return new Response("image", {
        headers: {
          "content-type": "image/png",
          "cache-control": "public",
          "set-cookie": "secret",
          "x-secret": "no",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { response } = await invoke("GET", "/api/message-attachments/7", undefined, {
      authorization: "secret",
      cookie: "secret",
      host: "evil.test",
    });
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["cache-control"]).toBe("public");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.headers["x-secret"]).toBeUndefined();
    expect(response.body).toBe("image");
  });

  it("keeps SSE unbounded and aborts upstream when the client disconnects", async () => {
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Response(new ReadableStream({ start() {} }), {
        headers: { "content-type": "text/event-stream" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = new TestRequest(
      "GET",
      "/api/voice-notes/pa_12345678-1234-1234-1234-123456789abc/events",
    );
    const response = responseFixture();
    createSayToMeProxyMiddleware()(request, response, vi.fn());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    request.emit("close");
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
  });
});
