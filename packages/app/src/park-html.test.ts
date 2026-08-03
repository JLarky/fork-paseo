import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const parkHtml = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../public/park.html"),
  "utf8",
);

function renderPark(search: string): Document {
  const dom = new JSDOM(parkHtml, {
    runScripts: "dangerously",
    url: `https://paseo.example/park.html${search}`,
  });
  return dom.window.document;
}

describe("static Park document", () => {
  it("renders the six-key contract with trimmed values in metadata order", () => {
    const document = renderPark(
      "?environmentId= server+1 &threadId= agent%2F1 &title= Fix+it &project= paseo &cwd= %2Frepo &branch= feat%2Fpark &ignored=no",
    );

    expect(
      [...document.querySelectorAll(".field")].map((field) => field.textContent?.trim()),
    ).toEqual(["TitleFix it", "Projectpaseo", "Directory/repo", "Branchfeat/park"]);
    expect(document.querySelector(".metadata")?.textContent).not.toContain("ignored");
    expect(document.querySelector(".return")?.getAttribute("href")).toBe(
      "/h/server%201/agent/agent%2F1",
    );
  });

  it("uses safe text rendering for reflected values", () => {
    const document = renderPark(
      `?environmentId=server-1&threadId=agent-1&title=${encodeURIComponent("<img src=x onerror=alert(1)>")}`,
    );

    expect(document.querySelector(".value")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")?.textContent).not.toContain(
      "<img src=x onerror=alert(1)>",
    );
  });
});
