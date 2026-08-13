import { describe, expect, it } from "vitest";

import {
  createIdleCompletionDingWavUrl,
  IDLE_COMPLETION_DING_DURATION_MS,
} from "./idle-completion-ding.web";

describe("idle completion ding", () => {
  it("uses the canonical 580 ms PCM WAV shape", () => {
    const url = createIdleCompletionDingWavUrl();
    const bytes = Uint8Array.from(atob(url.slice("data:audio/wav;base64,".length)), (char) =>
      char.charCodeAt(0),
    );

    expect(url).toMatch(/^data:audio\/wav;base64,/);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(bytes.byteLength).toBe(44 + Math.floor(44100 * 0.58) * 2);
    expect(IDLE_COMPLETION_DING_DURATION_MS).toBe(580);
  });
});
