import { create } from "zustand";
import type { ResumeDesignLayer } from "../shared/cvDesignSchema";
import type { ApplicationChangeResult, ApplicationGitSyncOutcome, DocumentFolderTarget, ExportTarget } from "../shared/ipc";
import {
  defaultSettings,
  type ApplicantProfile,
  type Application,
  type ApplicationInput,
  type ApplicationStatus,
  type AppSettings,
  type Attachment,
  type AttachmentCategory,
  type CalendarEvent,
  type CustomCvDesign,
  type RejectionReason,
  type Todo,
  type Workspace,
} from "../shared/schema";

const emptyWorkspace: Workspace = {
  schemaVersion: 1,
  applications: [],
  profiles: [],
  events: [],
  attachments: [],
  todos: [],
  customCvDesigns: [],
  settings: defaultSettings,
  updatedAt: new Date().toISOString(),
};

/** The GitHub side of the last save: the local save is done in every state. */
export type GitSyncStatus =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "synced" }
  | { state: "failed"; reason: string };

type StoreState = {
  workspace: Workspace;
  selectedApplicationId?: string;
  selectedProfileId?: string;
  /** A local save (or another data operation) is running; the GitHub synchronisation is `gitSync`. */
  loading: boolean;
  gitSync: GitSyncStatus;
  error?: string;
  notice?: string;
  hydrate: () => Promise<void>;
  selectApplication: (id?: string) => void;
  selectProfile: (id?: string) => void;
  createApplication: (input: ApplicationInput) => Promise<void>;
  saveApplication: (application: Application) => Promise<void>;
  syncCoverLetter: (applicationId: string) => Promise<void>;
  /**
   * A save made outside the store (e.g. the interview notes) reports its local result and its GitHub synchronisation
   * like every other save: a failed synchronisation is an error, the local save stays done.
   */
  reportSavedChange: (notice: string, syncedNotice: string, gitSync: ApplicationGitSyncOutcome) => void;
  removeApplication: (id: string) => Promise<void>;
  duplicateApplication: (id: string) => Promise<void>;
  changeStatus: (
    id: string,
    status: ApplicationStatus,
    reason?: RejectionReason,
  ) => Promise<void>;
  saveProfile: (profile: ApplicantProfile) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  /** Persist the shared Lebenslauf design (`settings.resumeDesign`); `undefined` removes it. */
  saveResumeDesign: (layer: ResumeDesignLayer | undefined) => Promise<void>;
  saveEvent: (event: CalendarEvent) => Promise<void>;
  saveTodo: (todo: Todo) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;
  saveCustomCvDesign: (design: CustomCvDesign) => Promise<void>;
  removeCustomCvDesign: (id: string) => Promise<void>;
  addAttachment: (
    applicationId: string,
    category: AttachmentCategory,
  ) => Promise<void>;
  saveAttachment: (attachment: Attachment) => Promise<void>;
  moveAttachment: (id: string, direction: -1 | 1) => Promise<void>;
  removeAttachment: (id: string) => Promise<void>;
  openAttachment: (id: string) => Promise<void>;
  exportPdf: (
    applicationId: string,
    target: ExportTarget,
    application?: Application,
  ) => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
  exportSettings: () => Promise<void>;
  importSettings: () => Promise<void>;
  importLegacyData: () => Promise<void>;
  openFolder: (id: string, document?: DocumentFolderTarget) => Promise<void>;
  clearMessage: () => void;
};

const apiAvailable = () => typeof window.bewerbungsManager !== "undefined";

export const gitSyncFailedMessage = "Lokal gespeichert – GitHub-Synchronisierung fehlgeschlagen.";
export const gitSyncPendingNotice = "Lokal gespeichert, GitHub-Synchronisierung läuft …";
export const gitSyncedNotice = "Mit GitHub synchronisiert.";

