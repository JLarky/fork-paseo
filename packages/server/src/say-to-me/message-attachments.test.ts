import express from "express";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
  createSayToMeMessageAttachmentsRouter,
  fetchSayToMeMessageAttachment,
  SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH,
} from "./message-attachments";

describe("Say To Me message attachment proxy", () => {
  it("uses the fixed attachment path", async () => {
    let request: Request | undefined;
    await fetchSayToMeMessageAttachment("489", async (input, init) => {
      request = new Request(input, init);
      return new Response("image", {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });

    expect(SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH).toBe("/api/message-attachments");
    expect(request?.url).toBe("http://localhost:5411/api/message-attachments/489");
    expect(request?.method).toBe("GET");
  });

  it("serves an image response through the fixed route", async () => {
    const app = express();
    app.use(
      SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH,
      createSayToMeMessageAttachmentsRouter(
        async () =>
          new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      ),
    );
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not start");
      const response = await fetch(
        `http://127.0.0.1:${address.port}${SAY_TO_ME_MESSAGE_ATTACHMENTS_PATH}/489`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([137, 80, 78, 71]);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
