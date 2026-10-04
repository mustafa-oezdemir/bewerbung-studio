import type { WorkspaceStatus } from "./ipc";

const incompatibleBuildMessage =
  "Die Anwendungskomponenten passen nicht zusammen. Bitte BewerbungsManager vollständig schließen und mit der aktuellen Version neu starten.";

export const requireWorkspaceStatus = (value: unknown): WorkspaceStatus => {
  if (!value || typeof value !== "object" || !("state" in value))
    throw new Error(incompatibleBuildMessage);
  const status = value as Record<string, unknown>;
  if (status.state === "setup") return { state: "setup" };
  if ((status.state === "ready" || status.state === "locked" || status.state === "missing") &&
      typeof status.root === "string") return value as WorkspaceStatus;
  if (status.state === "error" && typeof status.root === "string" && typeof status.message === "string")
    return value as WorkspaceStatus;
  throw new Error(incompatibleBuildMessage);
};