export const useAppStore = create<StoreState>((set, get) => {
  // The newest save that waits for GitHub: an older synchronisation finishing does not settle it.
  let awaitedSync: { syncId: number; local: string; synced: string } | null = null;
  let subscribed = false;

  /** The notice for a local result whose synchronisation runs in the background. */
  const pendingNotice = (notice: string, syncedNotice: string, gitSync: Extract<ApplicationGitSyncOutcome, { state: "pending" }>) => {
    awaitedSync = { syncId: gitSync.syncId, local: notice, synced: syncedNotice };
    return { notice: `${notice} ${gitSyncPendingNotice}`, gitSync: { state: "pending" } as const };
  };

  /** The outcome of a background synchronisation (main process): GitHub reached, skipped or failed. */
  const applyGitSyncStatus = (outcome: ApplicationGitSyncOutcome, syncId: number) => {
    if (outcome.state === "pending") return;
    if (outcome.state === "failed") {
      if (awaitedSync && syncId >= awaitedSync.syncId) awaitedSync = null;
      set({ notice: undefined, error: `${gitSyncFailedMessage} ${outcome.reason}`, gitSync: { state: "failed", reason: outcome.reason } });
      return;
    }
    if (!awaitedSync || syncId < awaitedSync.syncId) return;
    const awaited = awaitedSync;
    awaitedSync = null;
    set(outcome.state === "synced" && (outcome.pushed || outcome.committed)
      ? { notice: awaited.synced, gitSync: { state: "synced" } }
      : { notice: awaited.local, gitSync: { state: "idle" } });
  };

  const subscribeGitSync = () => {
    if (subscribed || !apiAvailable() || !window.bewerbungsManager.gitSync) return;
    subscribed = true;
    window.bewerbungsManager.gitSync.onStatus(applyGitSyncStatus);
  };

  const perform = async (action: () => Promise<Workspace>, notice: string) => {
    set({ loading: true, error: undefined });
    try {
      const workspace = await action();
      set({ workspace, loading: false, notice });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Ein Fehler ist aufgetreten.",
      });
      throw error;
    }
  };

  /**
   * A result means the local save succeeded: the form is free again at once. The GitHub synchronisation follows in
   * the background ("pending") and reports through `applyGitSyncStatus`; a failed push is shown as an error but
   * never thrown and never undoes the local save.
   */
  const performApplicationChange = async (
    action: () => Promise<ApplicationChangeResult>,
    notice: string,
    syncedNotice: string,
  ) => {
    subscribeGitSync();
    set({ loading: true, error: undefined });
    try {
      const { workspace, gitSync } = await action();
      set(gitSync.state === "failed"
        ? { workspace, loading: false, notice: undefined, error: `${gitSyncFailedMessage} ${gitSync.reason}`,
          gitSync: { state: "failed", reason: gitSync.reason } }
        : gitSync.state === "pending"
          ? { workspace, loading: false, error: undefined, ...pendingNotice(notice, syncedNotice, gitSync) }
          : { workspace, loading: false,
            notice: gitSync.state === "synced" && gitSync.pushed ? syncedNotice : notice,
            gitSync: { state: gitSync.state === "synced" && gitSync.pushed ? "synced" : "idle" } });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Ein Fehler ist aufgetreten.",
      });
      throw error;
    }
  };

  return {
    workspace: emptyWorkspace,
    loading: true,
    gitSync: { state: "idle" },
    async hydrate() {
      if (!apiAvailable()) {
        set({ workspace: emptyWorkspace, loading: false });
        return;
      }
      subscribeGitSync();
      try {
        const workspace = await window.bewerbungsManager.workspace.get();
        set({
          workspace,
          loading: false,
          selectedApplicationId: workspace.applications[0]?.id,
        });
      } catch (error) {
        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Daten konnten nicht geladen werden.",
        });
      }
    },
    selectApplication: (id) =>
      set({ selectedApplicationId: id, selectedProfileId: undefined }),
    selectProfile: (id) => set({ selectedProfileId: id }),
    async createApplication(input) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.applications.create(input),
        "Bewerbung wurde angelegt.",
        "Bewerbung wurde angelegt und mit GitHub synchronisiert.",
      );
      set({
        selectedApplicationId: get().workspace.applications[0]?.id,
      });
    },
    async saveApplication(application) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.applications.save(application),
        "Änderungen wurden gespeichert.",
        "Änderungen wurden gespeichert und mit GitHub synchronisiert.",
      );
    },
    reportSavedChange(notice, syncedNotice, gitSync) {
      subscribeGitSync();
      set(gitSync.state === "failed"
        ? { notice: undefined, error: `${gitSyncFailedMessage} ${gitSync.reason}`, gitSync: { state: "failed", reason: gitSync.reason } }
        : gitSync.state === "pending"
          ? { error: undefined, ...pendingNotice(notice, syncedNotice, gitSync) }
          : { error: undefined, notice: gitSync.state === "synced" && gitSync.pushed ? syncedNotice : notice,
            gitSync: { state: gitSync.state === "synced" && gitSync.pushed ? "synced" : "idle" } });
    },
    async syncCoverLetter(applicationId) {
      if (!apiAvailable()) return;
      subscribeGitSync();
      set({ loading: true, error: undefined });
      try {
        const { document, gitSync } =
          await window.bewerbungsManager.templates.syncAnschreiben(
            applicationId,
          );
        const updated = `Word-Datei wurde aktualisiert: ${document.fileName}`;
        set(gitSync.state === "failed"
          ? { loading: false, notice: undefined, error: `${gitSyncFailedMessage} ${gitSync.reason}` }
          : gitSync.state === "pending"
            ? { loading: false, ...pendingNotice(updated, `${updated} ${gitSyncedNotice}`, gitSync) }
            : { loading: false, notice: updated });
      } catch (error) {
        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Die Word-Datei konnte nicht aktualisiert werden.",
        });
      }
    },
    async removeApplication(id) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.applications.remove(id),
        "Bewerbung wurde gelöscht und unter „Silinenler“ archiviert.",
        "Bewerbung wurde gelöscht, archiviert und mit GitHub synchronisiert.",
      );
      set({
        selectedApplicationId: get().workspace.applications[0]?.id,
      });
    },
    async duplicateApplication(id) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.applications.duplicate(id),
        "Bewerbung wurde als Entwurf dupliziert.",
        "Bewerbung wurde dupliziert und mit GitHub synchronisiert.",
      );
      set({
        selectedApplicationId: get().workspace.applications[0]?.id,
      });
    },
    async changeStatus(id, status, reason) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () =>
          window.bewerbungsManager.applications.changeStatus(
            id,
            status,
            reason,
          ),
        `Status wurde auf „${status}“ gesetzt.`,
        `Status wurde auf „${status}“ gesetzt und mit GitHub synchronisiert.`,
      );
    },
    async saveProfile(profile) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.profiles.save(profile),
        "Profil wurde gespeichert.",
        "Profil wurde gespeichert und mit GitHub synchronisiert.",
      );
    },
    async removeProfile(id) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.profiles.remove(id),
        "Profil wurde gelöscht.",
        "Profil wurde gelöscht und mit GitHub synchronisiert.",
      );
      if (get().selectedProfileId === id) {
        set({ selectedProfileId: undefined });
      }
    },
    async saveSettings(settings) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.settings.save(settings),
        "Einstellungen wurden gespeichert.",
        "Einstellungen wurden gespeichert und mit GitHub synchronisiert.",
      );
    },
    async saveResumeDesign(layer) {
      const { resumeDesign: _previous, ...settings } = get().workspace.settings;
      const next: AppSettings = { ...settings, ...(layer ? { resumeDesign: layer } : {}) };
      if (!apiAvailable()) {
        set((state) => ({ workspace: { ...state.workspace, settings: next } }));
        return;
      }
      await performApplicationChange(
        () => window.bewerbungsManager.settings.save(next),
        "Lebenslauf-Design wurde gespeichert.",
        "Lebenslauf-Design wurde gespeichert und mit GitHub synchronisiert.",
      );
    },
    async saveEvent(event) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.events.save(event),
        "Kalendereintrag wurde aktualisiert.",
        "Kalendereintrag wurde aktualisiert und mit GitHub synchronisiert.",
      );
    },
    async saveTodo(todo) {
      if (!apiAvailable()) {
        set((state) => ({ workspace: { ...state.workspace, todos: [todo, ...state.workspace.todos.filter((item) => item.id !== todo.id)] } }));
        return;
      }
      await performApplicationChange(
        () => window.bewerbungsManager.todos.save(todo),
        "Aufgabe wurde gespeichert.",
        "Aufgabe wurde gespeichert und mit GitHub synchronisiert.",
      );
    },
    async removeTodo(id) {
      if (!apiAvailable()) {
        set((state) => ({ workspace: { ...state.workspace, todos: state.workspace.todos.filter((item) => item.id !== id) } }));
        return;
      }
      await performApplicationChange(
        () => window.bewerbungsManager.todos.remove(id),
        "Aufgabe wurde gelöscht.",
        "Aufgabe wurde gelöscht und mit GitHub synchronisiert.",
      );
    },
    async saveCustomCvDesign(design) {
      if (!apiAvailable()) {
        set((state) => ({ workspace: { ...state.workspace, customCvDesigns: [design, ...state.workspace.customCvDesigns.filter((item) => item.id !== design.id)] } }));
        return;
      }
      await perform(() => window.bewerbungsManager.customCvDesigns.save(design), "Design wurde gespeichert.");
    },
    async removeCustomCvDesign(id) {
      if (!apiAvailable()) {
        set((state) => ({ workspace: { ...state.workspace, customCvDesigns: state.workspace.customCvDesigns.filter((item) => item.id !== id) } }));
        return;
      }
      await perform(() => window.bewerbungsManager.customCvDesigns.remove(id), "Design wurde gelöscht.");
    },
    async addAttachment(applicationId, category) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.attachments.add(applicationId, category),
        "Dokument wurde zur Bewerbungsmappe hinzugefügt.",
        "Dokument wurde hinzugefügt und mit GitHub synchronisiert.",
      );
    },
    async saveAttachment(attachment) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.attachments.save(attachment),
        "Dokumentdaten wurden gespeichert.",
        "Dokumentdaten wurden gespeichert und mit GitHub synchronisiert.",
      );
    },
    async moveAttachment(id, direction) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.attachments.move(id, direction),
        "Reihenfolge wurde aktualisiert.",
        "Reihenfolge wurde aktualisiert und mit GitHub synchronisiert.",
      );
    },
    async removeAttachment(id) {
      if (!apiAvailable()) return;
      await performApplicationChange(
        () => window.bewerbungsManager.attachments.remove(id),
        "Dokumentverknüpfung wurde entfernt.",
        "Dokumentverknüpfung wurde entfernt und mit GitHub synchronisiert.",
      );
    },
    async openAttachment(id) {
      if (!apiAvailable()) return;
      try {
        await window.bewerbungsManager.attachments.open(id);
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : "Dokument konnte nicht geöffnet werden.",
        });
      }
    },
    async exportPdf(applicationId, target, application) {
      if (!apiAvailable()) return;
      subscribeGitSync();
      set({ loading: true, error: undefined });
      try {
        const { path: result, gitSync } = await window.bewerbungsManager.export.pdf(
          applicationId,
          target,
          application,
        );
        // The user chose the place in the save dialog; the notice says where it went (cancelled: no notice).
        const saved = result ? `PDF gespeichert: ${result}` : undefined;
        set(gitSync.state === "failed"
          ? { loading: false, notice: undefined, error: `${gitSyncFailedMessage} ${gitSync.reason}` }
          : gitSync.state === "pending" && saved
            ? { loading: false, ...pendingNotice(saved, `${saved} ${gitSyncedNotice}`, gitSync) }
            : { loading: false, notice: saved });
      } catch (error) {
        set({
          loading: false,
          error:
            error instanceof Error ? error.message : "Export fehlgeschlagen.",
        });
      }
    },
    async exportBackup() {
      if (!apiAvailable()) return;
      const result = await window.bewerbungsManager.export.backup();
      if (result) set({ notice: "JSON-Sicherung wurde exportiert." });
    },
    async importBackup() {
      if (!apiAvailable()) return;
      set({ loading: true, error: undefined });
      try {
        const workspace = await window.bewerbungsManager.export.importBackup();
        if (workspace) {
          set({
            workspace,
            selectedApplicationId: workspace.applications[0]?.id,
            loading: false,
            notice: "JSON-Sicherung wurde geprüft und wiederhergestellt.",
          });
        } else {
          set({ loading: false });
        }
      } catch (error) {
        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Sicherung konnte nicht importiert werden.",
        });
      }
    },
    async exportSettings() {
      if (!apiAvailable()) return;
      const result = await window.bewerbungsManager.export.settings();
      if (result) set({ notice: "Einstellungen wurden exportiert." });
    },
    async importSettings() {
      if (!apiAvailable()) return;
      set({ loading: true, error: undefined });
      try {
        const workspace =
          await window.bewerbungsManager.export.importSettings();
        if (workspace) {
          set({
            workspace,
            loading: false,
            notice: "Einstellungen wurden geprüft und importiert.",
          });
        } else {
          set({ loading: false });
        }
      } catch (error) {
        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Einstellungen konnten nicht importiert werden.",
        });
      }
    },
    async importLegacyData() {
      if (!apiAvailable()) return;
      set({ loading: true, error: undefined });
      try {
        const workspace =
          await window.bewerbungsManager.migration.importLegacy();
        if (workspace) {
          set({
            workspace,
            selectedApplicationId: workspace.applications[0]?.id,
            loading: false,
            notice:
              "Bestehende Daten wurden kopiert und in die neue Ordnerstruktur übernommen.",
          });
        } else {
          set({ loading: false });
        }
      } catch (error) {
        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Die Datenmigration ist fehlgeschlagen.",
        });
      }
    },
    async openFolder(id, document) {
      if (!apiAvailable()) return;
      await window.bewerbungsManager.applications.openFolder(id, document);
    },
    clearMessage: () => set({ error: undefined, notice: undefined }),
  };
});

export const selectCurrentApplication = (state: StoreState) =>
  state.workspace.applications.find(
    (application) => application.id === state.selectedApplicationId,
  ) ?? state.workspace.applications[0];
