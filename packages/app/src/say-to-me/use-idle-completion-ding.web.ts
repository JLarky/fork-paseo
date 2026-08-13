import { useEffect, useRef } from "react";

import { delay, enqueueSound, isSpeechActive } from "./audio-queue.web";
import {
  IDLE_COMPLETION_DING_DURATION_MS,
  playIdleCompletionDing,
} from "./idle-completion-ding.web";

export interface IdleCompletionDingInput {
  /** Identifies the watched agent/session so switching threads is not heard as going idle. */
  threadKey: string | null;
  /** Whether the agent currently has an active turn. */
  isActive: boolean;
  /** Whether the active turn is being manually cancelled. */
  isCancelling: boolean;
  speechActive?: boolean;
}

/**
 * Decides whether a sample should sound the idle chime. Only an active-to-
 * idle transition on the same thread counts, and only when the turn was not
 * manually cancelled — that stays silent, same as a Say To Me / T3 Code
 * interrupt.
 */
export function shouldPlayIdleCompletionDing(
  previous: IdleCompletionDingInput | null,
  next: IdleCompletionDingInput,
): boolean {
  if (previous === null) return false;
  if (previous.threadKey !== next.threadKey) return false;
  if (previous.isCancelling) return false;
  return previous.isActive && !next.isActive;
}

/**
 * Plays the Say To Me idle chime when the watched agent finishes its turn.
 * The chime is queued behind any voice note the widget is speaking so the two
 * never overlap.
 */
export function useIdleCompletionDing({
  threadKey,
  isActive,
  isCancelling,
  speechActive = false,
}: IdleCompletionDingInput): void {
  const previousRef = useRef<IdleCompletionDingInput | null>(null);
  const speechActiveRef = useRef(speechActive);
  speechActiveRef.current = speechActive;

  useEffect(() => {
    const next = { threadKey, isActive, isCancelling };
    const previous = previousRef.current;
    previousRef.current = next;
    if (!shouldPlayIdleCompletionDing(previous, next)) return;

    void enqueueSound(
      async () => {
        // Speech started outside the queue (a note already being read aloud)
        // still has to finish before the chime is audible.
        while (speechActiveRef.current || isSpeechActive()) await delay(200);
        await playIdleCompletionDing();
        await delay(IDLE_COMPLETION_DING_DURATION_MS);
      },
      { timeoutMs: 60_000 },
    );
  }, [threadKey, isActive, isCancelling]);
}
