import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { access, lstat, mkdir, realpath, rm, stat } from "node:fs/promises";
import { readFile, writeFile } from "./security/secure-fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  Notification,
  powerMonitor,
  safeStorage,
  shell,
} from "electron";
import {
  appSettingsSchema,
  applicationDraftSchema,
  applicationInputSchema,
  applicationSchema,
  attachmentSchema,
  applicationStatuses,
  attachmentCategories,
  calendarEventSchema,
  customCvDesignSchema,
  profileSchema,
  rejectionReasons,
  todoSchema,
} from "../src/shared/schema";
import type { ExportTarget } from "../src/shared/ipc";
import type {
  AddTemplateInput,
  UseTemplateInput,
} from "../src/features/templates/template.types";
import { resolveApplicationPaths } from "../src/config/application-paths";
import { DataStore } from "./storage";
import { ApplicationGitSync } from "./application-git-queue";
import { ApplicationFolderLockedError } from "./file-management";
import { mergePdfDocuments } from "./pdf";
import { TemplateService } from "./templates/template.service";
import { createDefaultCoverLetterDocument } from "./templates/default-cover-letter";
import { createDefaultDeckblattDocument } from "./templates/default-deckblatt";
import { sanitizeTemplateFileName } from "./templates/template-filename.service";
import { wordMusterTemplateConfig } from "../src/features/templates/template.constants";
import { WorkspaceManager, sameWorkspaceRoot } from "./workspace-management";
import { WorkspaceSecurity } from "./security/workspace-security";
import { clearActiveEncryption, isManagedPath, setActiveEncryption } from "./security/secure-fs";
import { readEncryptionEnvelope, readMigrationJournal, rollbackUncommittedMigration } from "./security/workspace-encryption";
import { safeExternalUrl } from "./security/external-url";
import type { ApplicationChangeResult, WorkspaceStatus, WorkspaceChangeMode } from "../src/shared/ipc";
import type { Workspace } from "../src/shared/schema";
import { AppError } from "../src/shared/app-error";
import { initializeDiagnostics, logDiagnostic } from "./diagnostics";
import { normalizeError, runIpcOperation } from "./ipc-boundary";

let mainWindow: BrowserWindow | null = null;
let store: DataStore;
let applicationGitSync: ApplicationGitSync;
let templateService: TemplateService;
let shutdownInProgress = false;
let shutdownComplete = false;
let workspaceStatus: WorkspaceStatus = { state: "setup" };
let workspaceManager: WorkspaceManager;
let workspaceSecurity: WorkspaceSecurity | null = null;
let securityBusy = false;
const activeDataOperations = new Set<Promise<unknown>>();
const waitForDataOperations = async () => { await Promise.allSettled([...activeDataOperations]); };
const registerHandler: typeof ipcMain.handle = (channel, listener) => ipcMain.handle(
  channel,
  (event, ...args) => runIpcOperation(channel, () => listener(event, ...args)),
);
let pendingEncryptedWorkspace: { root: string; oldRoot: string | null } | null = null;
let lastSecurityActivity = Date.now();
/** Where a document's PDF was saved in this session (`<applicationId>:<target>`): "Ordner" opens that folder. */
const lastExportPaths = new Map<string, string>();
let failedUnlocks = 0;
let runtimeRegistered = false;
const secureTempRoot = () => path.join(app.getPath("userData"), "secure-document-temp");
let secureTempSession = randomUUID();
const secureTempSessionRoot = () => path.join(secureTempRoot(), secureTempSession);
const purgeSecureTemp = async (target: string, recursive: boolean, attempt = 0): Promise<void> => {
  try { await rm(target, { recursive, force: true }); }
  catch {
    if (attempt < 5) {
      setTimeout(() => { void purgeSecureTemp(target, recursive, attempt + 1); },
        Math.min(1_000 * 2 ** attempt, 30_000)).unref();
    }
  }
};
const isInsideWorkspace = (filePath: string, root: string) => {
  const relative = path.relative(path.resolve(root), path.resolve(filePath));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
};
const requireExternalDestination = async (filePath: string, root: string) => {
  const parent = await realpath(path.dirname(filePath));
  const existing = await lstat(filePath).catch(() => null);
  if (isInsideWorkspace(filePath, root) || isInsideWorkspace(path.join(parent, path.basename(filePath)), root) ||
      existing?.isSymbolicLink())
    throw new Error("Wählen Sie einen Speicherort außerhalb des verschlüsselten Bewerbungsordners.");
};
const externalReadablePath = async (filePath: string) => {
  if (!isManagedPath(filePath)) return filePath;
  const extension = path.extname(filePath).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 12);
  const temporary = path.join(secureTempSessionRoot(), `${randomUUID()}${extension}`);
  await mkdir(secureTempSessionRoot(), { recursive: true, mode: 0o700 });
  await writeFile(temporary, await readFile(filePath), { flag: "wx", mode: 0o600 });
  setTimeout(() => { void purgeSecureTemp(temporary, false); }, 5 * 60_000).unref();
  return temporary;
};
/**
 * Puts the export HTML into the hidden print window. A `data:` URL is limited to about 2 MB, and a Mappe with photo,
 * signature and three documents exceeds it (ERR_INVALID_URL); the HTML is written into a blank page instead (no file
 * on disk, so an encrypted workspace leaks nothing). Printing waits for its fonts and images.
 */
const loadExportHtml = async (window: BrowserWindow, html: string) => {
  await window.loadURL("about:blank");
  await window.webContents.executeJavaScript(
    `document.open(); document.write(${JSON.stringify(html)}); document.close();
     Promise.all([
       document.fonts ? document.fonts.ready : Promise.resolve(),
       ...Array.from(document.images, (image) => image.complete ? Promise.resolve() : new Promise((done) => { image.onload = image.onerror = done; })),
     ]).then(() => true);`,
  );
};
const exportTitles: Record<ExportTarget, string> = {
  deckblatt: "Deckblatt",
  anschreiben: "Anschreiben",
  lebenslauf: "Lebenslauf",
  mappe: "Bewerbungsmappe",
};
const notifiedEvents = new Set<string>();
const appId = "de.bewerbungsmanager.desktop";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const bundledTemplatesRoot = path.join(
  __dirname,
  isDevelopment ? "../public/templates" : "../dist/templates",
);
let applicationPaths: ReturnType<typeof resolveApplicationPaths>;

if (process.platform === "win32") app.setAppUserModelId(appId);

process.on("uncaughtException", (error) => {
  logDiagnostic("fatal", {
    event: "uncaught_exception", component: "main", error_code: "INTERNAL_ERROR",
    error_type: error.name,
  });
  app.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logDiagnostic("error", {
    event: "unhandled_rejection", component: "main", error_code: "INTERNAL_ERROR",
    error_type: reason instanceof Error ? reason.name : "Unknown",
  });
});

