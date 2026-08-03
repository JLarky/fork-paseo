import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestPaseoDaemon, type TestPaseoDaemon } from "./test-utils/paseo-daemon.js";

describe("bootstrap /park page mounting", () => {
  let daemon: TestPaseoDaemon;

  beforeAll(async () => {
    const distDir = await mkdtemp(path.join(os.tmpdir(), "paseo-web-dist-"));
    await writeFile(path.join(distDir, "index.html"), "<html><body>SPA FALLBACK</body></html>");
    daemon = await createTestPaseoDaemon({
      auth: { password: "park-page-test-password" },
      webUi: { enabled: true, distDir },
    });
  });

  afterAll(async () => {
    await daemon?.close();
  });

  it("serves the parked page before the SPA fallback and without daemon auth", async () => {
    const response = await fetch(
      `http://127.0.0.1:${daemon.port}/park?environmentId=srv-1&threadId=agent-2&title=Park+me`,
    );
    const status = await fetch(`http://127.0.0.1:${daemon.port}/api/status`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).not.toContain("SPA FALLBACK");
    expect(html).toContain("<p>session parked</p>");
    expect(html).toContain("Park me");
    expect(html).toContain('<a href="/h/srv-1/agent/agent-2">Return to session</a>');
    // The daemon password still protects the API surface on the same server.
    expect(status.status).toBe(401);
  });

  it("reflects only escaped values and omits the link on missing ids", async () => {
    const injected = await fetch(
      `http://127.0.0.1:${daemon.port}/park?environmentId=srv-1&title=${encodeURIComponent(
        '<script>alert(1)</script>" onload="x',
      )}`,
    );

    expect(injected.status).toBe(200);
    const html = await injected.text();
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;&quot; onload=&quot;x");
    expect(html).not.toContain("Return to session");
  });
});
