import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApplicationGitSyncOutcome, BewerbungsManagerApi } from "../shared/ipc";
import { defaultSettings, type Application, type Workspace } from "../shared/schema";
import { gitSyncFailedMessage, useAppStore } from "./useAppStore";

const workspace: Workspace = {
  schemaVersion: 1,
  applications: [{ id: "bewerbung-1" } as Application],
  profiles: [],
  events: [],
  attachments: [],
  todos: [],
  customCvDesigns: [],
  settings: defaultSettings,
  updatedAt: "2026-10-08T10:00:00.000Z",
};

const installApi = (gitSync: ApplicationGitSyncOutcome) => {
  const result = { workspace, gitSync };
  const applications = {
    create: vi.fn(async () => result),
    save: vi.fn(async () => result),
    changeStatus: vi.fn(async () => result),
  };
  vi.stubGlobal("window", { bewerbungsManager: { applications } as unknown as BewerbungsManagerApi });
  return applications;
};

afterEach(() => {
  vi.unstubAllGlobals();
  useAppStore.setState({ error: undefined, notice: undefined, loading: false });
});

describe("application changes with GitHub synchronisation", () => {
  it("names the GitHub synchronisation after a successful push", async () => {
    installApi({ state: "synced", committed: true, pushed: true });
    await useAppStore.getState().saveApplication(workspace.applications[0]);
    expect(useAppStore.getState()).toMatchObject({
      notice: "Änderungen wurden gespeichert und mit GitHub synchronisiert.", error: undefined, loading: false,
    });

    await useAppStore.getState().createApplication({} as never);
    expect(useAppStore.getState().notice).toBe("Bewerbung wurde angelegt und mit GitHub synchronisiert.");

    await useAppStore.getState().changeStatus("bewerbung-1", "Zusage");
    expect(useAppStore.getState().notice).toBe("Status wurde auf „Zusage“ gesetzt und mit GitHub synchronisiert.");
  });

  it("keeps the old notice when nothing had to be synchronised", async () => {
    installApi({ state: "skipped" });
    await useAppStore.getState().saveApplication(workspace.applications[0]);
    expect(useAppStore.getState().notice).toBe("Änderungen wurden gespeichert.");
  });

  it("shows a failed push as an error but keeps the saved workspace and resolves", async () => {
    installApi({ state: "failed", code: "auth-failed", reason: "Die Anmeldung bei GitHub ist fehlgeschlagen." });
    useAppStore.setState({ workspace: { ...workspace, applications: [] } });

    await expect(useAppStore.getState().saveApplication(workspace.applications[0])).resolves.toBeUndefined();

    expect(useAppStore.getState()).toMatchObject({
      workspace,
      loading: false,
      notice: undefined,
      error: `${gitSyncFailedMessage} Die Anmeldung bei GitHub ist fehlgeschlagen.`,
    });
  });
});
