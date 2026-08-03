import { afterEach, describe, expect, it } from "vitest";
import {
  createSayToMeMessageAttachmentsRouter,
  SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH,
} from "./message-attachments.js";
import { fakeUpstream, listenWithJson, type TestProxyApp } from "./test-utils.js";

describe("Say To Me message attachments proxy", () => {
  let app: TestProxyApp | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
    delete process.env.PASEO_SAY_TO_ME_BASE_URL;
  });

  async function mount(upstream: ReturnType<typeof fakeUpstream>) {
    process.env.PASEO_SAY_TO_ME_BASE_URL = "http://stm.test:9999";
    app = await listenWithJson((server) => {
      server.use(
        SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH,
        createSayToMeMessageAttachmentsRouter(upstream.fetchImpl),
      );
    });
    return app;
  }

  it("proxies binary content with only the safe forwarded headers", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const upstream = fakeUpstream(
      () =>
        new Response(bytes, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-disposition": 'inline; filename="note.png"',
            etag: '"abc"',
            "set-cookie": "not-forwarded",
            server: "not-forwarded",
          },
        }),
    );
    const { baseUrl } = await mount(upstream);

    const response = await fetch(`${baseUrl}${SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH}/7`);

    expect(upstream.calls[0]?.url).toBe("http://stm.test:9999/api/message-attachments/7");
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="note.png"');
    expect(response.headers.get("etag")).toBe('"abc"');
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects non-numeric attachment ids without contacting upstream", async () => {
    const upstream = fakeUpstream(() => new Response("nope"));
    const { baseUrl } = await mount(upstream);

    const response = await fetch(
      `${baseUrl}${SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH}/${encodeURIComponent("../secret")}`,
    );

    expect(response.status).toBe(400);
    expect(upstream.calls).toHaveLength(0);
  });

  it("maps upstream 404 and network failure to stable statuses", async () => {
    let call = 0;
    const upstream = fakeUpstream(() => {
      call += 1;
      if (call === 1) return new Response("missing", { status: 404 });
      throw new Error("network down");
    });
    const { baseUrl } = await mount(upstream);

    const notFound = await fetch(`${baseUrl}${SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH}/1`);
    const failed = await fetch(`${baseUrl}${SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH}/2`);

    expect(notFound.status).toBe(404);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "Unable to load message attachment." });
  });
});
