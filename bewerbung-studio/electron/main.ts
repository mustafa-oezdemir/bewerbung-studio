import path from "node:path";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  Notification,
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
import { ApplicationFolderLockedError } from "./file-management";
import { mergePdfDocuments } from "./pdf";
import { TemplateService } from "./templates/template.service";
import { createDefaultCoverLetterDocument } from "./templates/default-cover-letter";
import { createDefaultDeckblattDocument } from "./templates/default-deckblatt";
import { sanitizeTemplateFileName } from "./templates/template-filename.service";
import { wordMusterTemplateConfig } from "../src/features/templates/template.constants";
import { GitAutomationService } from "./git-automation";
import { WorkspaceManager } from "./workspace-management";
import type { WorkspaceStatus, WorkspaceChangeMode } from "../src/shared/ipc";

let mainWindow: BrowserWindow | null = null;
let store: DataStore;
let templateService: TemplateService;
let gitAutomation: GitAutomationService | undefined;
let gitShutdownInProgress = false;
let gitShutdownComplete = false;
let workspaceStatus: WorkspaceStatus = { state: "setup" };
let workspaceManager: WorkspaceManager;
let runtimeRegistered = false;
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
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = isDevelopment
      ? url.startsWith(process.env.VITE_DEV_SERVER_URL!)
      : url.startsWith(pathToFileURL(path.join(__dirname, "../dist/index.html")).toString());
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

