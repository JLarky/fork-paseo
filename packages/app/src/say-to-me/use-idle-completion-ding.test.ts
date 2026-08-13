import { describe, expect, it } from "vitest";

import { reduceIdleWorkUnit } from "./queue-idle";

describe("idle completion ding host handoff", () => {
  it("emits once when a remembered turn goes idle", () => {
    expect(
      reduceIdleWorkUnit(
        { threadKey: "a", isActive: true, isCancelling: false, turnId: "turn-1" },
        { threadKey: "a", isActive: false, isCancelling: false, turnId: null },
        "turn-1",
      ).emit,
    ).toBe("turn-1");
  });

  it("does not emit for a cancelled turn", () => {
    expect(
      reduceIdleWorkUnit(
        { threadKey: "a", isActive: true, isCancelling: true, turnId: "turn-1" },
        { threadKey: "a", isActive: false, isCancelling: false, turnId: null },
        "turn-1",
      ).emit,
    ).toBeNull();
  });
});
