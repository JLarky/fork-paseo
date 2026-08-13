import { describe, expect, it } from "vitest";

import { shouldPlayIdleCompletionDing } from "./use-idle-completion-ding.web";

describe("shouldPlayIdleCompletionDing", () => {
  it("plays when the stop button turns back into the send button", () => {
    expect(
      shouldPlayIdleCompletionDing(
        { threadKey: "a", isActive: true, isCancelling: false },
        { threadKey: "a", isActive: false, isCancelling: false },
      ),
    ).toBe(true);
  });

  it("stays silent on the first sample so opening an idle thread is quiet", () => {
    expect(
      shouldPlayIdleCompletionDing(null, { threadKey: "a", isActive: false, isCancelling: false }),
    ).toBe(false);
  });

  it("stays silent when switching away from a running thread", () => {
    expect(
      shouldPlayIdleCompletionDing(
        { threadKey: "a", isActive: true, isCancelling: false },
        { threadKey: "b", isActive: false, isCancelling: false },
      ),
    ).toBe(false);
  });

  it("stays silent while a turn keeps running or stays idle", () => {
    expect(
      shouldPlayIdleCompletionDing(
        { threadKey: "a", isActive: true, isCancelling: false },
        { threadKey: "a", isActive: true, isCancelling: false },
      ),
    ).toBe(false);
    expect(
      shouldPlayIdleCompletionDing(
        { threadKey: "a", isActive: false, isCancelling: false },
        { threadKey: "a", isActive: false, isCancelling: false },
      ),
    ).toBe(false);
  });

  it("stays silent when a turn starts", () => {
    expect(
      shouldPlayIdleCompletionDing(
        { threadKey: "a", isActive: false, isCancelling: false },
        { threadKey: "a", isActive: true, isCancelling: false },
      ),
    ).toBe(false);
  });

  it("stays silent when a manual cancellation ends the run", () => {
    expect(
      shouldPlayIdleCompletionDing(
        { threadKey: "a", isActive: true, isCancelling: true },
        { threadKey: "a", isActive: false, isCancelling: false },
      ),
    ).toBe(false);
  });
});
