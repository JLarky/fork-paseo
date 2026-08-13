/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { findSayToMeWidget, queueSayToMeIdle, reduceIdleWorkUnit } from "./queue-idle";
import { SAY_TO_ME_WIDGET_TAG } from "./widget";

const sample = (
  overrides: Partial<{
    threadKey: string | null;
    isActive: boolean;
    isCancelling: boolean;
    turnId: string | null;
  }> = {},
) => ({
  threadKey: "srv:agent",
  isActive: false,
  isCancelling: false,
  turnId: null,
  ...overrides,
});

describe("reduceIdleWorkUnit", () => {
  it("emits the remembered turn id when a turn goes idle", () => {
    expect(
      reduceIdleWorkUnit(
        sample({ isActive: true, turnId: "turn-1" }),
        sample({ isActive: false, turnId: null }),
        "turn-1",
      ),
    ).toEqual({ lastTurnId: null, emit: "turn-1" });
  });

  it("stays silent on the first sample and on thread switches", () => {
    expect(reduceIdleWorkUnit(null, sample({ isActive: false }), null)).toEqual({
      lastTurnId: null,
      emit: null,
    });
    expect(
      reduceIdleWorkUnit(
        sample({ threadKey: "a", isActive: true, turnId: "turn-1" }),
        sample({ threadKey: "b", isActive: false, turnId: null }),
        "turn-1",
      ),
    ).toEqual({ lastTurnId: null, emit: null });
  });

  it("does not emit a submission-only idle that never received a turn id", () => {
    expect(
      reduceIdleWorkUnit(
        sample({ isActive: true, turnId: null }),
        sample({ isActive: false }),
        null,
      ),
    ).toEqual({ lastTurnId: null, emit: null });
  });

  it("stays silent when a manual cancellation ends the run", () => {
    expect(
      reduceIdleWorkUnit(
        sample({ isActive: true, isCancelling: true, turnId: "turn-1" }),
        sample({ isActive: false }),
        "turn-1",
      ),
    ).toEqual({ lastTurnId: null, emit: null });
  });

  it("remembers a turn id that arrives after the send looks active", () => {
    const afterSend = reduceIdleWorkUnit(
      sample({ isActive: false }),
      sample({ isActive: true, turnId: null }),
      null,
    );
    expect(afterSend).toEqual({ lastTurnId: null, emit: null });
    const afterTurn = reduceIdleWorkUnit(
      sample({ isActive: true, turnId: null }),
      sample({ isActive: true, turnId: "turn-9" }),
      afterSend.lastTurnId,
    );
    expect(afterTurn.lastTurnId).toBe("turn-9");
  });
});

describe("queueSayToMeIdle", () => {
  it("dispatches a versioned queue-idle event", () => {
    const target = document.createElement("div");
    const events: Event[] = [];
    target.addEventListener("say-to-me-queue-idle", (event) => events.push(event));
    expect(queueSayToMeIdle(target, "  turn-1  ")).toBe(true);
    expect(queueSayToMeIdle(target, "   ")).toBe(false);
    expect(events).toHaveLength(1);
    expect((events[0] as CustomEvent).detail).toMatchObject({
      source: "say-to-me-widget",
      version: 2,
      type: "queue-idle",
      workUnitId: "turn-1",
    });
  });

  it("finds the widget for the Paseo session id", () => {
    const root = document.createElement("div");
    const widget = document.createElement(SAY_TO_ME_WIDGET_TAG);
    widget.setAttribute("session-id", "pa_agent");
    root.append(widget);
    expect(findSayToMeWidget("pa_agent", root)).toBe(widget);
    expect(findSayToMeWidget("pa_other", root)).toBeNull();
  });
});
