import { describe, expect, it } from "vitest";
import { sayToMeBaseUrl, sayToMeUrl } from "./base-url.js";

describe("sayToMeBaseUrl", () => {
  it("defaults to the dev server outside production", () => {
    expect(sayToMeBaseUrl({})).toBe("http://localhost:5411");
  });

  it("defaults to the packaged origin in production", () => {
    expect(sayToMeBaseUrl({ NODE_ENV: "production" })).toBe("https://say.local:1355");
    expect(sayToMeBaseUrl({ PASEO_NODE_ENV: "production" })).toBe("https://say.local:1355");
  });

  it("prefers the override and strips a trailing slash", () => {
    expect(sayToMeBaseUrl({ PASEO_SAY_TO_ME_BASE_URL: "http://stm.test:9999/" })).toBe(
      "http://stm.test:9999",
    );
    expect(sayToMeBaseUrl({ PASEO_SAY_TO_ME_BASE_URL: "  http://stm.test:9999  " })).toBe(
      "http://stm.test:9999",
    );
  });

  it("builds fixed upstream URLs from the base", () => {
    expect(sayToMeUrl("/embed/widget.js", "http://stm.test:9999")).toBe(
      "http://stm.test:9999/embed/widget.js",
    );
  });
});