// Two processes writing the same workspace would replace each other's lock file.
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1060,
    minHeight: 720,
    show: false,
    backgroundColor: "#f3f1ec",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const safeUrl = safeExternalUrl(url);
    if (safeUrl) void shell.openExternal(safeUrl).catch(() => {
      logDiagnostic("warn", {
        event: "external_open_failed", component: "navigation", error_code: "EXTERNAL_OPEN_FAILED",
      });
    });
    return { action: "deny" };
  });
  // Recovery-key copy uses navigator.clipboard; every other renderer permission is denied.
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) =>
    callback(permission === "clipboard-sanitized-write"));
  mainWindow.webContents.session.setPermissionCheckHandler((_webContents, permission) =>
    permission === "clipboard-sanitized-write");
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = isDevelopment
      ? (() => { try { return new URL(url).origin === new URL(process.env.VITE_DEV_SERVER_URL!).origin; } catch { return false; } })()
      : url === pathToFileURL(path.join(__dirname, "../dist/index.html")).toString();
    if (!allowed) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  if (isDevelopment) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};

const synchronizeApplicationCoverLetter = async (applicationId: string) => {
  const context = store.getTemplateDocumentContext(applicationId);
  const data = { ...context.data };
  if (data.UNTERSCHRIFT_GRAFIK) {
    const signature = nativeImage.createFromDataURL(data.UNTERSCHRIFT_GRAFIK);
    data.UNTERSCHRIFT_GRAFIK = signature.isEmpty()
      ? ""
      : `data:image/png;base64,${signature.toPNG().toString("base64")}`;
  }
  const personalTemplate = await templateService.getTemplateById(
    wordMusterTemplateConfig.id,
  );
  if (personalTemplate) {
    return templateService.synchronizeDocumentFromTemplate(
      personalTemplate.id,
      context.targetDirectories.anschreiben,
      context.requestedBaseName,
      data,
    );
  }
  return createDefaultCoverLetterDocument(
    context.targetDirectories.anschreiben,
    context.requestedBaseName,
    data,
  );
};

const synchronizeApplicationDeckblatt = async (applicationId: string) => {
  const context = store.getTemplateDocumentContext(applicationId);
  const data = { ...context.data };
  if (data.PROFILFOTO) {
    const photo = nativeImage.createFromDataURL(data.PROFILFOTO);
    data.PROFILFOTO = photo.isEmpty()
      ? ""
      : `data:image/png;base64,${photo.toPNG().toString("base64")}`;
  }
  return createDefaultDeckblattDocument(
    context.targetDirectories.deckblatt,
    context.requestedBaseNames.deckblatt,
    data,
  );
};

const createMissingExistingDeckblatts = async () => {
  for (const application of store.getWorkspace().applications) {
    const context = store.getTemplateDocumentContext(application.id);
    const targetPath = path.join(
      context.targetDirectories.deckblatt,
      `${sanitizeTemplateFileName(context.requestedBaseNames.deckblatt)}.docx`,
    );
    try {
      await access(targetPath);
    } catch {
      if (store.getProfileForApplication(application)) {
        await synchronizeApplicationDeckblatt(application.id);
      }
    }
  }
};

/** Create, save and status changes: the Git commit waits for the persist and the regenerated Word documents. */
const runApplicationChange = async (
  operation: () => Promise<Workspace>,
): Promise<ApplicationChangeResult> => {
  const { result, gitSync } = await applicationGitSync.runOperation(operation);
  return { workspace: result, gitSync };
};

