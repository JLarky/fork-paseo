export type SayToMeSessionState = "loading" | "missing" | "ready" | "unavailable";

export const SAY_TO_ME_USAGE_PROMPT_PREFIX =
  "you have to reply to my messages with voice (cli `say-to-me usage` to learn how/why) and your session id is ";

export function buildSayToMeUsagePrompt(sessionId: string): string {
  return `${SAY_TO_ME_USAGE_PROMPT_PREFIX}${sessionId}`;
}
