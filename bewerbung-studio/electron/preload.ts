import { contextBridge, ipcRenderer } from "electron";
import type { BewerbungsManagerApi } from "../src/shared/ipc";
import { IpcOperationError, type IpcResult } from "../src/shared/app-error";

const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  const result = await ipcRenderer.invoke(channel, ...args) as IpcResult<T>;
  if (result.ok) return result.data;
  throw new IpcOperationError(result.error.code, result.error.message, result.error.operationId);
};

const api: BewerbungsManagerApi = {
  security: {
    status: () => invoke("security:status"),
    completeOnboarding: () => invoke("security:complete-onboarding"),
    unlock: (credential, kind) => invoke("security:unlock", credential, kind),
    cancelPending: () => invoke("security:cancel-pending"),
    touch: () => invoke("security:touch"),
    enable: (password) => invoke("security:enable", password),
    lock: () => invoke("security:lock"),
    changePassword: (oldPassword, newPassword) => invoke("security:change-password", oldPassword, newPassword),
    rotateRecoveryKey: (password) => invoke("security:rotate-recovery", password),
    disable: (password) => invoke("security:disable", password),
    setRememberDevice: (enabled) => invoke("security:remember-device", enabled),
    saveRecoveryKey: (key) => invoke("security:save-recovery-key", key),
  },
  workspace: {
    get: () => invoke("workspace:get"),
  },
  applicationDraft: {
    get: () => invoke("application-draft:get"),
    save: (draft) => invoke("application-draft:save", draft),
    clear: () => invoke("application-draft:clear"),
  },
  applications: {
    create: (input) => invoke("applications:create", input),
    save: (application) => invoke("applications:save", application),
    remove: (id) => invoke("applications:remove", id),
    duplicate: (id) => invoke("applications:duplicate", id),
    changeStatus: (id, status, reason) =>
      invoke("applications:change-status", id, status, reason),
    openFolder: (id, document) => invoke("applications:open-folder", id, document),
  },
  profiles: {
    save: (profile) => invoke("profiles:save", profile),
    remove: (id) => invoke("profiles:remove", id),
  },
  templates: {
    scan: () => invoke("templates:scan"),
    add: (input) => invoke("templates:add", input),
    use: (input) => invoke("templates:use", input),
    syncAnschreiben: (applicationId) =>
      invoke("templates:sync-anschreiben", applicationId),
    duplicate: (templateId) =>
      invoke("templates:duplicate", templateId),
    copyToMuster: (templateId) =>
      invoke("templates:copy-to-muster", templateId),
    toggleFavorite: (templateId) =>
      invoke("templates:toggle-favorite", templateId),
    remove: (templateId) =>
      invoke("templates:remove", templateId),
    open: (templateId) => invoke("templates:open", templateId),
    openFolder: (templateId) =>
      invoke("templates:open-folder", templateId),
  },
  media: {
    pickProfileImage: (kind) =>
      invoke("media:pick-profile-image", kind),
  },
  settings: {
    save: (settings) => invoke("settings:save", settings),
  },
  events: {
    save: (event) => invoke("events:save", event),
  },
  todos: {
    save: (todo) => invoke("todos:save", todo),
    remove: (id) => invoke("todos:remove", id),
  },
  customCvDesigns: {
    save: (design) => invoke("custom-cv-designs:save", design),
    remove: (id) => invoke("custom-cv-designs:remove", id),
  },
  attachments: {
    add: (applicationId, category) =>
      invoke("attachments:add", applicationId, category),
    save: (attachment) => invoke("attachments:save", attachment),
    move: (id, direction) =>
      invoke("attachments:move", id, direction),
    remove: (id) => invoke("attachments:remove", id),
    open: (id) => invoke("attachments:open", id),
  },
  export: {
    pdf: (applicationId, target, application) =>
      invoke(
        "export:pdf",
        applicationId,
        target,
        application,
      ),
    backup: () => invoke("export:backup"),
    importBackup: () => invoke("export:import-backup"),
    settings: () => invoke("export:settings"),
    importSettings: () => invoke("export:import-settings"),
  },
  migration: {
    importLegacy: () => invoke("migration:import-legacy"),
  },
  system: {
    reportRendererFailure: () => invoke("system:renderer-failure"),
    exportDiagnostics: () => invoke("system:export-diagnostics"),
    openExternal: (url) => invoke("system:open-external", url),
    dataPath: () => invoke("system:data-path"),
    workspaceStatus: () => invoke("system:workspace-status"),
    chooseWorkspace: () => invoke("system:choose-workspace"),
    openExistingWorkspace: () => invoke("system:open-existing-workspace"),
    openWorkspace: () => invoke("system:open-workspace"),
    openWorkspaceFile: () => invoke("system:open-workspace-file"),
    workspaceDetails: () => invoke("system:workspace-details"),
    copyWorkspace: () => invoke("system:copy-workspace"),
    backupWorkspace: () => invoke("system:backup-workspace"),
    openBackups: () => invoke("system:open-backups"),
    changeWorkspace: (mode) => invoke("system:change-workspace", mode),
  },
};

contextBridge.exposeInMainWorld("bewerbungsManager", api);
