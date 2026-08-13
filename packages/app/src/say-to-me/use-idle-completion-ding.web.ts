import { useEffect, useRef } from "react";

import { findSayToMeWidget, queueSayToMeIdle, reduceIdleWorkUnit } from "./queue-idle";

export interface IdleCompletionDingInput {
  /** Identifies the watched agent/session so switching threads is not heard as going idle. */
  threadKey: string | null;
  /** STM widget session id, for example `pa_<agentId>`. */
  sessionId: string | null;
  /** Whether the agent currently has an active turn. */
  isActive: boolean;
  /** Whether the active turn is being manually cancelled. */
  isCancelling: boolean;
  /** Daemon turn id while the stop button is showing, else null. */
  turnId: string | null;
}

/**
 * Asks the Say To Me widget to play the idle chime when a daemon turn ends.
 * The widget owns playback and de-duplicates work unit ids.
 */
export function useIdleCompletionDing({
  threadKey,
  sessionId,
  isActive,
  isCancelling,
  turnId,
}: IdleCompletionDingInput): void {
  const previousRef = useRef<IdleCompletionDingInput | null>(null);
  const lastTurnIdRef = useRef<string | null>(null);
  const emittedRef = useRef(new Set<string>());

  useEffect(() => {
    const next = { threadKey, isActive, isCancelling, turnId };
    const previous = previousRef.current
      ? {
          threadKey: previousRef.current.threadKey,
          isActive: previousRef.current.isActive,
          isCancelling: previousRef.current.isCancelling,
          turnId: previousRef.current.turnId,
        }
      : null;
    previousRef.current = { threadKey, sessionId, isActive, isCancelling, turnId };
    const result = reduceIdleWorkUnit(previous, next, lastTurnIdRef.current);
    lastTurnIdRef.current = result.lastTurnId;
    if (!result.emit || !sessionId || emittedRef.current.has(result.emit)) return;
    emittedRef.current.add(result.emit);
    const widget = findSayToMeWidget(sessionId);
    if (widget) queueSayToMeIdle(widget, result.emit);
  }, [threadKey, sessionId, isActive, isCancelling, turnId]);
}
