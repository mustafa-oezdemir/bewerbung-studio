import { describe, expect, it } from "vitest";
import { requireWorkspaceStatus } from "./workspaceStatus";

describe("workspace status boundary", () => {
  it("accepts a current Electron status", () => {
    expect(requireWorkspaceStatus({ state: "ready", root: "C:\\Bewerbungen" }))
      .toEqual({ state: "ready", root: "C:\\Bewerbungen" });
    expect(requireWorkspaceStatus({ state: "setup" })).toEqual({ state: "setup" });
  });

  it("reports a stale preload instead of silently returning to setup", () => {
    expect(() => requireWorkspaceStatus({ ok: true, data: { state: "ready", root: "C:\\Bewerbungen" } }))
      .toThrow("Anwendungskomponenten passen nicht zusammen");
    expect(() => requireWorkspaceStatus({ state: "ready" })).toThrow("Anwendungskomponenten passen nicht zusammen");
  });
});
