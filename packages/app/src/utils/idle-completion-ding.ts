/** Native platforms do not use the browser idle completion chime. */
export async function playIdleCompletionDing(): Promise<boolean> {
  return false;
}

export const IDLE_COMPLETION_DING_DURATION_MS = 0;
