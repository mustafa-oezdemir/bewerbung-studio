import type {
  ApplicantProfile,
  Application,
  ApplicationDraft,
  ApplicationInput,
  ApplicationStatus,
  AppSettings,
  AttachmentCategory,
  Attachment,
  CalendarEvent,
  CustomCvDesign,
  RejectionReason,
  Todo,
  Workspace,
} from "./schema";
import type {
  AddTemplateInput,
  CreatedDocumentResult,
  DocumentTemplate,
  TemplateScanResult,
  UseTemplateInput,
} from "../features/templates/template.types";
export type DocumentFolderTarget = "deckblatt" | "anschreiben" | "lebenslauf" | "email";

/**
 * GitHub synchronisation after a Bewerbung was created, saved or changed its status. The local save has always
 * succeeded when this is returned; `reason` is a fixed German text without paths, URLs or credentials.
 */
export type ApplicationGitSyncOutcome =
  | { state: "skipped" }
  | { state: "synced"; committed: boolean; pushed: boolean }
  | { state: "failed"; code: string; reason: string };

export type ApplicationChangeResult = {
  workspace: Workspace;
  gitSync: ApplicationGitSyncOutcome;
};

export type WorkspaceStatus =
  | { state: "ready"; root: string }
  | { state: "locked"; root: string; migration?: "enable" | "disable" }
  | { state: "setup" }
  | { state: "missing"; root: string }
  | { state: "error"; root: string; message: string };
export type WorkspaceChangeMode = "move" | "copy" | "new";

export type SecurityStatus = {
  mode: "plaintext" | "locked" | "unlocked" | "migration";
  onboardingRequired: boolean;
  rememberDevice: boolean;
  autoLockMinutes: 0 | 5 | 15 | 30 | 60;
  pendingSwitch: boolean;
};

export type ExportTarget = "deckblatt" | "anschreiben" | "lebenslauf" | "mappe";
export type ProfileMediaKind = "photo" | "signature";
export type LegacyMigrationPreview = {
  sourcePath: string;
  fileCount: number;
  totalBytes: number;
  applications: number;
  attachments: number;
};

export type PickedProfileMedia = {
  dataUrl: string;
  fileName: string;
};

export interface BewerbungsManagerApi {
  security: {
    status: () => Promise<SecurityStatus>;
    completeOnboarding: () => Promise<void>;
    unlock: (credential: string, kind: "password" | "recovery") => Promise<WorkspaceStatus>;
    cancelPending: () => Promise<WorkspaceStatus>;
    touch: () => Promise<void>;
    enable: (password: string) => Promise<string>;
    lock: () => Promise<void>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
    rotateRecoveryKey: (password: string) => Promise<string>;
    disable: (password: string) => Promise<void>;
    setRememberDevice: (enabled: boolean) => Promise<boolean>;
    saveRecoveryKey: (key: string) => Promise<string | null>;
  };
  workspace: {
    get: () => Promise<Workspace>;
  };
  applicationDraft: {
    get: () => Promise<ApplicationDraft | null>;
    save: (draft: ApplicationDraft) => Promise<void>;
    clear: () => Promise<void>;
  };
  applications: {
    create: (input: ApplicationInput) => Promise<ApplicationChangeResult>;
    save: (application: Application) => Promise<ApplicationChangeResult>;
    remove: (id: string) => Promise<Workspace>;
    duplicate: (id: string) => Promise<Workspace>;
    changeStatus: (
      id: string,
      status: ApplicationStatus,
      reason?: RejectionReason,
    ) => Promise<ApplicationChangeResult>;
    /** Opens the Bewerbung's folder; with a document, that document's folder (where its PDF was saved). */
    openFolder: (id: string, document?: DocumentFolderTarget) => Promise<void>;
  };
  profiles: {
    save: (profile: ApplicantProfile) => Promise<Workspace>;
    remove: (id: string) => Promise<Workspace>;
  };
  templates: {
    scan: () => Promise<TemplateScanResult>;
    add: (input: AddTemplateInput) => Promise<DocumentTemplate | null>;
    use: (input: UseTemplateInput) => Promise<CreatedDocumentResult>;
    syncAnschreiben: (applicationId: string) => Promise<CreatedDocumentResult>;
    duplicate: (templateId: string) => Promise<DocumentTemplate | null>;
    copyToMuster: (templateId: string) => Promise<DocumentTemplate>;
    toggleFavorite: (templateId: string) => Promise<TemplateScanResult>;
    remove: (templateId: string) => Promise<TemplateScanResult>;
    open: (templateId: string) => Promise<void>;
    openFolder: (templateId: string) => Promise<void>;
  };
  media: {
    pickProfileImage: (
      kind: ProfileMediaKind,
    ) => Promise<PickedProfileMedia | null>;
  };
  settings: {
    save: (settings: AppSettings) => Promise<Workspace>;
  };
  events: {
    save: (event: CalendarEvent) => Promise<Workspace>;
  };
  todos: {
    save: (todo: Todo) => Promise<Workspace>;
    remove: (id: string) => Promise<Workspace>;
  };
  customCvDesigns: {
    save: (design: CustomCvDesign) => Promise<Workspace>;
    remove: (id: string) => Promise<Workspace>;
  };
  attachments: {
    add: (
      applicationId: string,
      category: AttachmentCategory,
    ) => Promise<Workspace>;
    save: (attachment: Attachment) => Promise<Workspace>;
    move: (id: string, direction: -1 | 1) => Promise<Workspace>;
    remove: (id: string) => Promise<Workspace>;
    open: (id: string) => Promise<void>;
  };
  export: {
    pdf: (
      applicationId: string,
      target: ExportTarget,
      application?: Application,
    ) => Promise<string | null>;
    backup: () => Promise<string | null>;
    importBackup: () => Promise<Workspace | null>;
    settings: () => Promise<string | null>;
    importSettings: () => Promise<Workspace | null>;
  };
  migration: {
    importLegacy: () => Promise<Workspace | null>;
  };
  system: {
    reportRendererFailure: () => Promise<void>;
    exportDiagnostics: () => Promise<string | null>;
    openExternal: (url: string) => Promise<void>;
    dataPath: () => Promise<string>;
    workspaceStatus: () => Promise<WorkspaceStatus>;
    chooseWorkspace: () => Promise<WorkspaceStatus>;
    openExistingWorkspace: () => Promise<WorkspaceStatus>;
    openWorkspace: () => Promise<void>;
    openWorkspaceFile: () => Promise<void>;
    workspaceDetails: () => Promise<{ filePath: string; modifiedAt: string }>;
    copyWorkspace: () => Promise<string | null>;
    backupWorkspace: () => Promise<string>;
    openBackups: () => Promise<void>;
    changeWorkspace: (mode: WorkspaceChangeMode) => Promise<WorkspaceStatus>;
  };
}