const registerIpc = () => {
  ipcMain.handle("workspace:get", () => store.getWorkspace());
  ipcMain.handle("application-draft:get", () => store.getApplicationDraft());
  ipcMain.handle("application-draft:save", (_event, value: unknown) =>
    store.saveApplicationDraft(applicationDraftSchema.parse(value)),
  );
  ipcMain.handle("application-draft:clear", () =>
    store.clearApplicationDraft(),
  );
  ipcMain.handle("applications:create", async (_event, value: unknown) => {
    const workspace = await store.createApplication(
      applicationInputSchema.parse(value),
    );
    await Promise.all([
      synchronizeApplicationCoverLetter(workspace.applications[0].id),
      synchronizeApplicationDeckblatt(workspace.applications[0].id),
    ]);
    return workspace;
  });
  ipcMain.handle("applications:save", async (_event, value: unknown) => {
    try {
      const next = applicationSchema.parse(value);
      const workspace = await store.saveApplication(next);
      await Promise.all([
        synchronizeApplicationDeckblatt(next.id),
        synchronizeApplicationCoverLetter(next.id),
      ]);
      return workspace;
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
  ipcMain.handle("applications:remove", (_event, id: unknown) =>
    store.removeApplication(String(id)),
  );
  ipcMain.handle("applications:duplicate", async (_event, id: unknown) => {
    const workspace = await store.duplicateApplication(String(id));
    await Promise.all([
      synchronizeApplicationCoverLetter(workspace.applications[0].id),
      synchronizeApplicationDeckblatt(workspace.applications[0].id),
    ]);
    return workspace;
  });
  ipcMain.handle(
    "applications:change-status",
    (_event, id: unknown, status: unknown, reason: unknown) => {
      const validStatus = applicationStatuses.find((item) => item === status);
      const validReason = rejectionReasons.find((item) => item === reason);
      if (!validStatus) throw new Error("Ungültiger Bewerbungsstatus.");
      return store.changeStatus(String(id), validStatus, validReason);
    },
  );
  ipcMain.handle("applications:open-folder", async (_event, id: unknown) => {
    const error = await shell.openPath(
      store.getApplicationAnschreibenPath(String(id)),
    );
    if (error) throw new Error(error);
  });
  ipcMain.handle("profiles:save", async (_event, value: unknown) => {
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
  ipcMain.handle("profiles:remove", async (_event, id: unknown) => {
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
  ipcMain.handle("templates:scan", () =>
    templateService.scanAllTemplates(),
  );
  ipcMain.handle("templates:add", async (_event, rawInput: unknown) => {
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
  ipcMain.handle("templates:use", async (_event, rawInput: unknown) => {
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
    const openError = await shell.openPath(result.filePath);
    if (openError) throw new Error(openError);
    return result;
  });
  ipcMain.handle(
    "templates:sync-anschreiben",
    async (_event, applicationId: unknown) => {
      const id = String(applicationId);
      const result = await synchronizeApplicationCoverLetter(id);
      store.queueGitCommit(id, "anschreiben");
      return result;
    },
  );
  ipcMain.handle(
    "templates:duplicate",
    (_event, templateId: unknown) =>
      templateService.duplicateTemplate(String(templateId)),
  );
  ipcMain.handle(
    "templates:copy-to-muster",
    (_event, templateId: unknown) =>
      templateService.copyExistingTemplateById(String(templateId)),
  );
  ipcMain.handle(
    "templates:toggle-favorite",
    (_event, templateId: unknown) =>
      templateService.toggleTemplateFavorite(String(templateId)),
  );
  ipcMain.handle("templates:remove", (_event, templateId: unknown) =>
    templateService.deleteCustomTemplate(String(templateId)),
  );
  ipcMain.handle("templates:open", async (_event, templateId: unknown) => {
    const template = await templateService.getTemplateById(String(templateId));
    if (!template) throw new Error("Vorlage wurde nicht gefunden.");
    const error = await shell.openPath(template.filePath);
    if (error) throw new Error(error);
  });
  ipcMain.handle(
    "templates:open-folder",
    async (_event, templateId: unknown) => {
      const template = await templateService.getTemplateById(
        String(templateId),
      );
      if (!template) throw new Error("Vorlage wurde nicht gefunden.");
      shell.showItemInFolder(template.filePath);
    },
  );
  ipcMain.handle(
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
  ipcMain.handle("settings:save", (_event, value: unknown) =>
    store.saveSettings(appSettingsSchema.parse(value)),
  );
  ipcMain.handle("events:save", (_event, value: unknown) =>
    store.saveEvent(calendarEventSchema.parse(value)),
  );
  ipcMain.handle("todos:save", (_event, value: unknown) =>
    store.saveTodo(todoSchema.parse(value)),
  );
  ipcMain.handle("todos:remove", (_event, id: unknown) =>
    store.removeTodo(z.string().uuid().parse(id)),
  );
  ipcMain.handle("custom-cv-designs:save", (_event, value: unknown) =>
    store.saveCustomCvDesign(customCvDesignSchema.parse(value)),
  );
  ipcMain.handle("custom-cv-designs:remove", (_event, id: unknown) =>
    store.removeCustomCvDesign(z.string().uuid().parse(id)),
  );
  ipcMain.handle(
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
  ipcMain.handle("attachments:save", async (_event, value: unknown) => {
    const attachment = attachmentSchema.parse(value);
    const workspace = await store.saveAttachment(attachment);
    await synchronizeApplicationDeckblatt(attachment.applicationId);
    return workspace;
  });
  ipcMain.handle(
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
  ipcMain.handle("attachments:remove", async (_event, id: unknown) => {
    const attachment = store
      .getWorkspace()
      .attachments.find((item) => item.id === String(id));
    const workspace = await store.removeAttachment(String(id));
    if (attachment) {
      await synchronizeApplicationDeckblatt(attachment.applicationId);
    }
    return workspace;
  });
  ipcMain.handle("attachments:open", async (_event, id: unknown) => {
    const error = await shell.openPath(store.getAttachmentPathById(String(id)));
    if (error) throw new Error(error);
  });
  ipcMain.handle(
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
      const exportPath = store.getAutomaticExportPath(normalizedApplicationId, target);
      try {
        await access(exportPath);
        const confirmation = await dialog.showMessageBox(mainWindow!, {
          type: "question",
          title: "PDF bereits vorhanden",
          message: "Die vorhandene PDF-Datei ersetzen?",
          detail: exportPath,
          buttons: ["Ersetzen", "Abbrechen"],
          defaultId: 1,
          cancelId: 1,
        });
        if (confirmation.response !== 0) return null;
      } catch {
        // First export has no existing file.
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
        await exporter.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
        );
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
  ipcMain.handle("export:backup", async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: "JSON-Sicherung exportieren",
      defaultPath: `BewerbungsManager_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await store.writeBackup(result.filePath);
    return result.filePath;
  });
  ipcMain.handle("export:import-backup", async () => {
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
  ipcMain.handle("export:settings", async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: "Einstellungen exportieren",
      defaultPath: "BewerbungsManager_Einstellungen.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await store.writeSettings(result.filePath);
    return result.filePath;
  });
  ipcMain.handle("export:import-settings", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Einstellungen importieren",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return store.importSettings(result.filePaths[0]);
  });
  ipcMain.handle("migration:import-legacy", async () => {
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
  ipcMain.handle("system:open-external", async (_event, rawUrl: unknown) => {
    const url = new URL(String(rawUrl));
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Nur HTTP- und HTTPS-Links sind erlaubt.");
    await shell.openExternal(url.toString());
  });
  ipcMain.handle("system:data-path", () => store.dataPath);
};

const initializeRuntime = async (root: string) => {
  if (gitAutomation) {
    gitAutomation.dispose();
    await gitAutomation.waitForIdle().catch(() => undefined);
  }
  applicationPaths = resolveApplicationPaths(root, bundledTemplatesRoot);
  gitAutomation = await access(path.join(root, ".git"))
    .then(() => new GitAutomationService(applicationPaths.root))
    .catch(() => undefined);
  store = new DataStore(applicationPaths, gitAutomation);
  await store.initialize();
  await gitAutomation?.initialize();
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
  workspaceManager = new WorkspaceManager(app.getPath("userData"));
  try {
    workspaceStatus = await workspaceManager.status();
  } catch (error) {
    workspaceStatus = {
      state: "error",
      root: "",
      message: error instanceof Error ? error.message : "Die Speicherort-Konfiguration konnte nicht gelesen werden.",
    };
  }
  ipcMain.handle("system:workspace-status", () => workspaceStatus);
  ipcMain.handle("system:choose-workspace", async () => {
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: "Bewerbungsordner auswählen",
      properties: ["openDirectory", "createDirectory"],
    });
    if (selection.canceled || !selection.filePaths[0]) return workspaceStatus;
    const root = await workspaceManager.setup(selection.filePaths[0], false);
    await initializeRuntime(root);
    await workspaceManager.activate(root);
    return workspaceStatus;
  });
  ipcMain.handle("system:open-workspace", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    const error = await shell.openPath(workspaceStatus.root);
    if (error) throw new Error(error);
  });
  ipcMain.handle("system:backup-workspace", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    return workspaceManager.fullBackup(workspaceStatus.root);
  });
  ipcMain.handle("system:open-backups", async () => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    const backupPath = path.join(workspaceStatus.root, "data", "Backups");
    const error = await shell.openPath(backupPath);
    if (error) throw new Error(error);
  });
  ipcMain.handle("system:change-workspace", async (_event, rawMode: unknown) => {
    if (workspaceStatus.state !== "ready") throw new Error("Kein Bewerbungsordner eingerichtet.");
    if (!["move", "copy", "new"].includes(String(rawMode))) throw new Error("Ungültige Speicherort-Aktion.");
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: "Neuen Bewerbungsordner auswählen",
      properties: ["openDirectory", "createDirectory"],
    });
    if (selection.canceled || !selection.filePaths[0]) return workspaceStatus;
    const oldRoot = workspaceStatus.root;
    await gitAutomation?.waitForIdle().catch(() => undefined);
    const nextRoot = await workspaceManager.changeRoot(oldRoot, selection.filePaths[0], rawMode as WorkspaceChangeMode);
    try {
      await initializeRuntime(nextRoot);
    } catch (error) {
      await workspaceManager.setup(oldRoot);
      await initializeRuntime(oldRoot);
      throw error;
    }
    return workspaceStatus;
  });
  if (workspaceStatus.state === "ready") {
    try {
      await initializeRuntime(workspaceStatus.root);
    } catch (error) {
      workspaceStatus = {
        state: "error",
        root: workspaceStatus.root,
        message: error instanceof Error ? error.message : "Der Bewerbungsordner konnte nicht geladen werden.",
      };
    }
  }
  await createMainWindow();
  if (workspaceStatus.state === "ready") notifyDueEvents();
  setInterval(() => { if (workspaceStatus.state === "ready") notifyDueEvents(); }, 60_000).unref();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (!gitAutomation || gitShutdownComplete) return;
  event.preventDefault();
  if (gitShutdownInProgress) return;
  gitShutdownInProgress = true;
  gitAutomation.dispose();
  void gitAutomation
    .waitForIdle()
    .catch(() => undefined)
    .finally(() => {
      gitShutdownComplete = true;
      app.quit();
    });
});
