import { describe, expect, it } from "vitest";
import {
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
});
