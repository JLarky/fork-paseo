import type express from "express";

export const PARK_PAGE_PATH = "/park";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

/** Labels are hardcoded literals; only the caller-supplied value is escaped. */
function parkedPageField(label: string, value: string | null): string {
  return value ? `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>` : "";
}

/**
 * Mirrors T3's parked-session page: a static, script-free HTML document that
 * reflects only its own escaped query parameters. The return link targets
 * Paseo's stable agent route instead of T3's thread route.
 */
export function parkedPageHtml(url: URL): string {
  const environmentId = url.searchParams.get("environmentId");
  const threadId = url.searchParams.get("threadId");
  const title = url.searchParams.get("title");
  const project = url.searchParams.get("project");
  const cwd = url.searchParams.get("cwd");
  const branch = url.searchParams.get("branch");
  const fields = [
    parkedPageField("Title", title),
    parkedPageField("Project", project),
    parkedPageField("Directory", cwd),
    parkedPageField("Branch", branch),
  ].join("");
  const returnHref =
    environmentId && threadId
      ? `/h/${encodeURIComponent(environmentId)}/agent/${encodeURIComponent(threadId)}`
      : null;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Session parked</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
      main { width: min(36rem, calc(100% - 3rem)); text-align: center; }
      p { font-size: 1.125rem; font-weight: 600; }
      dl { margin: 1.5rem 0 0; text-align: left; color: GrayText; font-size: .875rem; }
      dl div { display: flex; gap: .75rem; margin: .5rem 0; }
      dt { width: 5rem; flex: none; color: CanvasText; font-weight: 600; }
      dd { margin: 0; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>
      <p>session parked</p>
      ${fields ? `<dl>${fields}</dl>` : ""}
      ${returnHref ? `<a href="${escapeHtml(returnHref)}">Return to session</a>` : ""}
    </main>
  </body>
</html>`;
}

export function createParkPageHandler(): express.RequestHandler {
  return (req, res) => {
    const url = new URL(req.originalUrl, "http://park.invalid");
    res.status(200).type("text/html; charset=utf-8").send(parkedPageHtml(url));
  };
}
