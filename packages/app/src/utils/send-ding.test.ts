import { describe, expect, it } from "vitest";

import { createSendDingWavUrl } from "./send-ding.web";

describe("send ding", () => {
  it("uses the canonical 160 ms PCM WAV shape", () => {
    const url = createSendDingWavUrl();
    const bytes = Uint8Array.from(atob(url.slice("data:audio/wav;base64,".length)), (char) =>
      char.charCodeAt(0),
    );

    expect(url).toMatch(/^data:audio\/wav;base64,/);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(bytes.byteLength).toBe(44 + Math.floor(44100 * 0.16) * 2);
  });
});
