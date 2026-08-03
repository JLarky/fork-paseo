const DEV_SAY_TO_ME_URL = "http://localhost:5411";
const DEFAULT_SAY_TO_ME_URL = "https://say.local:1355";

/** Upstream Say To Me origin. Override with PASEO_SAY_TO_ME_BASE_URL; trailing slash is stripped. */
export function sayToMeBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PASEO_SAY_TO_ME_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (env.NODE_ENV !== "production" && env.PASEO_NODE_ENV !== "production") {
    return DEV_SAY_TO_ME_URL;
  }
  return DEFAULT_SAY_TO_ME_URL;
}

export function sayToMeUrl(pathname: string, baseUrl = sayToMeBaseUrl()): string {
  return new URL(pathname, `${baseUrl}/`).toString();
}
