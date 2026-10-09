import { create } from "zustand";
import type { ResumeDesignLayer } from "../shared/cvDesignSchema";
import type { ApplicationChangeResult, DocumentFolderTarget } from "../shared/ipc";
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

type StoreState = {
  workspace: Workspace;
  selectedApplicationId?: string;
  selectedProfileId?: string;
  loading: boolean;
  error?: string;
  notice?: string;
  hydrate: () => Promise<void>;
  selectApplication: (id?: string) => void;
  selectProfile: (id?: string) => void;
  createApplication: (input: ApplicationInput) => Promise<void>;
  saveApplication: (application: Application) => Promise<void>;
  syncCoverLetter: (applicationId: string) => Promise<void>;
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
    target: "deckblatt" | "anschreiben" | "lebenslauf" | "mappe",
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

export const gitSyncFailedMessage =
  "Änderungen wurden lokal gespeichert, konnten aber nicht zu GitHub übertragen werden.";

export const useAppStore = create<StoreState>((set, get) => {
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

  /** A result means the local save succeeded; a failed GitHub push is shown as an error but not thrown. */
  const performApplicationChange = async (
    action: () => Promise<ApplicationChangeResult>,
    notice: string,
    syncedNotice: string,
  ) => {
    set({ loading: true, error: undefined });
    try {
      const { workspace, gitSync } = await action();
      set(gitSync.state === "failed"
        ? { workspace, loading: false, notice: undefined, error: `${gitSyncFailedMessage} ${gitSync.reason}` }
        : { workspace, loading: false, notice: gitSync.state === "synced" ? syncedNotice : notice });
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
    async hydrate() {
      if (!apiAvailable()) {
        set({ workspace: emptyWorkspace, loading: false });
        return;
      }
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
    async syncCoverLetter(applicationId) {
      if (!apiAvailable()) return;
      set({ loading: true, error: undefined });
      try {
        const result =
          await window.bewerbungsManager.templates.syncAnschreiben(
            applicationId,
          );
        set({
          loading: false,
          notice: `Word-Datei wurde aktualisiert: ${result.fileName}`,
        });
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
      await perform(
        () => window.bewerbungsManager.applications.remove(id),
        "Bewerbung wurde gelöscht und unter „Silinenler“ archiviert.",
      );
      set({
        selectedApplicationId: get().workspace.applications[0]?.id,
      });
    },
    async duplicateApplication(id) {
      if (!apiAvailable()) return;
      await perform(
        () => window.bewerbungsManager.applications.duplicate(id),
        "Bewerbung wurde als Entwurf dupliziert.",
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
      await perform(
        () => window.bewerbungsManager.profiles.save(profile),
        "Profil wurde gespeichert.",
      );
    },
    async removeProfile(id) {
      if (!apiAvailable()) return;
      await perform(
        () => window.bewerbungsManager.profiles.remove(id),
        "Profil wurde gelöscht.",
      );
      if (get().selectedProfileId === id) {
        set({ selectedProfileId: undefined });
      }
    },
    async saveSettings(settings) {
      if (!apiAvailable()) return;
      await perform(
        () => window.bewerbungsManager.settings.save(settings),
        "Einstellungen wurden gespeichert.",
      );
    },
    async saveResumeDesign(layer) {
      const { resumeDesign: _previous, ...settings } = get().workspace.settings;
      const next: AppSettings = { ...settings, ...(layer ? { resumeDesign: layer } : {}) };
      if (!apiAvailable()) {
        set((state) => ({ workspace: { ...state.workspace, settings: next } }));
        return;
      }
      await perform(
        () => window.bewerbungsManager.settings.save(next),
        "Lebenslauf-Design wurde gespeichert.",
      );
    },
    async saveEvent(event) {
      if (!apiAvailable()) return;
      await perform(
        () => window.bewerbungsManager.events.save(event),
        "Kalendereintrag wurde aktualisiert.",
      );
    },
    async saveTodo(todo) {
      if (!apiAvailable()) {
        set((state) => ({ workspace: { ...state.workspace, todos: [todo, ...state.workspace.todos.filter((item) => item.id !== todo.id)] } }));
        return;
      }
      await perform(() => window.bewerbungsManager.todos.save(todo), "Aufgabe wurde gespeichert.");
    },
    async removeTodo(id) {
      if (!apiAvailable()) {
        set((state) => ({ workspace: { ...state.workspace, todos: state.workspace.todos.filter((item) => item.id !== id) } }));
        return;
      }
      await perform(() => window.bewerbungsManager.todos.remove(id), "Aufgabe wurde gelöscht.");
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
      await perform(
        () => window.bewerbungsManager.attachments.add(applicationId, category),
        "Dokument wurde zur Bewerbungsmappe hinzugefügt.",
      );
    },
    async saveAttachment(attachment) {
      if (!apiAvailable()) return;
      await perform(
        () => window.bewerbungsManager.attachments.save(attachment),
        "Dokumentdaten wurden gespeichert.",
      );
    },
    async moveAttachment(id, direction) {
      if (!apiAvailable()) return;
      await perform(
        () => window.bewerbungsManager.attachments.move(id, direction),
        "Reihenfolge wurde aktualisiert.",
      );
    },
    async removeAttachment(id) {
      if (!apiAvailable()) return;
      await perform(
        () => window.bewerbungsManager.attachments.remove(id),
        "Dokumentverknüpfung wurde entfernt.",
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
      set({ loading: true, error: undefined });
      try {
        const result = await window.bewerbungsManager.export.pdf(
          applicationId,
          target,
          application,
        );
        set({
          loading: false,
          // The user chose the place in the save dialog; the notice says where it went (cancelled: no notice).
          notice: result ? `PDF gespeichert: ${result}` : undefined,
        });
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
