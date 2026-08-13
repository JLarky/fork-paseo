export interface IdleCompletionDingInput {
  threadKey: string | null;
  isActive: boolean;
  isCancelling: boolean;
  speechActive?: boolean;
}

/** Native platforms do not play the browser idle completion chime. */
export function useIdleCompletionDing(_input: IdleCompletionDingInput): void {
  // no-op
}
