import {
  copyFile,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "./security/secure-fs";
import { encodeForManagedWrite, activeEncryption } from "./security/secure-fs";
import { parseEncryptedWorkspace } from "./security/encryption-service";
import { createHash } from "node:crypto";
import os from "node:os";
import { defaultDeckblattDesign } from "../src/shared/deckblattDesignIds";
import { resolveEducationPresentation } from "../src/shared/resumeEducation";
import { resolveResumeClosingLine } from "../src/shared/resumeClosing";
import { resolveExperience } from "../src/shared/resumeCareer";
import { formatLanguageForAts } from "../src/features/languages/language-levels";
import {
  isApplicationTodo,
  localDateKey,
  terminalApplicationStatuses,
} from "../src/shared/todos";
import { getProfessionalTitle, resolveApplicationProfile } from "../src/shared/profileSelection";
import { clearProfileDerivedDocumentFields, dropStaleProfileCopies } from "../src/shared/coverSender";
import { migrateLegacyResumeProfiles } from "../src/shared/legacyResumeProfile";
import path from "node:path";
import type { ApplicationPaths } from "../src/config/application-paths";
import { resolveApplicationPaths } from "../src/config/application-paths";
import {
  applicationInputSchema,
  applicationDraftSchema,
  applicationSchema,
  appSettingsSchema,
  customCvDesignSchema,
  attachmentSchema,
  deletedApplicationsArchiveSchema,
  defaultSettings,
  profileSchema,
  todoSchema,
  workspaceSchema,
  type ApplicantProfile,
  type Application,
  type ApplicationInput,
  type ApplicationDraft,
  type ApplicationStatus,
  type AppSettings,
  type Attachment,
  type AttachmentCategory,
  type CalendarEvent,
  type CustomCvDesign,
  type CalendarEventType,
  type DeletedApplicationsArchive,
  type RejectionReason,
  type Todo,
  type Workspace,
} from "../src/shared/schema";
import { templates } from "../src/shared/templates";
import {
  formatApplicationDate,
  formatApplicationDateLong,
  getApplicationDate,
} from "../src/shared/applicationDate";
import {
  buildApplicationEmailMarkdown,
  getApplicationEmail,
  resolveApplicationEmailAttachments,
} from "../src/shared/applicationEmail";
import {
  applicationContactDepartmentLines,
  applicationGreeting,
  applicationPostalContactLines,
} from "../src/shared/applicationContacts";
import {
  getDeckblattCompetencies,
  getDeckblattContacts,
  getDeckblattDocuments,
} from "../src/shared/deckblatt";
import {
  applicantDocumentFileName,
  coverLetterApplicantFileName,
  createCoverSubject,
  getCoverLetterAttachments,
  getCoverLetterMainBody,
} from "../src/shared/coverLetter";
import {
  compactWordMarginLevelToMm,
  getDocumentFont,
} from "../src/shared/documentDesign";
import { ensureKnowledgeSection } from "../src/features/knowledge/knowledge.service";
import { getLanguageLevelScore } from "../src/features/languages/language-levels";
import { getResumeSectionTitle } from "../src/features/resume-sections/resume-sections";
import { resolveKnowledgeGroups } from "../src/features/resume-sections/resume-section-system";
import { formatKnowledgeSectionAsText } from "../src/features/knowledge/knowledge.utils";
import { buildDocumentHtml } from "./documents";
import {
  FileManagementService,
  isNestedFolderName,
  isPathInside,
  normalizeFolderName,
} from "./file-management";
import { LegacyMigrationService } from "./legacy-migration";
import type {
  ApplicationGitAction,
  ApplicationGitCommitQueue,
} from "./git-automation";
import { resolveResumeSummary } from "../src/shared/resumeSummary";

const nowIso = () => new Date().toISOString();
const createId = () => crypto.randomUUID();
const terminalStatuses = new Set<ApplicationStatus>(terminalApplicationStatuses);

const isDeadlineTodo = (todo: Todo) => todo.source === "application-deadline";

/**
 * The system part of the automatic deadline todo; `deadlineAt` stays the only stored date. The description is the
 * note of the user and is never written by the sync.
 */
const deadlineTodoFields = (application: Application) => {
  const title = `Bewerbungsfrist · ${application.company.name} · ${application.job.title}`;
  return {
    title: title.length > 160 ? `${title.slice(0, 159)}…` : title,
    dueDate: localDateKey(new Date(application.deadlineAt as string)),
  };
};

/** The first version of the deadline todo generated this as its description; it is not a note of the user. */
const generatedDeadlineDescription = (application: Application) =>
  `Bewerbungsfrist für ${application.job.title} bei ${application.company.name}`;

const applicationContentChanged = (
  current: Application,
  next: Application,
) =>
  JSON.stringify({ ...current, folderName: "", updatedAt: "" }) !==
  JSON.stringify({ ...next, folderName: "", updatedAt: "" });

const gitActionForStatus = (
  status: ApplicationStatus,
): ApplicationGitAction => {
  if (status === "Absage") return "absage";
  if (status === "Vorstellungsgespräch") return "vorstellungsgespraech";
  if (status === "Beworben" || status === "Gesendet") return "bewerbung";
  return "update";
};

const templateContactLine = (
  label: string,
  value: string | undefined,
) => (value?.trim() ? `${label}: ${value.trim()}` : "");

const languagePoints = (level: string) => {
  const score = level ? getLanguageLevelScore(level) : 0;
  return `${"●".repeat(score)}${"○".repeat(6 - score)}`;
};

const wordFontName = (fontId: Application["designSettings"]["fontId"]) =>
  getDocumentFont(fontId).family.match(/"([^"]+)"|([^,]+)/)?.[1] ??
  getDocumentFont(fontId).family.match(/"([^"]+)"|([^,]+)/)?.[2]?.trim() ??
  "Arial";

