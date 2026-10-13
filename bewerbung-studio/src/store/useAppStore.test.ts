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

  it("reports failed document and attachment pushes without claiming success", async () => {
    const gitSync = { state: "failed" as const, code: "network", reason: "GitHub ist nicht erreichbar." };
    vi.stubGlobal("window", { bewerbungsManager: {
      templates: { syncAnschreiben: vi.fn(async () => ({ document: { fileName: "Fiktiv.docx" }, gitSync })) },
      attachments: { save: vi.fn(async () => ({ workspace, gitSync })) },
      export: { pdf: vi.fn(async () => ({ path: "C:/Test/Fiktiv.pdf", gitSync })) },
    } as unknown as BewerbungsManagerApi });
    await useAppStore.getState().syncCoverLetter("bewerbung-1");
    expect(useAppStore.getState()).toMatchObject({ notice: undefined,
      error: `${gitSyncFailedMessage} GitHub ist nicht erreichbar.` });
    await useAppStore.getState().saveAttachment({} as never);
    expect(useAppStore.getState()).toMatchObject({ workspace, notice: undefined,
      error: `${gitSyncFailedMessage} GitHub ist nicht erreichbar.` });
    await useAppStore.getState().exportPdf("bewerbung-1", "lebenslauf");
    expect(useAppStore.getState()).toMatchObject({ notice: undefined,
      error: `${gitSyncFailedMessage} GitHub ist nicht erreichbar.` });
  });

  it("reports the synchronisation of appointments and the Bewerbungsfrist todo", async () => {
    const outcome = { current: { state: "synced", committed: true, pushed: true } as ApplicationGitSyncOutcome };
    const result = async () => ({ workspace, gitSync: outcome.current });
    vi.stubGlobal("window", { bewerbungsManager: {
      events: { save: vi.fn(result) },
      todos: { save: vi.fn(result), remove: vi.fn(result) },
    } as unknown as BewerbungsManagerApi });
    await useAppStore.getState().saveEvent({} as never);
    expect(useAppStore.getState().notice).toBe("Kalendereintrag wurde aktualisiert und mit GitHub synchronisiert.");
    await useAppStore.getState().saveTodo({} as never);
    expect(useAppStore.getState().notice).toBe("Aufgabe wurde gespeichert und mit GitHub synchronisiert.");

    outcome.current = { state: "skipped" };
    await useAppStore.getState().removeTodo("aufgabe-1");
    expect(useAppStore.getState()).toMatchObject({ notice: "Aufgabe wurde gelöscht.", error: undefined });

    outcome.current = { state: "failed", code: "network", reason: "GitHub ist nicht erreichbar." };
    await useAppStore.getState().saveTodo({} as never);
    expect(useAppStore.getState()).toMatchObject({ workspace, notice: undefined,
      error: `${gitSyncFailedMessage} GitHub ist nicht erreichbar.` });
  });

  it("does not call a local save synced when no commit or push happened", async () => {
    installApi({ state: "synced", committed: false, pushed: false });
    await useAppStore.getState().saveApplication(workspace.applications[0]);
    expect(useAppStore.getState().notice).toBe("Änderungen wurden gespeichert.");
  });
});