const registerIpc = () => {
  const handle: typeof ipcMain.handle = (channel, listener) => registerHandler(channel, async (event, ...args) => {
    if (workspaceStatus.state !== "ready" || securityBusy)
      throw new AppError("WORKSPACE_LOCKED", "Der Datenbestand ist gesperrt.", { expected: true });
    const operation = Promise.resolve().then(() => listener(event, ...args));
    activeDataOperations.add(operation);
    try { return await operation; }
    finally { activeDataOperations.delete(operation); }
  });
  handle("workspace:get", () => store.getWorkspace());
  handle("application-draft:get", () => store.getApplicationDraft());
  handle("application-draft:save", (_event, value: unknown) =>
    store.saveApplicationDraft(applicationDraftSchema.parse(value)),
  );
  handle("application-draft:clear", () =>
    store.clearApplicationDraft(),
  );
  handle("applications:create", (_event, value: unknown) =>
    runApplicationChange(async () => {
      const workspace = await store.createApplication(
        applicationInputSchema.parse(value),
      );
      await Promise.all([
        synchronizeApplicationCoverLetter(workspace.applications[0].id),
        synchronizeApplicationDeckblatt(workspace.applications[0].id),
      ]);
      return workspace;
    }));
  handle("applications:save", async (_event, value: unknown) => {
    try {
      return await runApplicationChange(async () => {
        const next = applicationSchema.parse(value);
        const workspace = await store.saveApplication(next);
        await Promise.all([
          synchronizeApplicationDeckblatt(next.id),
          synchronizeApplicationCoverLetter(next.id),
        ]);
        return workspace;
      });
    } catch (error) {
      if (error instanceof ApplicationFolderLockedError && mainWindow) {
        await dialog.showMessageBox(mainWindow, {
          type: "warning",
          title: "Dokument noch geöffnet",
          message: "Der Bewerbungsordner konnte nicht umbenannt werden.",
          detail: error.message,
          buttons: ["OK"],
          defaultId: 0,
        });
      }
      throw error;
    }
  });
  handle("applications:remove", (_event, id: unknown) =>
    store.removeApplication(String(id)),
  );
  handle("applications:duplicate", async (_event, id: unknown) => {
    const workspace = await store.duplicateApplication(String(id));
    await Promise.all([
      synchronizeApplicationCoverLetter(workspace.applications[0].id),
      synchronizeApplicationDeckblatt(workspace.applications[0].id),
    ]);
    return workspace;
  });
  handle(
    "applications:change-status",
    (_event, id: unknown, status: unknown, reason: unknown) => {
      const validStatus = applicationStatuses.find((item) => item === status);
      const validReason = rejectionReasons.find((item) => item === reason);
      if (!validStatus) throw new Error("Ungültiger Bewerbungsstatus.");
      return runApplicationChange(() => store.changeStatus(String(id), validStatus, validReason));
    },
  );
  handle("applications:open-folder", async (_event, id: unknown, rawDocument: unknown) => {
    const documents = ["deckblatt", "anschreiben", "lebenslauf", "email"] as const;
    const document = documents.find((item) => item === rawDocument);
    if (document) {
      // The document's own folder: where its PDF was last saved (that file selected), else its folder in the Bewerbung.
      const candidates = [
        lastExportPaths.get(`${String(id)}:${document}`),
        document === "email" ? undefined : store.getAutomaticExportPath(String(id), document),
      ].filter((item): item is string => Boolean(item));
      for (const file of candidates) {
        if (await stat(file).catch(() => null)) {
          shell.showItemInFolder(file);
          return;
        }
      }
      const directory = store.getApplicationDocumentDirectory(String(id), document);
      await mkdir(directory, { recursive: true });
      const error = await shell.openPath(directory);
      if (error) throw new Error(error);
      return;
    }
    const error = await shell.openPath(
      store.getApplicationAnschreibenPath(String(id)),
    );
    if (error) throw new Error(error);
  });
  handle("profiles:save", async (_event, value: unknown) => {
    const profile = profileSchema.parse(value);
    const workspace = await store.saveProfile(profile);
    await Promise.all(
      workspace.applications
        .filter(
          (application) =>
            store.getProfileForApplication(application)?.id === profile.id,
        )
        .flatMap((application) => [
          synchronizeApplicationDeckblatt(application.id),
          synchronizeApplicationCoverLetter(application.id),
        ]),
    );
    return workspace;
  });
  handle("profiles:remove", async (_event, id: unknown) => {
    const workspace = await store.removeProfile(String(id));
    await Promise.all(
      workspace.applications
        .filter((application) => store.getProfileForApplication(application))
        .flatMap((application) => [
          synchronizeApplicationDeckblatt(application.id),
          synchronizeApplicationCoverLetter(application.id),
        ]),
    );
    return workspace;
  });
  handle("templates:scan", () =>
    templateService.scanAllTemplates(),
  );
  handle("templates:add", async (_event, rawInput: unknown) => {
    const value = (rawInput ?? {}) as Partial<AddTemplateInput>;
    if (
      value.documentType !== "anschreiben" &&
      value.documentType !== "deckblatt" &&
      value.documentType !== "lebenslauf"
    ) {
      throw new Error("Ungültiger Dokumenttyp.");
    }
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: "Word-Vorlage hinzufügen",
      properties: ["openFile"],
      filters: [
        {
          name: "Word-Dokumente",
          extensions: ["docx", "dotx", "doc"],
        },
      ],
    });
    const sourceFilePath = selection.filePaths[0];
    if (selection.canceled || !sourceFilePath) return null;
    return templateService.addExternalTemplate(
      sourceFilePath,
      value.documentType,
      typeof value.requestedName === "string"
        ? value.requestedName
        : undefined,
    );
  });
  handle("templates:use", async (_event, rawInput: unknown) => {
    const value = (rawInput ?? {}) as Partial<UseTemplateInput>;
    if (!value.templateId || !value.applicationId) {
      throw new Error("Vorlage und Bewerbung sind erforderlich.");
    }
    const template = await templateService.getTemplateById(value.templateId);
    if (!template) throw new Error("Vorlage wurde nicht gefunden.");
    const context = store.getTemplateDocumentContext(value.applicationId);
    if (template.supportsPhoto && context.data["PROFILFOTO"]) {
      const photo = nativeImage.createFromDataURL(
        context.data["PROFILFOTO"],
      );
      context.data["PROFILFOTO"] = photo.isEmpty()
        ? ""
        : `data:image/png;base64,${photo.toPNG().toString("base64")}`;
    }
    const result = await templateService.createDocumentFromTemplate(
      template.id,
      context.targetDirectories[template.documentType],
      context.requestedBaseNames[template.documentType],
      context.data,
      { atsMode: value.atsMode === true },
    );
    store.queueGitCommit(
      value.applicationId,
      template.documentType === "anschreiben" ? "anschreiben" : "update",
    );
    const openError = await shell.openPath(await externalReadablePath(result.filePath));
    if (openError) throw new Error(openError);
    return result;
  });
  handle(
    "templates:sync-anschreiben",
    async (_event, applicationId: unknown) => {
      const id = String(applicationId);
      const result = await synchronizeApplicationCoverLetter(id);
      store.queueGitCommit(id, "anschreiben");
      return result;
    },
  );
  handle(
    "templates:duplicate",
    (_event, templateId: unknown) =>
      templateService.duplicateTemplate(String(templateId)),
  );
  handle(
    "templates:copy-to-muster",
    (_event, templateId: unknown) =>
      templateService.copyExistingTemplateById(String(templateId)),
  );
  handle(
    "templates:toggle-favorite",
    (_event, templateId: unknown) =>
      templateService.toggleTemplateFavorite(String(templateId)),
  );
  handle("templates:remove", (_event, templateId: unknown) =>
    templateService.deleteCustomTemplate(String(templateId)),
  );
  handle("templates:open", async (_event, templateId: unknown) => {
    const template = await templateService.getTemplateById(String(templateId));
    if (!template) throw new Error("Vorlage wurde nicht gefunden.");
    const error = await shell.openPath(await externalReadablePath(template.filePath));
    if (error) throw new Error(error);
  });
  handle(
    "templates:open-folder",
    async (_event, templateId: unknown) => {
      const template = await templateService.getTemplateById(
        String(templateId),
      );
      if (!template) throw new Error("Vorlage wurde nicht gefunden.");
      if (isManagedPath(template.filePath)) throw new Error("Die verschlüsselte Vorlage kann über ‚Öffnen‘ in einem externen Programm angezeigt werden.");
      shell.showItemInFolder(template.filePath);
    },
  );
  handle(
    "media:pick-profile-image",
    async (_event, rawKind: unknown) => {
      const kind =
        rawKind === "photo" || rawKind === "signature" ? rawKind : null;
      if (!kind) throw new Error("Ungültiger Bildtyp.");
      const selection = await dialog.showOpenDialog(mainWindow!, {
        title:
          kind === "photo"
            ? "Bewerbungsfoto auswählen"
            : "Unterschrift auswählen",
        properties: ["openFile"],
        filters: [
          {
            name: "Bilddateien",
            extensions: ["png", "jpg", "jpeg", "webp"],
          },
        ],
      });
      const filePath = selection.filePaths[0];
      if (selection.canceled || !filePath) return null;
      const bytes = await readFile(filePath);
      if (bytes.byteLength > 8 * 1024 * 1024) {
        throw new Error("Das Bild darf höchstens 8 MB groß sein.");
      }
      const extension = filePath.split(".").pop()?.toLowerCase();
      const mimeType =
        extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : "image/jpeg";
      return {
        dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
        fileName: filePath.split(/[\\/]/).pop() ?? "Bild",
      };
    },
  );
  handle("settings:save", (_event, value: unknown) =>
    store.saveSettings(appSettingsSchema.parse(value)),
  );
  handle("events:save", (_event, value: unknown) =>
    store.saveEvent(calendarEventSchema.parse(value)),
  );
  handle("todos:save", (_event, value: unknown) =>
    store.saveTodo(todoSchema.parse(value)),
  );
  handle("todos:remove", (_event, id: unknown) =>
    store.removeTodo(z.string().uuid().parse(id)),
  );
  handle("custom-cv-designs:save", (_event, value: unknown) =>
    store.saveCustomCvDesign(customCvDesignSchema.parse(value)),
  );
  handle("custom-cv-designs:remove", (_event, id: unknown) =>
    store.removeCustomCvDesign(z.string().uuid().parse(id)),
  );
  handle(
    "attachments:add",
    async (_event, applicationId: unknown, rawCategory: unknown) => {
      const category = attachmentCategories.find(
        (item) => item === rawCategory,
      );
      if (!category) throw new Error("Ungültige Dokumentkategorie.");
      const selection = await dialog.showOpenDialog(mainWindow!, {
        defaultPath: store.files.archiveRootForCategory(category),
        title: `${category} hinzufügen`,
        properties: ["openFile"],
        filters: [{ name: "PDF-Dokumente", extensions: ["pdf"] }],
      });
      if (selection.canceled || !selection.filePaths[0])
        return store.getWorkspace();
      const workspace = await store.addAttachment(
        String(applicationId),
        category,
        selection.filePaths[0],
      );
      await synchronizeApplicationDeckblatt(String(applicationId));
      return workspace;
    },
  );
  handle("attachments:save", async (_event, value: unknown) => {
    const attachment = attachmentSchema.parse(value);
    const workspace = await store.saveAttachment(attachment);
    await synchronizeApplicationDeckblatt(attachment.applicationId);
    return workspace;
  });
  handle(
    "attachments:move",
    async (_event, id: unknown, rawDirection: unknown) => {
      const direction = Number(rawDirection);
      if (direction !== -1 && direction !== 1)
        throw new Error("Ungültige Sortierrichtung.");
      const attachment = store
        .getWorkspace()
        .attachments.find((item) => item.id === String(id));
      const workspace = await store.moveAttachment(String(id), direction);
      if (attachment) {
        await synchronizeApplicationDeckblatt(attachment.applicationId);
      }
      return workspace;
    },
  );
  handle("attachments:remove", async (_event, id: unknown) => {
    const attachment = store
      .getWorkspace()
      .attachments.find((item) => item.id === String(id));
    const workspace = await store.removeAttachment(String(id));
    if (attachment) {
      await synchronizeApplicationDeckblatt(attachment.applicationId);
    }
    return workspace;
  });
  handle("attachments:open", async (_event, id: unknown) => {
    const error = await shell.openPath(await externalReadablePath(store.getAttachmentPathById(String(id))));
    if (error) throw new Error(error);
  });
  handle(
    "export:pdf",
    async (
      _event,
      applicationId: unknown,
      rawTarget: unknown,
      rawApplicationSnapshot: unknown,
    ) => {
      const targets: ExportTarget[] = [
        "deckblatt",
        "anschreiben",
        "lebenslauf",
        "mappe",
      ];
      const target = targets.find((item) => item === rawTarget);
      if (!target) throw new Error("Ungültiges Exportziel.");
      const normalizedApplicationId = String(applicationId);
      const applicationSnapshot =
        rawApplicationSnapshot === undefined
          ? undefined
          : applicationSchema.parse(rawApplicationSnapshot);
      if (
        applicationSnapshot &&
        applicationSnapshot.id !== normalizedApplicationId
      ) {
        throw new Error(
          "Die Exportdaten gehören nicht zur ausgewählten Bewerbung.",
        );
      }
      const automaticPath = store.getAutomaticExportPath(normalizedApplicationId, target);
      let exportPath = automaticPath;
      if (workspaceSecurity?.unlocked) {
        const selected = await dialog.showSaveDialog(mainWindow!, {
          title: "PDF unverschlüsselt exportieren",
          defaultPath: path.join(app.getPath("documents"), path.basename(exportPath)),
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (selected.canceled || !selected.filePath) return null;
        if (workspaceStatus.state === "ready") await requireExternalDestination(selected.filePath, workspaceStatus.root);
        exportPath = selected.filePath;
      } else {
        // The user decides where the PDF goes: the dialog opens in the document's own folder of the Bewerbung
        // (Anschreiben → its Anschreiben folder, Mappe → Bewerbungsunterlagen); "Speichern" keeps it there,
        // another folder or name is taken as chosen. The dialog itself asks before replacing a file.
        await mkdir(path.dirname(automaticPath), { recursive: true });
        const selected = await dialog.showSaveDialog(mainWindow!, {
          title: `${exportTitles[target]} als PDF speichern`,
          defaultPath: automaticPath,
          buttonLabel: "Speichern",
          filters: [{ name: "PDF", extensions: ["pdf"] }],
          properties: ["showOverwriteConfirmation", "createDirectory"],
        });
        if (selected.canceled || !selected.filePath) return null;
        exportPath = /\.pdf$/i.test(selected.filePath) ? selected.filePath : `${selected.filePath}.pdf`;
      }
      const exporter = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      try {
        const html = store.getExportHtml(
          normalizedApplicationId,
          target,
          applicationSnapshot,
        );
        await loadExportHtml(exporter, html);
        const generatedPdf = await exporter.webContents.printToPDF({
          pageSize: "A4",
          preferCSSPageSize: true,
          printBackground: true,
          margins: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        const pdf =
          target === "mappe"
            ? await mergePdfDocuments(
                generatedPdf,
                await Promise.all(
                  store
                    .getPackageAttachmentPaths(normalizedApplicationId)
                    .map(async (attachment) => ({
                      fileName: attachment.fileName,
                      bytes: await readFile(attachment.path),
                    })),
                ),
              )
            : generatedPdf;
        await mkdir(path.dirname(exportPath), { recursive: true });
        await writeFile(exportPath, pdf);
        lastExportPaths.set(`${normalizedApplicationId}:${target}`, exportPath);
        // Only a PDF inside the Bewerbungsordner belongs to its history; one saved elsewhere is the user's copy.
        if (workspaceStatus.state === "ready" && isInsideWorkspace(exportPath, workspaceStatus.root))
          store.queueGitCommit(
            normalizedApplicationId,
            target === "anschreiben" ? "anschreiben" : "update",
          );
        return exportPath;
      } finally {
        exporter.destroy();
      }
    },
  );
  handle("export:backup", async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: "JSON-Sicherung exportieren",
      defaultPath: `BewerbungsManager_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await store.writeBackup(result.filePath);
    return result.filePath;
  });
  handle("export:import-backup", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "JSON-Sicherung wiederherstellen",
      properties: ["openFile"],
      filters: [{ name: "BewerbungsManager JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    await workspaceManager.fullBackup(workspaceStatus.root);
    return store.importBackup(result.filePaths[0]);
  });
  handle("export:settings", async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: "Einstellungen exportieren",
      defaultPath: "BewerbungsManager_Einstellungen.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    if (workspaceSecurity?.unlocked && workspaceStatus.state === "ready")
      await requireExternalDestination(result.filePath, workspaceStatus.root);
    await store.writeSettings(result.filePath);
    return result.filePath;
  });
  handle("export:import-settings", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Einstellungen importieren",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return store.importSettings(result.filePaths[0]);
  });
  handle("migration:import-legacy", async () => {
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: "Bisherigen data-Ordner auswählen",
      properties: ["openDirectory"],
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const preview = await store.previewLegacyMigration(selection.filePaths[0]);
    const megabytes = (preview.totalBytes / 1024 / 1024).toFixed(1);
    const confirmation = await dialog.showMessageBox(mainWindow!, {
      type: "warning",
      title: "Datenmigration bestätigen",
      message: "Bestehende Bewerbungsdaten in den neuen Hauptordner kopieren?",
      detail: [
        `Quelle: ${preview.sourcePath}`,
        `${preview.applications} Bewerbungen, ${preview.attachments} Dokumentverknüpfungen`,
        `${preview.fileCount} Dateien (${megabytes} MB)`,
        "",
        "Die Quelldateien bleiben unverändert. Vorhandene Zieldateien werden nicht überschrieben.",
      ].join("\n"),
      buttons: ["Sicher kopieren", "Abbrechen"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (confirmation.response !== 0) return null;
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    await workspaceManager.fullBackup(workspaceStatus.root);
    return store.migrateLegacyData(preview.sourcePath);
  });
  handle("system:open-external", async (_event, rawUrl: unknown) => {
    const url = typeof rawUrl === "string" ? safeExternalUrl(rawUrl) : null;
    if (!url) throw new AppError("VALIDATION_FAILED", "Nur HTTP- und HTTPS-Links ohne Zugangsdaten sind erlaubt.", { expected: true });
    await shell.openExternal(url);
  });
  handle("system:data-path", () => store.dataPath);
};

const initializeRuntime = async (root: string) => {
  const encrypted = Boolean(workspaceSecurity?.unlocked && sameWorkspaceRoot(workspaceSecurity.root, root));
  if (encrypted) setActiveEncryption(root, workspaceSecurity!.service!);
  else clearActiveEncryption();
  applicationPaths = resolveApplicationPaths(root, bundledTemplatesRoot);
  applicationGitSync = new ApplicationGitSync({
    paths: applicationPaths,
    // Development builds only: lets the Electron check push to a local bare repository instead of GitHub.
    remoteUrl: app.isPackaged ? undefined : process.env.BEWERBUNG_GIT_SYNC_TEST_REMOTE?.trim() || undefined,
  });
  store = new DataStore(applicationPaths, applicationGitSync, workspaceManager.lockToken(root));
  await store.initialize();
  templateService = new TemplateService(applicationPaths);
  await templateService.initialize();
  await createMissingExistingDeckblatts();
  if (!runtimeRegistered) {
    registerIpc();
    runtimeRegistered = true;
  }
  workspaceStatus = { state: "ready", root };
};

const notifyDueEvents = () => {
  const workspace = store.getWorkspace();
  if (!workspace.settings.notificationsEnabled || !Notification.isSupported())
    return;
  const now = Date.now();
  workspace.events
    .filter((event) => !event.cancelled && !event.completed)
    .forEach((event) => {
      const due = new Date(event.startAt).getTime();
      const matchingReminder = event.reminderMinutes.some((minutes) => {
        const alertAt = due - minutes * 60_000;
        return alertAt <= now && alertAt > now - 65_000;
      });
      const key = `${event.id}:${Math.floor(now / 60_000)}`;
      if (matchingReminder && !notifiedEvents.has(key)) {
        notifiedEvents.add(key);
        new Notification({
          title: "BewerbungsManager",
          body: event.title,
        }).show();
      }
    });
};

app.whenReady().then(async () => {
  if (!isPrimaryInstance) return;
  initializeDiagnostics(app.getPath("logs"), app.getVersion(), isDevelopment);
  logDiagnostic("info", { event: "application_started", component: "main" });
  await rm(secureTempRoot(), { recursive: true, force: true }).catch(() => undefined);
  workspaceManager = new WorkspaceManager(app.getPath("userData"));
  const acquireWorkspaceLock = async (root: string) => {
    const conflict = await workspaceManager.lockConflict(root);
    if (conflict) {
      const answer = await dialog.showMessageBox({
        type: "warning",
        buttons: ["Abbrechen", "Trotzdem öffnen"],
        defaultId: 0,
        cancelId: 0,
        message: "Dieser Datenbestand scheint bereits auf einem anderen Computer oder in einer anderen Instanz geöffnet zu sein.",
        detail: "Gleichzeitige Änderungen können Daten überschreiben. Öffnen Sie ihn nur, wenn die andere Instanz nicht mehr arbeitet.",
      });
      if (answer.response !== 1) return false;
    }
    await workspaceManager.acquireLock(root, app.getVersion(), conflict);
    return true;
  };
  const deviceKeyPath = (root: string) => path.join(
    app.getPath("userData"), "device-keys",
    `${createHash("sha256").update(path.resolve(root).toLowerCase()).digest("hex")}.bin`,
  );
  const choicePath = (root: string) => path.join(root, "data", "Setting", "Settings", "security-choice.json");
  const deviceStorageAvailable = () => safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text");
  const lockRuntime = async () => {
    if (workspaceStatus.state !== "ready" || !workspaceSecurity?.unlocked) return;
    securityBusy = true;
    await waitForDataOperations();
    const root = workspaceStatus.root;
    store.clearForLock();
    workspaceSecurity.lock();
    clearActiveEncryption();
    const expiredTempRoot = secureTempSessionRoot();
    secureTempSession = randomUUID();
    void purgeSecureTemp(expiredTempRoot, true);
    workspaceStatus = { state: "locked", root };
    mainWindow?.reload();
    securityBusy = false;
  };
  const tryDeviceUnlock = async (root: string) => {
    if (!deviceStorageAvailable()) return false;
    const saved = await readFile(deviceKeyPath(root)).catch(() => null);
    if (!saved) return false;
    const candidate = new WorkspaceSecurity(root);
    try {
      const key = safeStorage.decryptString(Buffer.from(saved));
      const result = await candidate.unlock(key, "device");
      if (result.mode !== "unlocked") return false;
    } catch {
      candidate.lock();
      await rm(deviceKeyPath(root), { force: true });
      return false;
    }
    workspaceSecurity = candidate;
    try {
      await initializeRuntime(root);
      lastSecurityActivity = Date.now();
      return true;
    } catch (error) {
      candidate.lock();
      workspaceSecurity = null;
      clearActiveEncryption();
      throw error;
    }
  };
  registerHandler("security:status", async () => {
    const root = workspaceStatus.state === "setup" ? null : workspaceStatus.root;
    const mode = workspaceStatus.state === "locked" ? "locked" :
      root && workspaceSecurity?.unlocked && sameWorkspaceRoot(workspaceSecurity.root, root) ? "unlocked" : "plaintext";
    const onboardingRequired = Boolean(root && mode === "plaintext" &&
      !(await stat(choicePath(root)).catch(() => null)));
    return {
      mode, onboardingRequired,
      rememberDevice: Boolean(root && (await stat(deviceKeyPath(root)).catch(() => null))),
      autoLockMinutes: workspaceStatus.state === "ready" ? store.getWorkspace().settings.autoLockMinutes : 15,
      pendingSwitch: pendingEncryptedWorkspace !== null,
    };
  });
  registerHandler("security:complete-onboarding", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Datenbestand geöffnet.");
    await writeFile(choicePath(workspaceStatus.root), JSON.stringify({ completed: true }), "utf8");
  });
  registerHandler("security:touch", () => { lastSecurityActivity = Date.now(); });
  registerHandler("security:cancel-pending", async () => {
    const pending = pendingEncryptedWorkspace;
    if (!pending) return workspaceStatus;
    pendingEncryptedWorkspace = null;
    await workspaceManager.releaseLock(pending.root);
    workspaceStatus = pending.oldRoot ? { state: "ready", root: pending.oldRoot } : { state: "setup" };
    mainWindow?.reload();
    return workspaceStatus;
  });
  registerHandler("security:unlock", async (_event, rawCredential: unknown, rawKind: unknown) => {
    if (workspaceStatus.state !== "locked") throw new Error("Der Datenbestand ist nicht gesperrt.");
    if (rawKind !== "password" && rawKind !== "recovery") throw new Error("Ungültige Entsperrmethode.");
    if (typeof rawCredential !== "string" || rawCredential.length > 4096) throw new Error("Ungültige Eingabe.");
    const root = workspaceStatus.root;
    const candidate = new WorkspaceSecurity(root);
    if (failedUnlocks) await new Promise((resolve) => setTimeout(resolve, Math.min(failedUnlocks * 700, 3500)));
    let result: Awaited<ReturnType<WorkspaceSecurity["unlock"]>>;
    try { result = await candidate.unlock(rawCredential, rawKind); failedUnlocks = 0; }
    catch (error) { failedUnlocks += 1; throw error; }
    const pending = pendingEncryptedWorkspace;
    const oldSecurity = workspaceSecurity;
    try {
      securityBusy = true;
      if (pending?.oldRoot) await workspaceManager.fullBackup(pending.oldRoot);
      workspaceSecurity = result.mode === "unlocked" ? candidate : null;
      await initializeRuntime(root);
      if (result.mode === "plaintext") await rm(deviceKeyPath(root), { force: true });
      if (pending) {
        await workspaceManager.activate(root);
        if (pending.oldRoot) await workspaceManager.releaseLock(pending.oldRoot);
        oldSecurity?.lock();
        pendingEncryptedWorkspace = null;
      }
      lastSecurityActivity = Date.now();
      logDiagnostic("info", {
        event: "workspace_unlocked", component: "security", operation: rawKind,
      });
      return workspaceStatus;
    } catch (error) {
      workspaceSecurity = oldSecurity;
      candidate.lock();
      if (pending?.oldRoot) {
        await workspaceManager.activate(pending.oldRoot);
        await initializeRuntime(pending.oldRoot);
        workspaceStatus = { state: "ready", root: pending.oldRoot };
      } else { clearActiveEncryption(); workspaceStatus = { state: "locked", root }; }
      throw error;
    } finally { securityBusy = false; }
  });
  registerHandler("security:enable", async (_event, rawPassword: unknown) => {
    if (workspaceStatus.state !== "ready" || workspaceSecurity?.unlocked) throw new Error("Kein unverschlüsselter Datenbestand geöffnet.");
    if (typeof rawPassword !== "string") throw new Error("Ungültiges Passwort.");
    const root = workspaceStatus.root;
    securityBusy = true;
    try {
      await waitForDataOperations();
      await workspaceManager.fullBackup(root);
      await writeFile(choicePath(root), JSON.stringify({ completed: true }), "utf8");
      const controller = new WorkspaceSecurity(root);
      const recoveryKey = await controller.enable(rawPassword);
      workspaceSecurity = controller;
      await initializeRuntime(root);
      lastSecurityActivity = Date.now();
      logDiagnostic("info", { event: "encryption_enabled", component: "security" });
      return recoveryKey;
    } catch (error) {
      await rollbackUncommittedMigration(root).catch(() => false);
      const journal = await readMigrationJournal(root).catch(() => null);
      const encrypted = await readEncryptionEnvelope(root).catch(() => null);
      if (journal || encrypted) {
        store.clearForLock();
        workspaceSecurity?.lock();
        clearActiveEncryption();
        workspaceStatus = { state: "locked", root, ...(journal ? { migration: "enable" as const } : {}) };
        mainWindow?.reload();
      }
      throw error;
    } finally { securityBusy = false; }
  });
  registerHandler("security:lock", () => lockRuntime());
  registerHandler("security:change-password", async (_event, oldPassword: unknown, newPassword: unknown) => {
    if (typeof oldPassword !== "string" || typeof newPassword !== "string" || !workspaceSecurity?.unlocked)
      throw new Error("Ungültige Passwortänderung.");
    securityBusy = true;
    try {
      await waitForDataOperations();
      await workspaceSecurity.changePassword(oldPassword, newPassword);
      logDiagnostic("info", { event: "password_changed", component: "security" });
    }
    finally { securityBusy = false; }
  });
  registerHandler("security:rotate-recovery", async (_event, password: unknown) => {
    if (typeof password !== "string" || !workspaceSecurity?.unlocked) throw new Error("Der Datenbestand ist gesperrt.");
    securityBusy = true;
    try {
      await waitForDataOperations();
      const key = await workspaceSecurity.rotateRecoveryKey(password);
      logDiagnostic("info", { event: "recovery_key_rotated", component: "security" });
      return key;
    }
    finally { securityBusy = false; }
  });
  registerHandler("security:disable", async (_event, password: unknown) => {
    if (typeof password !== "string" || !workspaceSecurity?.unlocked || workspaceStatus.state !== "ready")
      throw new Error("Der Datenbestand ist gesperrt.");
    const root = workspaceStatus.root;
    securityBusy = true;
    try {
      await waitForDataOperations();
      await workspaceManager.fullBackup(root);
      await workspaceSecurity.disable(password);
      workspaceSecurity = null;
      clearActiveEncryption();
      await rm(deviceKeyPath(root), { force: true });
      await initializeRuntime(root);
      mainWindow?.reload();
      logDiagnostic("info", { event: "encryption_disabled", component: "security" });
    } catch (error) {
      await rollbackUncommittedMigration(root).catch(() => false);
      const journal = await readMigrationJournal(root).catch(() => null);
      if (journal) {
        store.clearForLock();
        workspaceSecurity?.lock();
        clearActiveEncryption();
        workspaceStatus = { state: "locked", root, migration: "disable" };
        mainWindow?.reload();
      } else if (await readEncryptionEnvelope(root).catch(() => null) === null) {
        workspaceSecurity?.lock();
        workspaceSecurity = null;
        clearActiveEncryption();
        workspaceStatus = { state: "error", root, message: "Die Entschlüsselung wurde abgeschlossen. Der Datenbestand konnte danach nicht geladen werden; die Dateien wurden nicht gelöscht." };
        mainWindow?.reload();
      }
      throw error;
    } finally { securityBusy = false; }
  });
  registerHandler("security:remember-device", async (_event, enabled: unknown) => {
    if (workspaceStatus.state !== "ready" || !workspaceSecurity?.unlocked) throw new Error("Der Datenbestand ist gesperrt.");
    const file = deviceKeyPath(workspaceStatus.root);
    if (enabled === false) { await rm(file, { force: true }); return false; }
    if (enabled !== true || !deviceStorageAvailable()) throw new Error("Der sichere Gerätespeicher ist nicht verfügbar.");
    const key = workspaceSecurity.service!.deviceKeyCopy();
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, safeStorage.encryptString(key.toString("base64")), { mode: 0o600 });
      return true;
    } finally { key.fill(0); }
  });
  registerHandler("security:save-recovery-key", async (_event, rawKey: unknown) => {
    if (typeof rawKey !== "string" || !/^BM-(?:[A-F0-9]{4}-){15}[A-F0-9]{4}$/.test(rawKey))
      throw new Error("Ungültiger Wiederherstellungsschlüssel.");
    const selection = await dialog.showSaveDialog(mainWindow!, {
      title: "Wiederherstellungsschlüssel speichern", defaultPath: "BM-Wiederherstellungsschlüssel.txt",
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (selection.canceled || !selection.filePath) return null;
    if (workspaceStatus.state !== "setup") await requireExternalDestination(selection.filePath, workspaceStatus.root);
    await writeFile(selection.filePath, `${rawKey}\n`, { mode: 0o600 });
    return selection.filePath;
  });
  try {
    workspaceStatus = await workspaceManager.status();
    // A new installation has no data yet: it starts in Dokumente\BewerbungsManager instead of asking first.
    if (workspaceStatus.state === "setup") {
      const root = await workspaceManager.setupDefault(app.getPath("documents")).catch(() => null);
      if (root) workspaceStatus = { state: "ready", root };
    }
  } catch (error) {
    logDiagnostic("error", {
      event: "workspace_configuration_failed", component: "workspace",
      error_code: "INTERNAL_ERROR", error_type: error instanceof Error ? error.name : "Unknown",
    });
    workspaceStatus = {
      state: "error",
      root: "",
      message: normalizeError(error).message,
    };
  }
  const handleSystem: typeof ipcMain.handle = (channel, listener) => registerHandler(channel, async (event, ...args) => {
    if (securityBusy) throw new AppError("WORKSPACE_LOCKED", "Eine Datenumstellung läuft. Bitte warten Sie.", { expected: true });
    const operation = Promise.resolve().then(() => listener(event, ...args));
    activeDataOperations.add(operation);
    try { return await operation; }
    finally { activeDataOperations.delete(operation); }
  });
  registerHandler("system:workspace-status", () => workspaceStatus);
  registerHandler("system:renderer-failure", () => {
    logDiagnostic("error", {
      event: "renderer_render_failed", component: "renderer", error_code: "INTERNAL_ERROR",
    });
  });
  registerHandler("system:export-diagnostics", async () => {
    const selection = await dialog.showSaveDialog(mainWindow!, {
      title: "Diagnoseprotokoll exportieren",
      defaultPath: `BewerbungsManager-Diagnose-${new Date().toISOString().slice(0, 10)}.jsonl`,
      filters: [{ name: "JSON Lines", extensions: ["jsonl"] }],
    });
    if (selection.canceled || !selection.filePath) return null;
    if (workspaceStatus.state !== "setup")
      await requireExternalDestination(selection.filePath, workspaceStatus.root);
    const directory = app.getPath("logs");
    const files = ["app.4.jsonl", "app.3.jsonl", "app.2.jsonl", "app.1.jsonl", "app.jsonl"];
    const contents = await Promise.all(files.map((file) =>
      readFile(path.join(directory, file), "utf8").catch(() => "")));
    await writeFile(selection.filePath, contents.join(""), { mode: 0o600 });
    return selection.filePath;
  });
  handleSystem("system:choose-workspace", async () => {
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: "Bewerbungsordner auswählen",
      properties: ["openDirectory", "createDirectory"],
    });
    if (selection.canceled || !selection.filePaths[0]) return workspaceStatus;
    const selectedWorkspace = path.join(selection.filePaths[0], "data", "Setting", "Settings", "workspace.json");
    if (await stat(selectedWorkspace).catch(() => null)) {
      const existing = await workspaceManager.inspectWorkspaceFile(selectedWorkspace);
      if (existing.encrypted) {
        if (!(await acquireWorkspaceLock(existing.root))) return workspaceStatus;
        if (existing.recoveryAvailable) await workspaceManager.restoreWorkspaceBackup(selectedWorkspace);
        pendingEncryptedWorkspace = { root: existing.root, oldRoot: workspaceStatus.state === "ready" ? workspaceStatus.root : null };
        workspaceStatus = { state: "locked", root: existing.root };
        mainWindow?.reload();
        return workspaceStatus;
      }
    }
    const root = await workspaceManager.setup(selection.filePaths[0], false);
    if (!(await acquireWorkspaceLock(root))) return workspaceStatus;
    try {
      await initializeRuntime(root);
      await workspaceManager.activate(root);
    } catch (error) {
      await workspaceManager.releaseLock(root);
      throw error;
    }
    return workspaceStatus;
  });
  handleSystem("system:open-existing-workspace", async () => {
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: "Workspace-Datei auswählen",
      properties: ["openFile"],
      filters: [{ name: "Workspace-Datei", extensions: ["json"] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return workspaceStatus;
    const filePath = selection.filePaths[0];
    let inspection = await workspaceManager.inspectWorkspaceFile(filePath);
    if (workspaceStatus.state === "ready" && sameWorkspaceRoot(inspection.root, workspaceStatus.root)) return workspaceStatus;
    if (inspection.recoveryAvailable) {
      const answer = await dialog.showMessageBox(mainWindow!, {
        type: "warning", buttons: ["Abbrechen", "Sicherung wiederherstellen"],
        defaultId: 0, cancelId: 0,
        message: "Die Workspace-Datei ist beschädigt, aber eine gültige Sicherung wurde gefunden.",
        detail: "Die beschädigte Datei wird vor der Wiederherstellung separat aufbewahrt.",
      });
      if (answer.response !== 1) return workspaceStatus;
    }
    if (inspection.warnings.length) {
      const answer = await dialog.showMessageBox(mainWindow!, {
        type: "warning", buttons: ["Abbrechen", "Mit Warnungen öffnen"],
        defaultId: 0, cancelId: 0,
        message: "Im Datenbestand fehlen einige Verknüpfungen oder Dateien.",
        detail: inspection.warnings.slice(0, 12).join("\n"),
      });
      if (answer.response !== 1) return workspaceStatus;
    }
    if (!(await acquireWorkspaceLock(inspection.root))) return workspaceStatus;
    const oldRoot = workspaceStatus.state === "ready" ? workspaceStatus.root : null;
    if (inspection.encrypted || await readMigrationJournal(inspection.root)) {
      if (inspection.recoveryAvailable) inspection = await workspaceManager.restoreWorkspaceBackup(filePath);
      pendingEncryptedWorkspace = { root: inspection.root, oldRoot };
      workspaceStatus = { state: "locked", root: inspection.root };
      mainWindow?.reload();
      return workspaceStatus;
    }
    try {
      if (inspection.recoveryAvailable) {
        if (oldRoot) await workspaceManager.fullBackup(oldRoot);
        inspection = await workspaceManager.restoreWorkspaceBackup(filePath);
        inspection = await workspaceManager.prepareExistingWorkspace(filePath);
      } else {
        inspection = await workspaceManager.prepareExistingWorkspace(filePath, oldRoot ?? undefined);
      }
      await initializeRuntime(inspection.root);
      await workspaceManager.activate(inspection.root);
      if (oldRoot) await workspaceManager.releaseLock(oldRoot);
      workspaceSecurity?.lock();
      workspaceSecurity = null;
      return workspaceStatus;
    } catch (error) {
      await workspaceManager.releaseLock(inspection.root);
      if (oldRoot) {
        await workspaceManager.activate(oldRoot);
        await initializeRuntime(oldRoot);
      } else {
        await workspaceManager.deactivate();
        workspaceStatus = { state: "setup" };
      }
      throw error;
    }
  });
  handleSystem("system:open-workspace", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    const error = await shell.openPath(workspaceStatus.root);
    if (error) throw new Error(error);
  });
  handleSystem("system:workspace-details", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Datenbestand geöffnet.");
    return workspaceManager.workspaceDetails(workspaceStatus.root);
  });
  handleSystem("system:open-workspace-file", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Datenbestand geöffnet.");
    shell.showItemInFolder((await workspaceManager.workspaceDetails(workspaceStatus.root)).filePath);
  });
  handleSystem("system:copy-workspace", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Datenbestand geöffnet.");
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: "Zielordner für den Datenbestand wählen", properties: ["openDirectory", "createDirectory"],
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    return workspaceManager.changeRoot(workspaceStatus.root, selection.filePaths[0], "copy", false);
  });
  handleSystem("system:backup-workspace", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    const backup = await workspaceManager.fullBackup(workspaceStatus.root);
    logDiagnostic("info", { event: "backup_created", component: "workspace" });
    return backup;
  });
  handleSystem("system:open-backups", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    const backupPath = resolveApplicationPaths(workspaceStatus.root).backupsRoot;
    const error = await shell.openPath(backupPath);
    if (error) throw new Error(error);
  });
  handleSystem("system:change-workspace", async (_event, rawMode: unknown) => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    if (!["move", "copy", "new"].includes(String(rawMode))) throw new Error("Ungültige Speicherort-Aktion.");
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: "Neuen Bewerbungsordner auswählen",
      properties: ["openDirectory", "createDirectory"],
    });
    if (selection.canceled || !selection.filePaths[0]) return workspaceStatus;
    const oldRoot = workspaceStatus.root;
    if (workspaceSecurity?.unlocked)
      throw new Error("Kopieren Sie den verschlüsselten Datenbestand und öffnen Sie anschließend die Kopie über ‚Vorhandenen Datenbestand öffnen‘.");
    const nextRoot = await workspaceManager.changeRoot(oldRoot, selection.filePaths[0], rawMode as WorkspaceChangeMode);
    if (sameWorkspaceRoot(nextRoot, oldRoot)) return workspaceStatus;
    try {
      await workspaceManager.acquireLock(nextRoot, app.getVersion());
      await initializeRuntime(nextRoot);
      await workspaceManager.releaseLock(oldRoot);
    } catch (error) {
      await workspaceManager.releaseLock(nextRoot);
      await workspaceManager.setup(oldRoot);
      await initializeRuntime(oldRoot);
      throw error;
    }
    return workspaceStatus;
  });
  if (workspaceStatus.state === "ready") {
    const openingRoot = workspaceStatus.root;
    try {
      const details = await workspaceManager.workspaceDetails(openingRoot).catch(() => ({
        filePath: path.join(resolveApplicationPaths(openingRoot).settingsRoot, "workspace.json"),
        modifiedAt: "",
      }));
      const migration = await readMigrationJournal(openingRoot);
      const inspected = migration ? null : await workspaceManager.inspectWorkspaceFile(details.filePath);
      if (!(await acquireWorkspaceLock(openingRoot))) {
        workspaceStatus = { state: "error", root: openingRoot, message: "Der Datenbestand ist bereits geöffnet." };
      } else {
        if (migration || inspected?.encrypted) {
          if (inspected?.recoveryAvailable) {
            const answer = await dialog.showMessageBox({
              type: "warning", buttons: ["Abbrechen", "Sicherung wiederherstellen"],
              defaultId: 0, cancelId: 0,
              message: "Die verschlüsselte Workspace-Datei ist beschädigt. Eine Sicherung wurde gefunden.",
            });
            if (answer.response !== 1) throw new Error("Der beschädigte Datenbestand wurde nicht geöffnet.");
            await workspaceManager.restoreWorkspaceBackup(details.filePath);
          }
          workspaceStatus = { state: "locked", root: openingRoot, ...(migration ? { migration: migration.direction } : {}) };
          if (!migration) await tryDeviceUnlock(openingRoot);
        } else {
        if (inspected?.recoveryAvailable) {
          const answer = await dialog.showMessageBox({
            type: "warning", buttons: ["Abbrechen", "Sicherung wiederherstellen"],
            defaultId: 0, cancelId: 0,
            message: "Die Workspace-Datei ist beschädigt, aber eine gültige Sicherung wurde gefunden.",
          });
          if (answer.response !== 1) throw new Error("Der beschädigte Datenbestand wurde nicht geöffnet.");
          await workspaceManager.restoreWorkspaceBackup(details.filePath);
        }
        await initializeRuntime(openingRoot);
        }
      }
    } catch (error) {
      logDiagnostic("error", {
        event: "workspace_startup_failed", component: "workspace",
        error_code: "INTERNAL_ERROR", error_type: error instanceof Error ? error.name : "Unknown",
      });
      await workspaceManager.releaseLock(openingRoot);
      workspaceStatus = {
        state: "error",
        root: openingRoot,
        message: normalizeError(error).message,
      };
    }
  }
  await createMainWindow();
  if (workspaceStatus.state === "ready") notifyDueEvents();
  setInterval(() => { if (workspaceStatus.state === "ready") notifyDueEvents(); }, 60_000).unref();
  setInterval(() => {
    if (workspaceStatus.state !== "ready" || !workspaceSecurity?.unlocked) return;
    const minutes = store.getWorkspace().settings.autoLockMinutes;
    if (minutes > 0 && Date.now() - lastSecurityActivity >= minutes * 60_000) void lockRuntime();
  }, 15_000).unref();
  powerMonitor.on("lock-screen", () => { void lockRuntime(); });
  powerMonitor.on("suspend", () => { void lockRuntime(); });
  setInterval(() => { void workspaceManager.refreshLock(); }, 30_000).unref();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (!isPrimaryInstance) return;
  if (shutdownComplete) return;
  event.preventDefault();
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  void Promise.resolve()
    .then(() => workspaceManager?.releaseAllLocks())
    .then(() => rm(secureTempRoot(), { recursive: true, force: true }))
    .finally(() => {
      shutdownComplete = true;
      app.quit();
    });
});
