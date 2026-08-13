export interface IdleCompletionDingInput {
  threadKey: string | null;
  sessionId: string | null;
  isActive: boolean;
  isCancelling: boolean;
  turnId: string | null;
}

/** Native platforms do not play the browser idle completion chime. */
export function useIdleCompletionDing(_input: IdleCompletionDingInput): void {
  // no-op
}
