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
/** The folders "Ordner" may open: one per document of a Bewerbung. IPC accepts nothing else. */
export const documentFolderTargets = ["deckblatt", "anschreiben", "motivation", "lebenslauf", "email"] as const;
export type DocumentFolderTarget = (typeof documentFolderTargets)[number];

/**
 * GitHub synchronisation after a managed Bewerbung or document was saved. The local save has always
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
export type DocumentChangeResult = { document: CreatedDocumentResult; gitSync: ApplicationGitSyncOutcome };
export type PdfChangeResult = { path: string | null; gitSync: ApplicationGitSyncOutcome };

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

/** The PDF exports of a Bewerbung. The IPC handler accepts exactly these (an allow-list, never a path or a name). */
export const exportTargets = ["deckblatt", "anschreiben", "motivation", "lebenslauf", "bewerbungsunterlagen", "mappe"] as const;
export type ExportTarget = (typeof exportTargets)[number];
export const parseExportTarget = (value: unknown): ExportTarget | undefined =>
  exportTargets.find((target) => target === value);
export const parseDocumentFolderTarget = (value: unknown): DocumentFolderTarget | undefined =>
  documentFolderTargets.find((target) => target === value);
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
    remove: (id: string) => Promise<ApplicationChangeResult>;
    duplicate: (id: string) => Promise<ApplicationChangeResult>;
    changeStatus: (
      id: string,
      status: ApplicationStatus,
      reason?: RejectionReason,
    ) => Promise<ApplicationChangeResult>;
    /** Opens the Bewerbung's folder; with a document, that document's folder (where its PDF was saved). */
    openFolder: (id: string, document?: DocumentFolderTarget) => Promise<void>;
  };
  profiles: {
    save: (profile: ApplicantProfile) => Promise<ApplicationChangeResult>;
    remove: (id: string) => Promise<ApplicationChangeResult>;
  };
  templates: {
    scan: () => Promise<TemplateScanResult>;
    add: (input: AddTemplateInput) => Promise<DocumentTemplate | null>;
    use: (input: UseTemplateInput) => Promise<DocumentChangeResult>;
    syncAnschreiben: (applicationId: string) => Promise<DocumentChangeResult>;
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
    save: (settings: AppSettings) => Promise<ApplicationChangeResult>;
  };
  events: {
    save: (event: CalendarEvent) => Promise<ApplicationChangeResult>;
  };
  todos: {
    save: (todo: Todo) => Promise<ApplicationChangeResult>;
    remove: (id: string) => Promise<ApplicationChangeResult>;
  };
  customCvDesigns: {
    save: (design: CustomCvDesign) => Promise<Workspace>;
    remove: (id: string) => Promise<Workspace>;
  };
  attachments: {
    add: (
      applicationId: string,
      category: AttachmentCategory,
    ) => Promise<ApplicationChangeResult>;
    save: (attachment: Attachment) => Promise<ApplicationChangeResult>;
    move: (id: string, direction: -1 | 1) => Promise<ApplicationChangeResult>;
    remove: (id: string) => Promise<ApplicationChangeResult>;
    open: (id: string) => Promise<void>;
  };
  export: {
    pdf: (
      applicationId: string,
      target: ExportTarget,
      application?: Application,
    ) => Promise<PdfChangeResult>;
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