const blendHexColor = (
  foreground: string,
  background: string,
  backgroundWeight: number,
) => {
  const parse = (value: string) =>
    [1, 3, 5].map((offset) =>
      Number.parseInt(value.replace("#", "").slice(offset - 1, offset + 1), 16),
    );
  const left = parse(foreground);
  const right = parse(background);
  return `#${left
    .map((channel, index) =>
      Math.round(
        channel * (1 - backgroundWeight) +
          right[index] * backgroundWeight,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

const eventReminders: Record<CalendarEventType, number[]> = {
  "application-sent": [],
  "application-rejected": [],
  "application-deadline": [4320, 1440],
  interview: [1440, 60],
  "second-interview": [1440, 60],
  "phone-interview": [1440, 60],
  "online-interview": [1440, 60],
  "trial-work": [1440],
  assessment: [1440],
  "follow-up-call": [0],
  "follow-up-email": [0],
  "contract-start": [1440],
  "contract-end": [10080],
  "fixed-term-end": [20160],
  "probation-end": [20160],
  custom: [],
};

const emptyWorkspace = (): Workspace => ({
  schemaVersion: 1,
  applications: [],
  profiles: [],
  events: [],
  attachments: [],
  todos: [],
  customCvDesigns: [],
  settings: defaultSettings,
  updatedAt: nowIso(),
});

const emptyDeletedApplicationsArchive = (): DeletedApplicationsArchive => ({
  schemaVersion: 1,
  deletedApplications: [],
  updatedAt: nowIso(),
});

const timestamp = () =>
  new Date().toISOString().replace(/\D/g, "").slice(0, 14);

const addDaysAtNine = (value: string, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
};

const joinTemplateValues = (
  values: Array<string | undefined>,
  separator = " | ",
) => values.map((value) => value?.trim()).filter(Boolean).join(separator);

const splitLanguage = (value: string) => {
  const [name, ...levelParts] = value
    .split(/\s+(?:\||–|—|:)\s+|\s+-\s+/)
    .map((part) => part.trim());
  return {
    name: name ?? "",
    level: levelParts.join(" – "),
  };
};

const formatSpecialSectionEntry = (
  entry: ApplicantProfile["specialSections"][number]["entries"][number],
) => {
  const period = entry.date || joinTemplateValues([entry.from, entry.to], " – ");
  const heading = joinTemplateValues(
    [entry.title, entry.subtitle, entry.location],
    " | ",
  );
  return [
    joinTemplateValues([period, heading], " | "),
    entry.description,
    ...entry.bullets.map((item) => `• ${item}`),
    entry.url,
  ]
    .filter(Boolean)
    .join("\n");
};

const specialSectionContent = (
  profile: ApplicantProfile | undefined,
  kinds: ApplicantProfile["specialSections"][number]["kind"][],
) =>
  (profile?.specialSections ?? [])
    .filter((section) => section.isVisible && kinds.includes(section.kind))
    .flatMap((section) => section.entries.map(formatSpecialSectionEntry))
    .filter(Boolean)
    .join("\n\n");

const specialSectionTitle = (
  profile: ApplicantProfile | undefined,
  kinds: ApplicantProfile["specialSections"][number]["kind"][],
  fallback: string,
) => {
  const sections = (profile?.specialSections ?? []).filter(
    (section) =>
      section.isVisible &&
      kinds.includes(section.kind) &&
      section.entries.some((entry) => formatSpecialSectionEntry(entry)),
  );
  return sections[0]?.title || (sections.length ? fallback : "");
};

export class DataStore {
  readonly dataPath: string;
  readonly files: FileManagementService;
  readonly migration: LegacyMigrationService;
  private workspacePath: string;
  private loadedWorkspaceHash: string | null = null;
  private readonly applicationDraftPath: string;
  private readonly deletedApplicationsPath: string;
  private workspace: Workspace = emptyWorkspace();

  constructor(
    rootOrPaths: string | ApplicationPaths,
    private readonly gitAutomation?: ApplicationGitCommitQueue,
    private readonly expectedLockId?: string,
  ) {
    const paths =
      typeof rootOrPaths === "string"
        ? resolveApplicationPaths(rootOrPaths)
        : rootOrPaths;
    this.files = new FileManagementService(paths);
    this.migration = new LegacyMigrationService(paths);
    this.dataPath = paths.dataRoot;
    this.workspacePath = path.join(paths.settingsRoot, "workspace.json");
    this.applicationDraftPath = path.join(
      paths.settingsRoot,
      "new-application-draft.json",
    );
    this.deletedApplicationsPath = path.join(paths.deletedRoot, "silinenler.json");
  }

  async initialize() {
    await this.files.initialize();
    const legacyWorkspacePath = path.join(this.dataPath, "Settings", "workspace.json");
    if (!(await stat(this.workspacePath).catch(() => null)) &&
        !(await stat(`${this.workspacePath}.bak`).catch(() => null)) &&
        ((await stat(legacyWorkspacePath).catch(() => null)) ||
         (await stat(`${legacyWorkspacePath}.bak`).catch(() => null)))) {
      this.workspacePath = legacyWorkspacePath;
    }
    this.workspace = migrateLegacyResumeProfiles(await this.loadWorkspace());
    for (const application of this.workspace.applications) {
      application.documents = dropStaleProfileCopies(
        application.documents,
        this.getProfileForApplication(application),
        this.workspace.profiles,
      );
      application.folderName = await this.files.relocateApplicationFolders(
        application,
        getApplicationDate(application),
      );
      await this.files.ensureApplicationDataDirectories(application);
      await this.files.consolidateLegacyDocumentDirectories(application);
      await this.files.normalizeLegacyDocumentNames(
        application,
        this.applicantDocumentNames(application),
      );
    }
    await this.files.archiveUnmatchedLegacyDocumentDirectories();
    this.workspace.applications.forEach((application) =>
      this.syncEvents(application),
    );
    this.reconcileApplicationTodos();
    await this.persist();
  }

  getWorkspace() {
    return structuredClone(this.workspace);
  }

  clearForLock() {
    this.workspace = emptyWorkspace();
    this.loadedWorkspaceHash = null;
  }

  async getApplicationDraft() {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.applicationDraftPath, "utf8"),
      );
      return applicationDraftSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  async saveApplicationDraft(draft: ApplicationDraft) {
    const validated = applicationDraftSchema.parse(draft);
    await this.atomicWrite(
      this.applicationDraftPath,
      JSON.stringify(validated, null, 2),
    );
  }

  async clearApplicationDraft() {
    await rm(this.applicationDraftPath, { force: true });
    await rm(`${this.applicationDraftPath}.bak`, { force: true });
  }

  private async loadWorkspace() {
    let foundExisting = false;
    for (const candidate of [this.workspacePath, `${this.workspacePath}.bak`]) {
      try {
        const content = await readFile(candidate, "utf8");
        const parsed: unknown = JSON.parse(content);
        foundExisting = true;
        const result = workspaceSchema.safeParse(parsed);
        if (result.success) {
          if (candidate !== this.workspacePath) {
            const recoveryRoot = this.files.paths.backupsRoot;
            await mkdir(recoveryRoot, { recursive: true });
            const recoveryId = `${timestamp()}-${createId()}`;
            if (await stat(this.workspacePath).catch(() => null)) {
              await copyFile(this.workspacePath, path.join(recoveryRoot, `unlesbar-workspace-${recoveryId}.json`));
            }
            await copyFile(candidate, path.join(recoveryRoot, `wiederhergestellt-workspace-${recoveryId}.json`));
          }
          const activeContent = candidate === this.workspacePath
            ? content
            : await readFile(this.workspacePath, "utf8").catch(() => null);
          this.loadedWorkspaceHash = activeContent === null ? null
            : createHash("sha256").update(activeContent).digest("hex");
          return result.data;
        }
      } catch {
        if (await stat(candidate).catch(() => null)) foundExisting = true;
      }
    }
    if (foundExisting) {
      throw new Error("Die vorhandenen Bewerbungsdaten konnten nicht gelesen werden. Die Dateien wurden nicht überschrieben.");
    }
    return emptyWorkspace();
  }

  private async loadDeletedApplicationsArchive() {
    let archiveFound = false;
    for (const candidate of [
      this.deletedApplicationsPath,
      `${this.deletedApplicationsPath}.bak`,
    ]) {
      try {
        const parsed: unknown = JSON.parse(await readFile(candidate, "utf8"));
        archiveFound = true;
        const result = deletedApplicationsArchiveSchema.safeParse(parsed);
        if (result.success) return result.data;
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : "";
        if (code !== "ENOENT") archiveFound = true;
      }
    }
    if (archiveFound) {
      throw new Error(
        "Das Archiv der gelöschten Bewerbungen konnte nicht gelesen werden.",
      );
    }
    return emptyDeletedApplicationsArchive();
  }

  private async archiveDeletedApplication(application: Application) {
    const archive = await this.loadDeletedApplicationsArchive();
    const record = {
      deletedAt: nowIso(),
      application: structuredClone(application),
      events: structuredClone(
        this.workspace.events.filter(
          (event) => event.applicationId === application.id,
        ),
      ),
      attachments: structuredClone(
        this.workspace.attachments.filter(
          (attachment) => attachment.applicationId === application.id,
        ),
      ),
    };
    archive.deletedApplications = [
      record,
      ...archive.deletedApplications.filter(
        (item) => item.application.id !== application.id,
      ),
    ];
    archive.updatedAt = record.deletedAt;
    const validated = deletedApplicationsArchiveSchema.parse(archive);
    await this.atomicWrite(
      this.deletedApplicationsPath,
      JSON.stringify(validated, null, 2),
    );
  }

  private async atomicWrite(filePath: string, content: string, expectedHash?: string | null) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${createId()}.tmp`;
    const backupPath = `${filePath}.bak`;
    const handle = await open(temporaryPath, "w");
    try {
      await handle.writeFile(encodeForManagedWrite(filePath, Buffer.from(content, "utf8")));
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (expectedHash !== undefined) {
      const current = await readFile(filePath, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      const currentHash = current === null ? null : createHash("sha256").update(current).digest("hex");
      if (currentHash !== expectedHash) {
        await rm(temporaryPath, { force: true });
        throw new Error("Der Datenbestand wurde seit dem Öffnen extern geändert. Bitte laden Sie ihn neu oder erstellen Sie zuerst eine Sicherung.");
      }
    }
    try {
      await copyFile(filePath, backupPath);
    } catch {
      // A first write has no previous version.
    }
    try {
      await rename(temporaryPath, filePath);
    } catch {
      await rm(filePath, { force: true });
      await rename(temporaryPath, filePath);
    }
  }

  private async persist(applicationsToPersist: readonly Application[] = []) {
    // Application documents are snapshots. Unrelated workspace saves must not
    // rewrite older application folders or their modification timestamps.
    const lockPath = path.join(path.dirname(this.dataPath), ".workspace.lock");
    const lockContent = await readFile(lockPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (this.expectedLockId && !lockContent)
      throw new Error("Der Datenbestand ist durch eine andere Instanz gesperrt.");
    if (lockContent) {
      let lock: { hostname?: string; pid?: number; lockId?: string };
      try { lock = JSON.parse(lockContent) as { hostname?: string; pid?: number; lockId?: string }; }
      catch { throw new Error("Der Datenbestand ist durch eine andere Instanz gesperrt."); }
      if (lock.hostname !== os.hostname() || lock.pid !== process.pid ||
          (this.expectedLockId && lock.lockId !== this.expectedLockId))
        throw new Error("Der Datenbestand ist durch eine andere Instanz gesperrt.");
    }
    const diskContent = await readFile(this.workspacePath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    const diskHash = diskContent === null ? null : createHash("sha256").update(diskContent).digest("hex");
    if (diskHash !== this.loadedWorkspaceHash) {
      throw new Error("Der Datenbestand wurde seit dem Öffnen extern geändert. Bitte laden Sie ihn neu oder erstellen Sie zuerst eine Sicherung.");
    }
    this.workspace.updatedAt = nowIso();
    const validated = workspaceSchema.parse(this.workspace);
    const content = JSON.stringify(validated, null, 2);
    await this.atomicWrite(
      this.workspacePath,
      content,
      this.loadedWorkspaceHash,
    );
    this.loadedWorkspaceHash = createHash("sha256").update(content).digest("hex");
    await Promise.all(
      applicationsToPersist.map((application) =>
        this.persistApplicationFiles(applicationSchema.parse(application)),
      ),
    );
    await this.createAutomaticBackup();
  }

  private async createAutomaticBackup() {
    if (!this.workspace.settings.autoBackupEnabled) return;
    const backupRoot = this.files.paths.backupsRoot;
    await mkdir(backupRoot, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const backupPath = path.join(backupRoot, `workspace-${date}.json`);
    try {
      await stat(backupPath);
    } catch {
      await copyFile(this.workspacePath, backupPath);
    }
    const backups = (await readdir(backupRoot, { withFileTypes: true }))
      .filter(
        (entry) =>
          entry.isFile() && /^workspace-\d{4}-\d{2}-\d{2}\.json$/.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const fileName of backups.slice(
      this.workspace.settings.backupRetention,
    )) {
      const target = path.resolve(backupRoot, fileName);
      if (!target.startsWith(`${path.resolve(backupRoot)}${path.sep}`))
        throw new Error("Ungültiger Sicherungspfad.");
      await rm(target, { force: true });
    }
  }

  queueGitCommit(id: string, action: ApplicationGitAction) {
    const application = this.getApplication(id);
    this.gitAutomation?.queueCommit(application.company.name, action);
  }

  private queueApplicationGitCommit(
    application: Pick<Application, "company">,
    action: ApplicationGitAction,
  ) {
    this.gitAutomation?.queueCommit(application.company.name, action);
  }

  private applicationPath(application: Application) {
    return this.files.applicationDataPath(application.folderName);
  }

  getApplicationAnschreibenPath(id: string) {
    const application = this.workspace.applications.find((item) => item.id === id);
    if (!application) throw new Error("Bewerbung wurde nicht gefunden.");
    return this.files.documentDirectories(application).anschreiben;
  }

  private async ensureApplicationDataDirectories(application: Application) {
    return this.files.ensureApplicationDataDirectories(application);
  }

  private async persistApplicationFiles(application: Application) {
    const documents = this.files.documentDirectories(application);
    await mkdir(documents.anschreiben, { recursive: true });
    const { dataRoot } =
      await this.ensureApplicationDataDirectories(application);
    const profile = this.getProfileForApplication(application);
    const visibleEmailDocuments = getDeckblattDocuments(
      this.workspace.attachments,
      application.id,
      application.documents.documentListSettings,
    );
    const emailAttachments = resolveApplicationEmailAttachments(
      application.documents,
      visibleEmailDocuments,
    );
    const email = getApplicationEmail(application, profile, emailAttachments);
    await Promise.all([
      this.atomicWrite(
        path.join(dataRoot, "bewerbung.json"),
        JSON.stringify(applicationSchema.parse(application), null, 2),
      ),
      this.atomicWrite(
        path.join(documents.stellenanzeige, "stellenanzeige.json"),
        JSON.stringify(application.job, null, 2),
      ),
      this.atomicWrite(
        path.join(documents.stellenanzeige, "stellenanzeige.txt"),
        application.job.fullText,
      ),
      this.atomicWrite(
        path.join(documents.email, "Email.md"),
        buildApplicationEmailMarkdown(application, profile, emailAttachments),
      ),
      this.atomicWrite(
        path.join(documents.email, "email.json"),
        JSON.stringify(email, null, 2),
      ),
    ]);
  }

  private createEvent(
    applicationId: string,
    type: CalendarEventType,
    title: string,
    startAt: string,
    allDay: boolean,
  ): CalendarEvent {
    const now = nowIso();
    return {
      id: createId(),
      applicationId,
      type,
      title,
      description: "",
      startAt,
      allDay,
      completed: false,
      cancelled: false,
      reminderMinutes: eventReminders[type],
      createdAt: now,
      updatedAt: now,
    };
  }

  private ensureEvent(
    application: Application,
    type: CalendarEventType,
    title: string,
    startAt?: string,
    allDay = false,
  ) {
    const existing = this.workspace.events.find(
      (event) =>
        event.applicationId === application.id && event.type === type,
    );
    if (!startAt) {
      if (existing) {
        existing.cancelled = true;
        existing.updatedAt = nowIso();
      }
      return;
    }
    if (existing) {
      Object.assign(existing, {
        title,
        startAt,
        allDay,
        cancelled: false,
        updatedAt: nowIso(),
      });
      return;
    }
    this.workspace.events.push(
      this.createEvent(application.id, type, title, startAt, allDay),
    );
  }

  private syncEvents(application: Application) {
    const company = application.company.name;
    this.ensureEvent(
      application,
      "application-sent",
      `${company} · Bewerbung gesendet`,
      application.sentAt,
      true,
    );
    this.ensureEvent(
      application,
      "application-rejected",
      `${company} · Absage`,
      application.status === "Absage" ? application.rejectionAt : undefined,
      true,
    );
    this.ensureEvent(
      application,
      "application-deadline",
      `Bewerbungsfrist · ${company}`,
      application.deadlineAt,
      true,
    );
    this.ensureEvent(
      application,
      "interview",
      `Vorstellungsgespräch · ${company}`,
      application.interviewAt,
    );
    this.ensureEvent(
      application,
      "second-interview",
      `Zweites Gespräch · ${company}`,
      application.secondInterviewAt,
    );
    this.ensureEvent(
      application,
      "contract-start",
      `Vertragsbeginn · ${company}`,
      application.startAt,
      true,
    );
    this.ensureEvent(
      application,
      "contract-end",
      `Vertragsende · ${company}`,
      application.contractEndAt,
      true,
    );
    this.ensureEvent(
      application,
      "fixed-term-end",
      `Befristungsende · ${company}`,
      application.fixedTermEndAt,
      true,
    );
    this.ensureEvent(
      application,
      "probation-end",
      `Probezeitende · ${company}`,
      application.probationEndAt,
      true,
    );
    const followUp =
      (application.status === "Beworben" || application.status === "Gesendet") &&
      application.sentAt &&
      this.workspace.settings.followUpDays !== null
        ? addDaysAtNine(application.sentAt, this.workspace.settings.followUpDays)
        : undefined;
    this.ensureEvent(
      application,
      "follow-up-call",
      `${company} · Nachfassen`,
      followUp,
    );
    if (terminalStatuses.has(application.status)) {
      const preserved = new Set<CalendarEventType>([
        "application-sent",
        "application-rejected",
        "contract-start",
        "contract-end",
        "fixed-term-end",
        "probation-end",
      ]);
      this.workspace.events.forEach((event) => {
        if (
          event.applicationId === application.id &&
          !preserved.has(event.type) &&
          new Date(event.startAt) > new Date()
        ) {
          event.cancelled = true;
          event.updatedAt = nowIso();
        }
      });
    }
  }

  /**
   * Keeps exactly one automatic todo per application in step with `deadlineAt`, next to the calendar event of
   * `syncEvents`. Only todos with `source === "application-deadline"` and this `applicationId` are ever touched;
   * manual todos are never read, changed or removed here. An existing todo keeps its id, priority, completion, note
   * and creation date: only title and due date follow the application.
   * A terminal status (see `terminalStatuses`) creates no todo and leaves an existing one as it is: the lists hide
   * it (`activeTodos`), and a status that is taken back finds the same todo again.
   */
  private syncApplicationTodo(application: Application) {
    const linked = this.workspace.todos
      .filter((todo) => isDeadlineTodo(todo) && todo.applicationId === application.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const [existing, ...duplicates] = linked;
    const drop = new Set<Todo>(duplicates);
    if (!application.deadlineAt) {
      if (existing) drop.add(existing);
    } else if (!terminalStatuses.has(application.status)) {
      const fields = deadlineTodoFields(application);
      if (!existing) {
        const now = nowIso();
        this.workspace.todos.unshift({
          id: createId(),
          ...fields,
          description: "",
          priority: "high",
          completed: false,
          createdAt: now,
          updatedAt: now,
          applicationId: application.id,
          source: "application-deadline",
        });
      } else if (
        existing.title !== fields.title ||
        existing.dueDate !== fields.dueDate ||
        existing.description === generatedDeadlineDescription(application)
      ) {
        Object.assign(
          existing,
          fields,
          existing.description === generatedDeadlineDescription(application)
            ? { description: "" }
            : {},
          { updatedAt: nowIso() },
        );
      }
    }
    if (drop.size) {
      this.workspace.todos = this.workspace.todos.filter((todo) => !drop.has(todo));
    }
  }

  /** Startup and import: old todos become explicit manual ones, orphaned automatic todos go, every deadline is synced. */
  private reconcileApplicationTodos() {
    const applicationIds = new Set(
      this.workspace.applications.map((application) => application.id),
    );
    for (const todo of this.workspace.todos) todo.source ??= "manual";
    this.workspace.todos = this.workspace.todos.filter(
      (todo) =>
        !isApplicationTodo(todo) ||
        (todo.applicationId !== undefined && applicationIds.has(todo.applicationId)),
    );
    this.workspace.applications.forEach((application) =>
      this.syncApplicationTodo(application),
    );
  }

  /**
   * An application of an older version sits directly in `<Firma>_<Datum>`. When a second position of that company
   * and day needs the shared folder, the older application first gets its own position subfolder, moved with the
   * same checked, reversible relocation as every other move (nothing is overwritten, locked files stop it).
   */
  private async nestLegacyApplicationAt(rootFolder: string, exceptId?: string) {
    const legacy = this.workspace.applications.find(
      (item) => item.id !== exceptId && normalizeFolderName(item.folderName) === rootFolder,
    );
    if (!legacy) return;
    legacy.folderName = await this.files.relocateApplicationFolders(
      legacy,
      getApplicationDate(legacy),
      { nest: true },
    );
    await this.persist([legacy]);
  }

  async createApplication(rawInput: ApplicationInput) {
    const input = applicationInputSchema.parse(rawInput);
    const now = nowIso();
    const date = input.sentAt ? new Date(input.sentAt) : new Date();
    await this.nestLegacyApplicationAt(this.files.applicationRootFolderName(input.company.name, date));
    const folderName = await this.files.allocateApplicationFolderName(
      input.company.name,
      input.job.title,
      date,
    );
    const application: Application = {
      schemaVersion: 1,
      id: createId(),
      folderName,
      ...input,
      profileId: resolveApplicationProfile(this.workspace.profiles, input.profileId)?.id,
      templateDesigns: {},
      additionalContacts: input.additionalContacts ?? [],
      status: input.sentAt ? "Beworben" : "Entwurf",
      documents: {
        coverSenderName: "",
        coverSenderTitle: "",
        coverSenderContact: "",
        coverSheetProfessionalTitle: "",
        coverSheetDesign: defaultDeckblattDesign,
        coverSheetContactVisibility: {
          address: true,
          phone: true,
          email: true,
          linkedin: true,
          github: true,
          website: true,
        },
        coverRecipientAddress: "",
        coverSubject: createCoverSubject(input.job.title),
        coverSubjectGapReduction: 0,
        coverGreeting: "",
        coverIntroduction: `die Position als ${input.job.title} bei ${input.company.name} verbindet genau die Aufgaben, in denen ich meine Erfahrung gezielt einbringen möchte.`,
        coverMainBody: "",
        coverMotivation: "",
        coverQualification: "",
        coverCompanyFit: "",
        coverExtraParagraph: "",
        coverClosing:
          "Gerne überzeuge ich Sie in einem persönlichen Gespräch von meiner Motivation und Eignung. Auf Ihren Terminvorschlag freue ich mich.",
        resumeProfile: "",
        legacyResumeProfile: "",
        deckblattStatement: "",
        emailSubject: "",
        emailMessage: "",
        emailAttachmentNote: "",
        emailAttachmentMode: "package",
        emailPackageFileName: "Bewerbungsunterlagen.pdf",
        showCoverLetterAttachments: true,
        documentListSettings: [],
      },
      attachmentIds: [],
      statusHistory: [
        {
          at: now,
          to: input.sentAt ? "Beworben" : "Entwurf",
          note: "Bewerbung angelegt",
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.workspace.applications.unshift(applicationSchema.parse(application));
    this.syncEvents(application);
    this.syncApplicationTodo(application);
    await this.persist([application]);
    this.queueApplicationGitCommit(
      application,
      input.sentAt ? "bewerbung" : "create",
    );
    return this.getWorkspace();
  }

  async saveApplication(rawApplication: Application) {
    const application = applicationSchema.parse(rawApplication);
    const index = this.workspace.applications.findIndex(
      (item) => item.id === application.id,
    );
    if (index < 0) throw new Error("Bewerbung wurde nicht gefunden.");
    const current = this.workspace.applications[index];
    if (
      this.getProfileForApplication(current)?.id !==
      this.getProfileForApplication(application)?.id
    ) {
      application.documents = clearProfileDerivedDocumentFields(application.documents);
    }
    const shouldCommitUpdate = applicationContentChanged(current, application);
    await this.files.consolidateLegacyDocumentDirectories(current);
    const applicationDate = new Date(application.sentAt ?? current.createdAt);
    if (isNestedFolderName(current.folderName)) {
      await this.nestLegacyApplicationAt(
        this.files.applicationRootFolderName(application.company.name, applicationDate),
        application.id,
      );
    }
    application.folderName = await this.files.relocateApplicationFolders(
      {
        ...application,
        folderName: current.folderName,
      },
      applicationDate,
    );
    try {
      await this.files.synchronizeApplicationArtifactNames(current, application);
      await this.files.normalizeLegacyDocumentNames(
        application,
        this.applicantDocumentNames(application),
      );
    } catch (error) {
      await this.files.relocateApplicationFolders(
        { ...current, folderName: application.folderName },
        new Date(current.sentAt ?? current.createdAt),
      );
      throw error;
    }
    await this.files.syncInterviewFolder(current, application);
    application.updatedAt = nowIso();
    this.workspace.applications[index] = application;
    this.syncEvents(application);
    this.syncApplicationTodo(application);
    await this.persist([application]);
    if (shouldCommitUpdate) {
      this.queueApplicationGitCommit(application, "update");
    }
    return this.getWorkspace();
  }

  async changeStatus(
    id: string,
    status: ApplicationStatus,
    reason?: RejectionReason,
  ) {
    const application = this.workspace.applications.find((item) => item.id === id);
    if (!application) throw new Error("Bewerbung wurde nicht gefunden.");
    if (application.status !== status) {
      const now = nowIso();
      const previous = application.status;
      await this.files.syncInterviewFolder(undefined, {
        ...application,
        status,
      });
      await this.files.transitionApplicationDocuments(application, status);
      application.status = status;
      application.updatedAt = now;
      application.statusHistory.push({ at: now, from: previous, to: status, note: "" });
      if (status === "Absage") {
        application.rejectionAt = now;
        application.rejectionReason = reason ?? "Keine Begründung";
      }
      if (status === "Zusage") application.acceptedAt = now;
      if (status === "Zurückgezogen") application.withdrawnAt = now;
      if (status === "Archiviert") application.archivedAt = now;
      this.syncEvents(application);
      this.syncApplicationTodo(application);
      await this.persist([application]);
      this.queueApplicationGitCommit(application, gitActionForStatus(status));
    }
    return this.getWorkspace();
  }

  async removeApplication(id: string) {
    const application = this.workspace.applications.find(
      (item) => item.id === id,
    );
    if (!application) throw new Error("Bewerbung wurde nicht gefunden.");

    await this.archiveDeletedApplication(application);
    await this.files.removeApplicationArtifacts(application);
    this.workspace.applications = this.workspace.applications.filter(
      (application) => application.id !== id,
    );
    this.workspace.events = this.workspace.events.filter(
      (event) => event.applicationId !== id,
    );
    this.workspace.attachments = this.workspace.attachments.filter(
      (attachment) => attachment.applicationId !== id,
    );
    this.workspace.todos = this.workspace.todos.filter(
      (todo) => !(isApplicationTodo(todo) && todo.applicationId === id),
    );
    await this.persist();
    this.queueApplicationGitCommit(application, "delete");
    return this.getWorkspace();
  }

  async duplicateApplication(id: string) {
    const source = this.workspace.applications.find((item) => item.id === id);
    if (!source) throw new Error("Bewerbung wurde nicht gefunden.");
    const now = nowIso();
    await this.nestLegacyApplicationAt(this.files.applicationRootFolderName(source.company.name, new Date()));
    const folderName = await this.files.allocateApplicationFolderName(
      source.company.name,
      source.job.title,
    );
    const duplicate: Application = {
      ...structuredClone(source),
      id: createId(),
      folderName,
      status: "Entwurf",
      sentAt: undefined,
      rejectionAt: undefined,
      rejectionReason: undefined,
      acceptedAt: undefined,
      attachmentIds: [],
      statusHistory: [{ at: now, to: "Entwurf", note: "Bewerbung dupliziert" }],
      createdAt: now,
      updatedAt: now,
    };
    this.workspace.applications.unshift(duplicate);
    this.syncEvents(duplicate);
    this.syncApplicationTodo(duplicate);
    await this.persist([duplicate]);
    this.queueApplicationGitCommit(duplicate, "create");
    return this.getWorkspace();
  }

  async saveProfile(rawProfile: ApplicantProfile) {
    const profile = profileSchema.parse(rawProfile);
    if (profile.isDefault) {
      this.workspace.profiles.forEach((item) => {
        item.isDefault = false;
      });
    }
    const index = this.workspace.profiles.findIndex(
      (item) => item.id === profile.id,
    );
    if (index >= 0) this.workspace.profiles[index] = profile;
    else this.workspace.profiles.push(profile);
    await this.persist();
    return this.getWorkspace();
  }

  async removeProfile(id: string) {
    const index = this.workspace.profiles.findIndex(
      (profile) => profile.id === id,
    );
    if (index < 0) throw new Error("Profil wurde nicht gefunden.");

    this.workspace.profiles.splice(index, 1);
    if (
      this.workspace.profiles.length > 0 &&
      !this.workspace.profiles.some((profile) => profile.isDefault)
    ) {
      this.workspace.profiles[0].isDefault = true;
    }
    const replacement =
      this.workspace.profiles.find((profile) => profile.isDefault) ??
      this.workspace.profiles[0];
    const now = nowIso();
    const reassignedApplications = this.workspace.applications.filter(
      (application) => application.profileId === id,
    );
    reassignedApplications.forEach((application) => {
      application.profileId = replacement?.id;
      application.documents = clearProfileDerivedDocumentFields(application.documents);
      application.updatedAt = now;
    });

    await this.persist(reassignedApplications);
    return this.getWorkspace();
  }

  async saveSettings(settings: AppSettings) {
    this.workspace.settings = appSettingsSchema.parse(settings);
    this.workspace.applications.forEach((application) =>
      this.syncEvents(application),
    );
    await this.persist();
    return this.getWorkspace();
  }

  async saveEvent(event: CalendarEvent) {
    const index = this.workspace.events.findIndex((item) => item.id === event.id);
    if (index < 0) throw new Error("Termin wurde nicht gefunden.");
    this.workspace.events[index] = event;
    await this.persist();
    if (event.applicationId) {
      this.queueGitCommit(event.applicationId, "update");
    }
    return this.getWorkspace();
  }

  async addAttachment(
    applicationId: string,
    category: AttachmentCategory,
    sourcePath: string,
  ) {
    const application = this.workspace.applications.find(
      (item) => item.id === applicationId,
    );
    if (!application) throw new Error("Bewerbung wurde nicht gefunden.");
    const sourceName = path.basename(sourcePath);
    if (path.extname(sourceName).toLocaleLowerCase("de-DE") !== ".pdf") {
      throw new Error("Bitte wählen Sie eine PDF-Datei aus.");
    }
    const archiveRoot = this.files.archiveRootForCategory(category);
    const sourceIsInArchive = isPathInside(archiveRoot, sourcePath);
    let archiveRelativePath: string;
    if (sourceIsInArchive) {
      archiveRelativePath = this.files.archiveRelativePath(category, sourcePath);
    } else {
      const extension = path.extname(sourceName);
      const baseName = path.basename(sourceName, extension);
      const archiveNames = new Set(await readdir(archiveRoot));
      let targetName = sourceName;
      for (let index = 2; archiveNames.has(targetName); index += 1) {
        targetName = `${baseName} (${index})${extension}`;
      }
      await copyFile(sourcePath, path.join(archiveRoot, targetName));
      archiveRelativePath = targetName;
    }
    const attachment = {
      id: createId(),
      applicationId,
      category,
      fileName: archiveRelativePath,
      archiveRelativePath,
      description: "",
      documentDate: "",
      order: application.attachmentIds.length,
      includedInPackage: true,
      createdAt: nowIso(),
    };
    this.workspace.attachments.push(attachment);
    application.attachmentIds.push(attachment.id);
    await this.persist([application]);
    this.queueApplicationGitCommit(application, "update");
    return this.getWorkspace();
  }

  private getAttachmentPath(attachment: Attachment) {
    if (attachment.archiveRelativePath) {
      return this.files.resolveArchivePath(
        attachment.category,
        attachment.archiveRelativePath,
      );
    }
    if (!attachment.storedName) {
      throw new Error("Der Dokumentverweis ist unvollständig.");
    }
    const application = this.getApplication(attachment.applicationId);
    if (path.basename(attachment.storedName) !== attachment.storedName)
      throw new Error("Ungültiger gespeicherter Dateiname.");
    const categoryRoot = path.resolve(
      this.applicationPath(application),
      attachment.category,
    );
    const filePath = path.resolve(categoryRoot, attachment.storedName);
    if (!filePath.startsWith(`${categoryRoot}${path.sep}`))
      throw new Error("Ungültiger Dokumentpfad.");
    return filePath;
  }

  getAttachmentPathById(id: string) {
    const attachment = this.workspace.attachments.find((item) => item.id === id);
    if (!attachment) throw new Error("Dokument wurde nicht gefunden.");
    return this.getAttachmentPath(attachment);
  }

  async saveAttachment(rawAttachment: Attachment) {
    const attachment = attachmentSchema.parse(rawAttachment);
    const index = this.workspace.attachments.findIndex(
      (item) => item.id === attachment.id,
    );
    if (index < 0) throw new Error("Dokument wurde nicht gefunden.");
    const existing = this.workspace.attachments[index];
    if (existing.applicationId !== attachment.applicationId)
      throw new Error("Die Zuordnung einer Datei kann nicht frei geändert werden.");
    if (existing.category !== attachment.category) {
      if (existing.archiveRelativePath) {
        throw new Error(
          "Die Kategorie eines Archivdokuments kann nicht nachträglich geändert werden.",
        );
      }
      const oldPath = this.getAttachmentPath(existing);
      const newPath = this.getAttachmentPath(attachment);
      await mkdir(path.dirname(newPath), { recursive: true });
      await rename(oldPath, newPath);
    }
    this.workspace.attachments[index] = attachment;
    await this.persist();
    this.queueGitCommit(attachment.applicationId, "update");
    return this.getWorkspace();
  }

  async moveAttachment(id: string, direction: -1 | 1) {
    const attachment = this.workspace.attachments.find((item) => item.id === id);
    if (!attachment) throw new Error("Dokument wurde nicht gefunden.");
    const siblings = this.workspace.attachments
      .filter(
        (item) =>
          item.applicationId === attachment.applicationId &&
          item.category === attachment.category,
      )
      .sort((left, right) => left.order - right.order);
    const index = siblings.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length)
      return this.getWorkspace();
    const other = siblings[target];
    const currentOrder = attachment.order;
    attachment.order = other.order;
    other.order = currentOrder;
    await this.persist();
    this.queueGitCommit(attachment.applicationId, "update");
    return this.getWorkspace();
  }

  async removeAttachment(id: string) {
    const attachment = this.workspace.attachments.find((item) => item.id === id);
    if (!attachment) throw new Error("Dokument wurde nicht gefunden.");
    if (!attachment.archiveRelativePath) {
      await rm(this.getAttachmentPath(attachment), { force: true });
    }
    this.workspace.attachments = this.workspace.attachments.filter(
      (item) => item.id !== id,
    );
    const application = this.getApplication(attachment.applicationId);
    application.attachmentIds = application.attachmentIds.filter(
      (attachmentId) => attachmentId !== id,
    );
    await this.persist([application]);
    this.queueApplicationGitCommit(application, "update");
    return this.getWorkspace();
  }

  getPackageAttachmentPaths(applicationId: string) {
    const categoryOrder: Record<AttachmentCategory, number> = {
      Zeugnisse: 0,
      Zertifikate: 1,
    };
    return this.workspace.attachments
      .filter(
        (attachment) =>
          attachment.applicationId === applicationId &&
          attachment.includedInPackage,
      )
      .sort(
        (left, right) =>
          categoryOrder[left.category] - categoryOrder[right.category] ||
          left.order - right.order,
      )
      .map((attachment) => ({
        fileName: attachment.fileName,
        path: this.getAttachmentPath(attachment),
      }));
  }

  private applicantDocumentNames(application: Application) {
    const profile = this.getProfileForApplication(application);
    const applicantName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
    return {
      anschreiben: applicantDocumentFileName("Anschreiben", application, applicantName),
      deckblatt: applicantDocumentFileName("Deckblatt", application, applicantName),
      lebenslauf: applicantDocumentFileName("Lebenslauf", application, applicantName),
      mappe: applicantDocumentFileName("Mappe", application, applicantName),
    };
  }

  getProfileForApplication(application: Pick<Application, "profileId">) {
    return resolveApplicationProfile(this.workspace.profiles, application.profileId);
  }

  getApplication(id: string) {
    const application = this.workspace.applications.find((item) => item.id === id);
    if (!application) throw new Error("Bewerbung wurde nicht gefunden.");
    return application;
  }

  getTemplateDocumentContext(id: string) {
    const application = this.getApplication(id);
    const profile = this.getProfileForApplication(application);
    const applicantName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : "";
    const postalContactName = applicationPostalContactLines(application).join(
      "\n",
    );
    const greeting = applicationGreeting(application);
    const knowledgeSection = ensureKnowledgeSection(
      profile?.knowledgeSection,
      profile?.skills ?? [],
    );
    const knowledgeText = formatKnowledgeSectionAsText(
      knowledgeSection,
      false,
    );
    const flexibleKnowledgeBlocks = resolveKnowledgeGroups(
      application.templateId,
      profile?.resumeKnowledgeGroups,
    )
      .filter((group) => group.visible)
      .map((group) => ({
        title: group.title,
        slot: group.slot,
        rendererType: group.rendererType,
        items: group.items
          .filter((item) => item.visible && item.text.trim())
          .map((item) => item.description
            ? `${item.text} – ${item.description}`
            : item.text),
      }))
      .filter((group) => group.items.length);
    const flexibleKnowledgeText = flexibleKnowledgeBlocks
      .map((group) => `${group.title}\n${group.items.join("\n")}`)
      .join("\n\n");
    const deckblattContacts = getDeckblattContacts(
      profile,
      application.documents.coverSheetContactVisibility,
    );
    const deckblattCompetencies = getDeckblattCompetencies(profile, application);
    // The Kurzprofil of the Lebenslauf (the Bewerbung's own text, else the profile's): the same text the PDF shows.
    const resumeSummary = resolveResumeSummary(profile, application.documents.resumeProfile);
    const deckblattDocuments = getDeckblattDocuments(
      this.workspace.attachments,
      application.id,
      application.documents.documentListSettings,
    );
    const strengthItems = profile?.strengths.length
      ? profile.strengths
      : (profile?.skills ?? []).map((value) => {
          const [title, ...description] = value.split(/\s+(?:–|—|:)\s+/);
          return {
            id: "",
            title: title.trim(),
            description: description.join(" – ").trim(),
          };
        });
    const extraOnlineProfiles = (profile?.onlineProfiles ?? [])
      .filter((entry) => entry.url)
      .map((entry) => joinTemplateValues([entry.label, entry.url], ": "));
    const projectsText = specialSectionContent(profile, ["projects"]);
    const trainingsText = specialSectionContent(profile, ["trainings"]);
    const publicationsText = specialSectionContent(profile, ["publications"]);
    const volunteerText = specialSectionContent(profile, ["volunteer"]);
    const drivingLicensesText = specialSectionContent(profile, [
      "drivingLicenses",
    ]);
    const interestsText = specialSectionContent(profile, ["interests"]);
    const cvClosing = profile ? resolveResumeClosingLine(profile, formatApplicationDate(application)) : { place: "", date: "", text: "" };
    const additionalText = [
      specialSectionContent(profile, [
        "internships",
        "internationalExperience",
        "scholarships",
        "awards",
        "additional",
        "references",
        "custom",
      ]),
      profile?.nationality
        ? `Staatsangehörigkeit: ${profile.nationality}`
        : "",
      profile?.familyStatus ? `Familienstand: ${profile.familyStatus}` : "",
      profile?.children ? `Kinder: ${profile.children}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const elegantData: Record<string, string> = {
      VORNAME: profile?.firstName ?? "",
      NACHNAME: profile?.lastName ?? "",
      BERUFSBEZEICHNUNG: getProfessionalTitle(profile),
      FACHGEBIET_1: profile?.skills[0] ?? "",
      FACHGEBIET_2: profile?.skills[1] ?? "",
      FACHGEBIETE: (profile?.skills ?? []).slice(0, 3).join(" | "),
      TELEFON: profile?.phone ?? "",
      EMAIL: profile?.email ?? "",
      WEBSITE:
        profile?.portfolio || profile?.github || extraOnlineProfiles[0] || "",
      GITHUB: profile?.github ?? "",
      LINKEDIN: profile?.linkedin ?? "",
      ORT: profile?.city ?? "",
      GEBURTSDATUM: profile?.birthDate ?? "",
      GEBURTSORT: profile?.birthPlace ?? "",
      GEBURTSZEILE:
        profile?.birthDate || profile?.birthPlace
          ? `Geb. ${profile?.birthDate ?? ""}${
              profile?.birthDate && profile?.birthPlace ? " in " : ""
            }${profile?.birthPlace ?? ""}`
          : "",
      KONTAKT_ZEILE_1: joinTemplateValues([
        profile?.phone,
        profile?.email,
      ]),
      KONTAKT_ZEILE_2: joinTemplateValues([
        profile?.portfolio || profile?.github,
        profile?.linkedin,
        ...extraOnlineProfiles,
      ]),
      KONTAKT_ZEILE_3: joinTemplateValues([
        profile?.city,
        profile?.birthDate,
        profile?.birthPlace,
      ]),
      KONTAKTE_TITEL:
        profile?.phone ||
        profile?.email ||
        profile?.portfolio ||
        profile?.github ||
        profile?.linkedin ||
        extraOnlineProfiles.length ||
        profile?.city
          ? "KONTAKTE"
          : "",
      KONTAKTDATEN_TITEL:
        profile?.phone ||
        profile?.email ||
        profile?.portfolio ||
        profile?.github ||
        profile?.linkedin ||
        extraOnlineProfiles.length ||
        profile?.city ||
        profile?.birthDate ||
        profile?.birthPlace
          ? "KONTAKTDATEN"
          : "",
      TELEFON_ZEILE: templateContactLine("Telefon", profile?.phone),
      EMAIL_ZEILE: templateContactLine("E-Mail", profile?.email),
      WEBSITE_ZEILE: templateContactLine(
        "Website",
        profile?.portfolio || profile?.github,
      ),
      LINKEDIN_ZEILE: templateContactLine(
        "LinkedIn",
        profile?.linkedin,
      ),
      ORT_ZEILE: templateContactLine("Ort", profile?.city),
      HEADER_KONTAKT_1: profile?.phone ?? "",
      HEADER_KONTAKT_2: profile?.email ?? "",
      HEADER_KONTAKT_3: profile?.linkedin ?? "",
      HEADER_KONTAKT_4: joinTemplateValues([
        profile?.city,
        profile?.country,
      ]),
      HEADER_KONTAKT_5:
        profile?.birthDate || profile?.birthPlace
          ? `Geb. ${profile?.birthDate ?? ""}${
              profile?.birthDate && profile?.birthPlace ? " in " : ""
            }${profile?.birthPlace ?? ""}`
          : "",
      HEADER_KONTAKT_6:
        profile?.portfolio || profile?.github || extraOnlineProfiles[0] || "",
      PROFILFOTO: profile?.photoPath ?? "",
      DECKBLATT_STANDORT: application.company.city,
      DECKBLATT_KURZPROFIL:
        application.documents.deckblattStatement || "",
      DECKBLATT_DOKUMENTE: deckblattDocuments.join("\n"),
      DECKBLATT_KOMPETENZEN: deckblattCompetencies.join("\n"),
      DECKBLATT_KONTAKT: deckblattContacts
        .map((contact) => `${contact.label}: ${contact.value}`)
        .join("\n"),
      ZUSAMMENFASSUNG_TITEL: resumeSummary
        ? getResumeSectionTitle(profile, "summary").toLocaleUpperCase("de-DE")
        : "",
      ZUSAMMENFASSUNG: resumeSummary,
      STAERKEN_TITEL:
        profile && (profile.strengths.length || profile.skills.length)
          ? getResumeSectionTitle(profile, "strengths").toLocaleUpperCase("de-DE")
          : "",
      STAERKEN_ATS: strengthItems
        .slice(0, 3)
        .map((strength) =>
          joinTemplateValues([strength.title, strength.description], " – "),
        )
        .join("\n"),
      ERFOLGE_TITEL: "",
      ERFOLGE_ATS: "",
      ERFOLG_HIGHLIGHT_1_TITEL: "",
      ERFOLG_HIGHLIGHT_1_BESCHREIBUNG: "",
      ERFOLG_HIGHLIGHT_2_TITEL: "",
      ERFOLG_HIGHLIGHT_2_BESCHREIBUNG: "",
      KENNTNISSE_TITEL: knowledgeText
        ? getResumeSectionTitle(profile, "knowledge").toLocaleUpperCase("de-DE")
        : "",
      KENNTNISSE: knowledgeText,
      BESONDERE_KENNTNISSE_BAUSTEINE: flexibleKnowledgeText,
      BESONDERE_KENNTNISSE_BAUSTEINE_JSON: JSON.stringify(flexibleKnowledgeBlocks),
      SPRACHEN_TITEL: profile?.languages.length
        ? getResumeSectionTitle(profile, "languages").toLocaleUpperCase("de-DE")
        : "",
      SPRACHEN_ATS: (profile?.languages ?? []).map(formatLanguageForAts).join("\n"),
      BERUFSERFAHRUNG_TITEL: profile?.experiences.length
        ? getResumeSectionTitle(profile, "experience").toLocaleUpperCase("de-DE")
        : "",
      ERFAHRUNG_TITEL: profile?.experiences.length
        ? getResumeSectionTitle(profile, "experience").toLocaleUpperCase("de-DE")
        : "",
      AUSBILDUNG_TITEL: profile?.education.length
        ? getResumeSectionTitle(profile, "education").toLocaleUpperCase("de-DE")
        : "",
      PROJEKTE_TITEL: specialSectionTitle(profile, ["projects"], "PROJEKTE"),
      PROJEKTE: projectsText,
      WEITERBILDUNGEN_TITEL: specialSectionTitle(
        profile,
        ["trainings"],
        "WEITERBILDUNGEN",
      ),
      WEITERBILDUNGEN: trainingsText,
      ZERTIFIKATE_TITEL: profile?.certifications.length
        ? getResumeSectionTitle(profile, "certifications").toLocaleUpperCase("de-DE")
        : "",
      ZERTIFIKATE: (profile?.certifications ?? []).join("\n"),
      VEROEFFENTLICHUNGEN_TITEL: specialSectionTitle(
        profile,
        ["publications"],
        "VERÖFFENTLICHUNGEN",
      ),
      VEROEFFENTLICHUNGEN: publicationsText,
      EHRENAMT_TITEL: specialSectionTitle(
        profile,
        ["volunteer"],
        "EHRENAMT",
      ),
      EHRENAMT: volunteerText,
      SOFTWARE_TITEL: "",
      SOFTWARE: "",
      ZUSATZANGABEN_TITEL: additionalText ? "ZUSATZANGABEN" : "",
      ZUSATZANGABEN: additionalText,
      FUEHRERSCHEIN_TITEL: specialSectionTitle(
        profile,
        ["drivingLicenses"],
        "FÜHRERSCHEIN",
      ),
      FUEHRERSCHEIN: drivingLicensesText,
      INTERESSEN_TITEL: specialSectionTitle(
        profile,
        ["interests"],
        "INTERESSEN",
      ),
      INTERESSEN: interestsText,
      LEBENSLAUF_ORT: cvClosing.place,
      LEBENSLAUF_DATUM: cvClosing.date,
      LEBENSLAUF_UNTERSCHRIFT: profile?.resumeClosing.showSignature ? profile.signaturePath : "",
      DESIGN_PRIMARY: application.accentColor,
      DESIGN_ACCENT: application.secondaryColor,
      DESIGN_SOFT_ACCENT: blendHexColor(
        application.accentColor,
        "#ffffff",
        0.78,
      ),
      DESIGN_TITLE_BACKGROUND: blendHexColor(
        application.accentColor,
        "#ffffff",
        0.62,
      ),
      DESIGN_FONT: wordFontName(application.designSettings.fontId),
      DESIGN_MARGIN_VERTICAL_MM: String(
        compactWordMarginLevelToMm[
          application.designSettings.marginLevel
        ].vertical,
      ),
      DESIGN_MARGIN_HORIZONTAL_MM: String(
        compactWordMarginLevelToMm[
          application.designSettings.marginLevel
        ].horizontal,
      ),
      DEKORATION_AKTIV: application.designSettings.showBackgroundInPrint
        ? "true"
        : "false",
      ATS_MODUS:
        application.designSettings.columnLayout === "compact-ats"
          ? "true"
          : "",
    };
    const lastExperienceIndex = Math.min(
      (profile?.experiences.length ?? 0) - 1,
      7,
    );
    for (let index = 0; index < 8; index += 1) {
      const number = index + 1;
      const experience = profile?.experiences[index];
      // The same resolved station as the Lebenslauf: one date format, the legal form without doubling, "heute".
      const resolved = experience ? resolveExperience(experience) : undefined;
      const full = experience && !experience.compact ? experience : undefined;
      elegantData[`POSITION_${number}`] = resolved?.role ?? "";
      elegantData[`UNTERNEHMEN_${number}`] = resolved?.organization ?? "";
      elegantData[`STARTDATUM_${number}`] = resolved?.from ?? "";
      elegantData[`DATUM_TRENNER_${number}`] =
        resolved?.from && resolved.to ? " – " : "";
      elegantData[`ENDDATUM_${number}`] = resolved?.to ?? "";
      elegantData[`ARBEITSORT_${number}`] = experience?.city ?? "";
      elegantData[`BESCHREIBUNG_${number}`] = joinTemplateValues(
        [
          experience?.employmentType,
          full?.teamSize ? `Team/Verantwortung: ${full.teamSize}` : "",
          full?.description,
        ],
        "\n",
      );
      elegantData[`METADATA_TRENNER_${number}`] =
        (resolved?.from || resolved?.to) && experience?.city
          ? "·"
          : "";
      elegantData[`TECHNOLOGIEN_${number}`] =
        full?.technologies.join(" · ") ?? "";
      elegantData[`ERFAHRUNG_TRENNER_${number}`] =
        experience && index < lastExperienceIndex ? "\u200B" : "";
      const experienceDetails = full
        ? [
            ...full.tasks,
            ...full.projects.map((item) => `Projekt: ${item}`),
            ...full.achievements,
          ].filter(Boolean)
        : [];
      for (let achievementIndex = 0; achievementIndex < 5; achievementIndex += 1) {
        elegantData[`ERFOLG_${number}_${achievementIndex + 1}`] =
          experienceDetails[achievementIndex] ?? "";
      }
    }
    for (let index = 0; index < 3; index += 1) {
      const number = index + 1;
      const education = profile?.education[index];
      const educationView = education ? resolveEducationPresentation(education) : undefined;
      elegantData[`ABSCHLUSS_${number}`] =
        educationView?.title ?? "";
      elegantData[`FACHRICHTUNG_${number}`] = educationView?.details.join(" · ") ?? "";
      elegantData[`HOCHSCHULE_${number}`] =
        educationView?.institution ?? "";
      elegantData[`AUSBILDUNG_START_${number}`] =
        educationView?.from ?? "";
      elegantData[`AUSBILDUNG_DATUM_TRENNER_${number}`] =
        educationView?.from && educationView.to ? " – " : "";
      elegantData[`AUSBILDUNG_ENDE_${number}`] = educationView?.to ?? "";
      elegantData[`AUSBILDUNG_ORT_${number}`] = educationView?.location ?? "";
      elegantData[`AUSBILDUNG_METADATA_TRENNER_${number}`] =
        (educationView?.from || educationView?.to) && educationView?.location
          ? "·"
          : "";

      const strength = strengthItems[index];
      elegantData[`STAERKE_${number}_TITEL`] = strength?.title ?? "";
      elegantData[`STAERKE_${number}_BESCHREIBUNG`] =
        strength?.description ?? "";

      const language = splitLanguage(formatLanguageForAts(profile?.languages[index] ?? ""));
      elegantData[`SPRACHE_${number}`] = language.name;
      elegantData[`SPRACHNIVEAU_${number}`] = "";
      elegantData[`SPRACHE_${number}_PUNKTE`] = languagePoints(
        language.level,
      );
    }
    knowledgeSection.categories
      .filter((category) => category.isVisible)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .slice(0, 6)
      .forEach((category, index) => {
        const entries = [
          ...category.items
            .filter((item) => item.isVisible && item.name.trim())
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((item) => item.name),
          ...category.subcategories
            .filter((subcategory) => subcategory.isVisible)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .flatMap((subcategory) =>
              subcategory.items
                .filter((item) => item.isVisible && item.name.trim())
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((item) => item.name),
            ),
        ];
        elegantData[`KENNTNIS_KATEGORIE_${index + 1}`] =
          entries.length ? category.title : "";
        elegantData[`KENNTNIS_EINTRAEGE_${index + 1}`] =
          entries.join(" · ");
      });
    const templateData: Record<string, string> = {
      BEWERBER_NAME: applicantName,
      BEWERBER_VORNAME: profile?.firstName ?? "",
      BEWERBER_NACHNAME: profile?.lastName ?? "",
      BEWERBER_ADRESSE: profile?.street ?? "",
      BEWERBER_PLZ: profile?.postalCode ?? "",
      BEWERBER_ORT: profile?.city ?? "",
      BEWERBER_TELEFON: profile?.phone ?? "",
      BEWERBER_EMAIL: profile?.email ?? "",
      BEWERBER_WEBSITE: profile?.portfolio ?? "",
      FIRMA_NAME: application.company.name,
      FIRMA_ADRESSE: application.company.street,
      FIRMA_PLZ: application.company.postalCode,
      FIRMA_ORT: application.company.city,
      ANSPRECHPARTNER: postalContactName,
      FIRMA_ABTEILUNG: applicationContactDepartmentLines(application).join("\n"),
      STELLENBEZEICHNUNG: application.job.title,
      STELLENNUMMER: application.job.reference,
      BEWERBUNGSDATUM: formatApplicationDate(application),
      BEWERBUNGSDATUM_LANG: formatApplicationDateLong(application),
      BETREFF: createCoverSubject(
        application.job.title,
        application.documents.coverSubject,
      ),
      ANREDE: application.documents.coverGreeting || greeting,
      EINLEITUNG: application.documents.coverIntroduction,
      MOTIVATION: "",
      FACHLICHE_EIGNUNG: getCoverLetterMainBody(application.documents),
      UNTERNEHMENSBEZUG: application.documents.coverCompanyFit,
      ZUSATZABSATZ: application.documents.coverExtraParagraph,
      HAUPTTEXT: getCoverLetterMainBody(application.documents),
      SCHLUSSTEXT: application.documents.coverClosing,
      GRUSSFORMEL: "Mit freundlichen Grüßen",
      UNTERSCHRIFT: applicantName,
      UNTERSCHRIFT_GRAFIK: profile?.signaturePath ?? "",
      ANLAGENHINWEIS: application.documents.showCoverLetterAttachments
        ? [
            "Anlagen:",
            ...getCoverLetterAttachments(
              this.workspace.attachments,
              application.id,
              application.documents.documentListSettings,
            ),
          ].join("\n")
        : "",
      KENNTNISSE: knowledgeText,
      ...elegantData,
    };
    const documentDirectories = this.files.documentDirectories(application);
    const documentName = (
      kind: "Anschreiben" | "Deckblatt" | "Lebenslauf" | "Mappe",
    ) => applicantDocumentFileName(kind, application, applicantName);
    return {
      application,
      targetDirectories: {
        anschreiben: documentDirectories.anschreiben,
        deckblatt: documentDirectories.deckblatt,
        lebenslauf: documentDirectories.lebenslauf,
      },
      requestedBaseName: coverLetterApplicantFileName(
        application,
        applicantName,
      ),
      requestedBaseNames: {
        anschreiben: documentName("Anschreiben"),
        deckblatt: documentName("Deckblatt"),
        lebenslauf: documentName("Lebenslauf"),
      },
      data: templateData,
    };
  }

  getExportHtml(
    id: string,
    target: "deckblatt" | "anschreiben" | "lebenslauf" | "mappe",
    applicationSnapshot?: Application,
  ) {
    const application = applicationSnapshot
      ? applicationSchema.parse(applicationSnapshot)
      : this.getApplication(id);
    if (application.id !== id) {
      throw new Error(
        "Die Exportdaten gehören nicht zur ausgewählten Bewerbung.",
      );
    }
    return buildDocumentHtml(
      application,
      this.getProfileForApplication(application),
      target,
      this.workspace.attachments,
      this.workspace.settings.resumeDesign,
    );
  }

  getExportDefaultName(id: string, target: string) {
    const application = this.getApplication(id);
    const profile = this.getProfileForApplication(application);
    const applicantName = [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(" ");
    const kind = {
      anschreiben: "Anschreiben",
      deckblatt: "Deckblatt",
      lebenslauf: "Lebenslauf",
      mappe: "Mappe",
    }[target] as "Anschreiben" | "Deckblatt" | "Lebenslauf" | "Mappe" | undefined;
    if (!kind) throw new Error("Ungültiges Exportziel.");
    return `${applicantDocumentFileName(kind, application, applicantName)}.pdf`;
  }

  async saveTodo(todo: Todo) {
    const parsed = todoSchema.parse(todo);
    const index = this.workspace.todos.findIndex((item) => item.id === parsed.id);
    const current = index < 0 ? undefined : this.workspace.todos[index];
    // The link to an application is only ever set by the deadline sync. A todo that belongs to a Bewerbung keeps its
    // link, title and due date (they come from the application); the user owns its note, priority and completion.
    // Every other todo, and every new one, is manual.
    const { applicationId: _link, source: _source, ...fields } = parsed;
    const validated: Todo =
      current && isApplicationTodo(current)
        ? {
            ...fields,
            title: current.title,
            dueDate: current.dueDate,
            source: current.source,
            applicationId: current.applicationId,
          }
        : { ...fields, source: "manual" };
    if (index < 0) this.workspace.todos.unshift(validated);
    else this.workspace.todos[index] = validated;
    await this.persist();
    return this.getWorkspace();
  }

  async removeTodo(id: string) {
    this.workspace.todos = this.workspace.todos.filter((item) => item.id !== id);
    await this.persist();
    return this.getWorkspace();
  }

  async saveCustomCvDesign(design: CustomCvDesign) {
    const validated = customCvDesignSchema.parse(design);
    const index = this.workspace.customCvDesigns.findIndex((item) => item.id === validated.id);
    if (index < 0) this.workspace.customCvDesigns.unshift(validated);
    else this.workspace.customCvDesigns[index] = validated;
    await this.persist();
    return this.getWorkspace();
  }

  async removeCustomCvDesign(id: string) {
    this.workspace.customCvDesigns = this.workspace.customCvDesigns.filter((item) => item.id !== id);
    await this.persist();
    return this.getWorkspace();
  }

  getAutomaticExportPath(id: string, target: "deckblatt" | "anschreiben" | "lebenslauf" | "mappe") {
    const application = this.getApplication(id);
    const directories = this.files.documentDirectories(application);
    const directory =
      target === "mappe" ? directories.bewerbungsunterlagen : directories[target];
    return path.join(directory, this.getExportDefaultName(id, target));
  }

  async writeBackup(filePath: string) {
    const content = JSON.stringify(workspaceSchema.parse(this.workspace), null, 2);
    await writeFile(
      filePath,
      activeEncryption()?.encryptWorkspace(content) ?? content,
      "utf8",
    );
  }

  previewLegacyMigration(sourcePath: string) {
    return this.migration.preview(sourcePath);
  }

  async migrateLegacyData(sourcePath: string) {
    const hasUserData =
      this.workspace.applications.length > 0 ||
      this.workspace.profiles.length > 0 ||
      this.workspace.events.length > 0 ||
      this.workspace.attachments.length > 0;
    if (hasUserData) {
      throw new Error(
        "Eine Migration ist nur möglich, solange der neue Datenbestand leer ist.",
      );
    }
    const emergencyPath = path.join(
      this.files.paths.backupsRoot,
      `vor-migration-${timestamp()}-${createId()}.json`,
    );
    await copyFile(this.workspacePath, emergencyPath);
    const preview = await this.migration.preview(sourcePath);
    const previous = this.workspace;
    try {
      this.workspace = migrateLegacyResumeProfiles(await this.migration.migrate(sourcePath));
      await this.persist(this.workspace.applications);
      await this.files.archiveUnmatchedLegacyDocumentDirectories();
      await this.atomicWrite(
        path.join(
          this.files.paths.backupsRoot,
          `migration-${timestamp()}-${createId()}.json`,
        ),
        JSON.stringify(
          {
            migratedAt: nowIso(),
            sourcePath: preview.sourcePath,
            targetPath: this.dataPath,
            fileCount: preview.fileCount,
            totalBytes: preview.totalBytes,
            applications: preview.applications,
            attachments: preview.attachments,
            sourceFilesDeleted: false,
          },
          null,
          2,
        ),
      );
      return this.getWorkspace();
    } catch (error) {
      this.workspace = previous;
      throw error;
    }
  }

  async importBackup(filePath: string) {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    const envelope = parseEncryptedWorkspace(parsed);
    const imported = workspaceSchema.parse(envelope
      ? JSON.parse(activeEncryption()?.decryptWorkspace(envelope) ?? "null")
      : parsed);
    const emergencyPath = path.join(
      this.files.paths.backupsRoot,
      `vor-import-${timestamp()}.json`,
    );
    await copyFile(this.workspacePath, emergencyPath);
    const previous = this.workspace;
    try {
      this.workspace = migrateLegacyResumeProfiles(imported);
      const availableAttachments = [];
      for (const attachment of this.workspace.attachments) {
        try {
          await stat(this.getAttachmentPath(attachment));
          availableAttachments.push(attachment);
        } catch {
          // A JSON backup cannot recreate a missing binary attachment.
        }
      }
      this.workspace.attachments = availableAttachments;
      const availableIds = new Set(
        availableAttachments.map((attachment) => attachment.id),
      );
      this.workspace.applications.forEach((application) => {
        application.attachmentIds = application.attachmentIds.filter((id) =>
          availableIds.has(id),
        );
      });
      this.reconcileApplicationTodos();
      await this.persist(this.workspace.applications);
      return this.getWorkspace();
    } catch (error) {
      this.workspace = previous;
      try {
        await this.persist();
      } catch {
        // Preserve and report the original import error.
      }
      throw error;
    }
  }

  async writeSettings(filePath: string) {
    await writeFile(
      filePath,
      JSON.stringify(appSettingsSchema.parse(this.workspace.settings), null, 2),
      "utf8",
    );
  }

  async importSettings(filePath: string) {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    this.workspace.settings = appSettingsSchema.parse(parsed);
    this.workspace.applications.forEach((application) =>
      this.syncEvents(application),
    );
    await this.persist();
    return this.getWorkspace();
  }

  getTemplateIds() {
    return new Set(templates.map((template) => template.id));
  }
}
