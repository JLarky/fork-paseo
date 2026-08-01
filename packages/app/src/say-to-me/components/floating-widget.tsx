export function SayToMeInlineWidget(_: {
  serverId: string;
  agentId: string;
  onInsertUsagePrompt: (prompt: string) => void;
  context?: {
    readonly sessionTitle?: string | null;
    readonly projectName?: string | null;
    readonly workingDirectory?: string | null;
    readonly branchName?: string | null;
  };
  onOpenSession?: (sessionId: string) => void;
  onParkSession?: (sessionId: string) => void;
}) {
  return null;
}
