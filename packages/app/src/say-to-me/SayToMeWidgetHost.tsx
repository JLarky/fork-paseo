import type { ParkSessionContext } from "./widget";

export interface SayToMeWidgetHostProps extends ParkSessionContext {
  readonly sessionId: string;
  readonly onInsertUsagePrompt?: (prompt: string) => void;
}

export function SayToMeWidgetHost(_props: SayToMeWidgetHostProps) {
  return null;
}
