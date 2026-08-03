const PASEO_AGENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PASEO_SESSION_ID_PATTERN =
  /^pa_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function paseoVoiceSessionId(agentId: string): string | null {
  const paseoSession = PASEO_SESSION_ID_PATTERN.exec(agentId);
  const uuid = paseoSession?.[1] ?? (PASEO_AGENT_ID_PATTERN.test(agentId) ? agentId : null);
  return uuid ? `pa_${uuid}` : null;
}
