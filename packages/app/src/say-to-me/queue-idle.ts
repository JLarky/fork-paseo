import { SAY_TO_ME_WIDGET_TAG } from "./widget";

export const SAY_TO_ME_QUEUE_IDLE_EVENT = "say-to-me-queue-idle" as const;

export interface IdleTurnSample {
  readonly threadKey: string | null;
  readonly isActive: boolean;
  readonly isCancelling: boolean;
  readonly turnId: string | null;
}

/** Remember the daemon turn while active; emit it once when that turn goes idle. */
export function reduceIdleWorkUnit(
  previous: IdleTurnSample | null,
  next: IdleTurnSample,
  lastTurnId: string | null,
): { lastTurnId: string | null; emit: string | null } {
  if (previous === null || previous.threadKey !== next.threadKey) {
    return { lastTurnId: next.isActive ? next.turnId : null, emit: null };
  }
  const remembered = next.isActive && next.turnId ? next.turnId : lastTurnId;
  if (previous.isActive && !next.isActive && !previous.isCancelling && remembered) {
    return { lastTurnId: null, emit: remembered };
  }
  return { lastTurnId: next.isActive ? remembered : null, emit: null };
}

export function queueSayToMeIdle(widget: EventTarget, workUnitId: string): boolean {
  const id = workUnitId.trim();
  if (!id) return false;
  widget.dispatchEvent(
    new CustomEvent(SAY_TO_ME_QUEUE_IDLE_EVENT, {
      bubbles: true,
      composed: true,
      detail: {
        source: "say-to-me-widget",
        version: 2,
        type: "queue-idle",
        workUnitId: id,
      },
    }),
  );
  return true;
}

export function findSayToMeWidget(sessionId: string, root: ParentNode = document): Element | null {
  const id = sessionId.trim();
  if (!id) return null;
  return root.querySelector(`${SAY_TO_ME_WIDGET_TAG}[session-id="${id}"]`);
}
