import { afterEach, describe, expect, it } from "vitest";
import { createParkPageHandler, PARK_PAGE_PATH, parkedPageHtml } from "./park-page.js";
import { listenWithJson, type TestProxyApp } from "./test-utils.js";

function parkUrl(query: Record<string, string>): URL {
  const url = new URL("http://park.invalid/park");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url;
}

describe("parkedPageHtml", () => {
  it("renders the message, metadata rows in T3 order, and the Paseo return link", () => {
    const html = parkedPageHtml(
      parkUrl({
        environmentId: "srv-1",
        threadId: "agent-2",
        title: "Fix parking",
        project: "fork-paseo",
        cwd: "/home/y/work/fork-paseo",
        branch: "feat/stm-whole-widget-paseo",
      }),
    );

    expect(html).toContain("<title>Session parked</title>");
    expect(html).toContain("<p>session parked</p>");
    const rows = [...html.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)].map((match) => [
      match[1],
      match[2],
    ]);
    expect(rows).toEqual([
      ["Title", "Fix parking"],
      ["Project", "fork-paseo"],
      ["Directory", "/home/y/work/fork-paseo"],
      ["Branch", "feat/stm-whole-widget-paseo"],
    ]);
    expect(html).toContain('<a href="/h/srv-1/agent/agent-2">Return to session</a>');
  });

  it("percent-encodes the return href segments", () => {
    const html = parkedPageHtml(parkUrl({ environmentId: "srv/1", threadId: "agent 2" }));

    expect(html).toContain('<a href="/h/srv%2F1/agent/agent%202">Return to session</a>');
  });

  it("escapes script and attribute injection in every reflected value", () => {
    const html = parkedPageHtml(
      parkUrl({
        environmentId: '"><script>alert(1)</script>',
        threadId: "t",
        title: "<script>alert(2)</script>",
        project: '" onmouseover="steal()',
        cwd: "/tmp/<img src=x onerror=y>",
        branch: "feat/a&b'c",
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('onmouseover="steal()"');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).toContain("&quot; onmouseover=&quot;steal()");
    expect(html).toContain("/tmp/&lt;img src=x onerror=y&gt;");
    expect(html).toContain("feat/a&amp;b&#39;c");
    // The href is built from encodeURIComponent'd segments, then escaped.
    expect(html).toContain(
      '<a href="/h/%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E/agent/t">Return to session</a>',
    );
  });

  it("omits the return link unless both required ids are nonempty", () => {
    const missingThread = parkedPageHtml(parkUrl({ environmentId: "srv-1", title: "T" }));
    const missingEnvironment = parkedPageHtml(parkUrl({ threadId: "agent-2" }));
    const emptyIds = parkedPageHtml(parkUrl({ environmentId: "", threadId: "" }));

    for (const html of [missingThread, missingEnvironment, emptyIds]) {
      expect(html).not.toContain("Return to session");
      expect(html).not.toContain("<a ");
    }
  });

  it("omits the metadata list entirely when no optional fields are present", () => {
    const html = parkedPageHtml(parkUrl({ environmentId: "srv-1", threadId: "agent-2" }));

    expect(html).not.toContain("<dl>");
    expect(html).toContain("Return to session");
  });

  it("never emits scripts or external references", () => {
    const html = parkedPageHtml(
      parkUrl({ environmentId: "srv-1", threadId: "agent-2", title: "T" }),
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("src=");
    expect(html.match(/<a /g)).toHaveLength(1);
  });
});

describe("park page handler", () => {
  let app: TestProxyApp | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it("serves escaped HTML for the exact query keys", async () => {
    app = await listenWithJson((server) => {
      server.get(PARK_PAGE_PATH, createParkPageHandler());
    });

    const response = await fetch(
      `${app.baseUrl}/park?environmentId=srv-1&threadId=agent-2&title=${encodeURIComponent(
        "<b>hey</b>",
      )}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("&lt;b&gt;hey&lt;/b&gt;");
    expect(html).toContain('<a href="/h/srv-1/agent/agent-2">Return to session</a>');
  });
});
