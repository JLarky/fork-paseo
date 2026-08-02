/** Native platforms do not use the browser send ding. */
export async function playSendDing(): Promise<boolean> {
  return false;
}
