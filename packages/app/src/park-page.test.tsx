/** @vitest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParkPage, parkReturnHref, readParkPageMetadata } from "./park-page";

/* eslint-disable react-perf/jsx-no-new-object-as-prop */

vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Park page policy", () => {
  it("reads only the six T3 query keys and trims values", () => {
    expect(
      readParkPageMetadata({
        environmentId: " server 1 ",
        threadId: ["agent/1"],
        title: " Fix it ",
        project: " paseo ",
        cwd: " /repo ",
        branch: " feat/park ",
      }),
    ).toEqual({
      environmentId: "server 1",
      threadId: "agent/1",
      title: "Fix it",
      project: "paseo",
      cwd: "/repo",
      branch: "feat/park",
    });
  });

  it("builds the encoded stable agent return route only with both IDs", () => {
    expect(parkReturnHref({ environmentId: "server 1", threadId: "agent/1" })).toBe(
      "/h/server%201/agent/agent%2F1",
    );
    expect(parkReturnHref({ environmentId: "server-1", threadId: "" })).toBeNull();
    expect(parkReturnHref({ environmentId: "", threadId: "agent-1" })).toBeNull();
  });

  it("renders metadata as text and exposes Return to session only for a complete target", () => {
    const pageParams = {
      environmentId: "server-1",
      threadId: "agent-1",
      title: "<unsafe title>",
      project: "paseo",
      cwd: "/repo",
      branch: "main",
    };
    const { container } = render(<ParkPage params={pageParams} />);
    expect(container.textContent).toContain("session parked");
    expect(container.textContent).toContain("<unsafe title>");
    expect(container.querySelector("img, script")).toBeNull();
    expect(container.querySelector('a[href="/h/server-1/agent/agent-1"]')?.textContent).toBe(
      "Return to session",
    );

    const withoutTargetParams = { title: "No return" };
    const withoutTarget = render(<ParkPage params={withoutTargetParams} />);
    expect(withoutTarget.container.textContent).not.toContain("Return to session");
  });
});
