import { describe, expect, it } from "vitest";
import { fetchSayToMeTimers, SAY_TO_ME_TIMERS_PATH } from "./timers";

describe("Say To Me timer proxy", () => {
  it("uses the fixed timer API paths and preserves the session query", async () => {
    let request: Request | undefined;
    await fetchSayToMeTimers(
      {
        method: "POST",
        params: { timerId: "42", action: "actions" },
        query: { sessionId: "pa_session" },
        body: { action: "pause" },
      },
      async (input, init) => {
        request = new Request(input, init);
        return new Response("{}", { status: 200 });
      },
    );

    expect(SAY_TO_ME_TIMERS_PATH).toBe("/api/say-to-me/timers");
    expect(request?.url).toBe(
      "http://localhost:5411/api/jarvis-timers/42/actions?sessionId=pa_session",
    );
    expect(request?.method).toBe("POST");
    expect(await request?.text()).toBe(JSON.stringify({ action: "pause" }));
  });

  it("maps the collection route without accepting an arbitrary upstream path", async () => {
    let request: Request | undefined;
    await fetchSayToMeTimers(
      { method: "GET", params: {}, query: {}, body: undefined },
      async (input, init) => {
        request = new Request(input, init);
        return new Response("[]", { status: 200 });
      },
    );

    expect(request?.url).toBe("http://localhost:5411/api/jarvis-timers");
  });
});
