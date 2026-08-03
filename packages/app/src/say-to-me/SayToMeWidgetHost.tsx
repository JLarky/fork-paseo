import type { ParkSessionContext } from "./widget";

export interface SayToMeWidgetHostProps extends ParkSessionContext {
  readonly sessionId: string;
}

export function SayToMeWidgetHost(_props: SayToMeWidgetHostProps) {
  return null;
}
