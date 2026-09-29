import { randomUUID } from "node:crypto";
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
} from "node:fs/promises";
import path from "node:path";
import type { Application, ApplicationStatus } from "../src/shared/schema";
import type { ApplicationPaths } from "../src/config/application-paths";
import {
  formatApplicationDate,
  getApplicationDate,
} from "../src/shared/applicationDate";

const reservedWindowsNames =
  /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

export const sanitizeFileName = (value: string) => {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 80);
  if (!sanitized) return "Bewerbung";
  return reservedWindowsNames.test(sanitized) ? `_${sanitized}` : sanitized;
};

export const applicationPositionFolder = (positionName: string) => {
  const normalizedPosition = positionName
    .trim()
    .replace(/^Bewerbung\s+als\s+/i, "");
  return `Bewerbung_als_${sanitizeFileName(normalizedPosition)}`;
};

export const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isPathInside = (root: string, candidate: string) => {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return (
    resolvedCandidate === resolvedRoot ||
    resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
  );
};

const pathExists = async (candidate: string) => {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
};

export const applicationFolderLockedMessage =
  "Bitte schließen Sie alle geöffneten Word-, PDF- oder sonstigen Dateien dieser Bewerbung und speichern Sie den Bereich „Termine“ anschließend erneut.";

export class ApplicationFolderLockedError extends Error {
  readonly code = "APPLICATION_FOLDER_LOCKED";

  constructor() {
    super(applicationFolderLockedMessage);
    this.name = "ApplicationFolderLockedError";
  }
}

export const isApplicationFolderLockError = (error: unknown) => {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return ["EACCES", "EBUSY", "EPERM"].includes(String(error.code));
};

type DocumentDirectories = {
  anschreiben: string;
  lebenslauf: string;
  deckblatt: string;
  email: string;
  stellenanzeige: string;
  bewerbungsunterlagen: string;
  backup: string;
};

export type ApplicationDocumentNameKind =
  | "anschreiben"
  | "deckblatt"
  | "lebenslauf"
  | "mappe";

export const applicationFileBaseName = (
  application: Pick<Application, "company" | "createdAt" | "sentAt">,
) =>
  `${sanitizeFileName(application.company.name)}_${formatApplicationDate(application)}`;

export class FileManagementService {
  constructor(readonly paths: ApplicationPaths) {}

  private async withRenameRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (attempt >= 2 || !isApplicationFolderLockError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }

  private async verifiedCopy(source: string, target: string) {
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
    const [sourceContents, targetContents] = await Promise.all([
      readFile(source),
      readFile(target),
    ]);
    if (!sourceContents.equals(targetContents)) {
      throw new Error(`Kopierprüfung fehlgeschlagen: ${source}`);
    }
  }

  private async availableMigrationConflictPath(label: string, relative: string) {
    const parsed = path.parse(relative);
    const base = path.join(
      this.paths.backupsRoot,
      "Migrationskonflikte",
      sanitizeFileName(label),
      parsed.dir,
    );
    await mkdir(base, { recursive: true });
    for (let index = 1; ; index += 1) {
      const suffix = index === 1 ? "" : `_${index}`;
      const candidate = path.join(base, `${parsed.name}${suffix}${parsed.ext}`);
      if (!(await pathExists(candidate))) return candidate;
    }
  }

  private async migrateDirectory(
    sourceRoot: string,
    targetRoot: string,
    label: string,
  ) {
    if (
      path.resolve(sourceRoot) === path.resolve(targetRoot) ||
      !(await pathExists(sourceRoot))
    ) {
      return;
    }

    const files: Array<{ source: string; relative: string }> = [];
    const directories: string[] = [];
    const collect = async (directory: string) => {
      const sourceInfo = await lstat(directory);
      if (sourceInfo.isSymbolicLink()) {
        throw new Error(`Symbolische Verknüpfungen werden nicht migriert: ${directory}`);
      }
      directories.push(directory);
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        const source = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) {
          throw new Error(`Symbolische Verknüpfungen werden nicht migriert: ${source}`);
        }
        if (entry.isDirectory()) {
          await collect(source);
        } else if (entry.isFile()) {
          files.push({ source, relative: path.relative(sourceRoot, source) });
        }
      }
    };
    await collect(sourceRoot);

    for (const file of files) {
      const target = path.join(targetRoot, file.relative);
      if (await pathExists(target)) {
        const [sourceContents, targetContents] = await Promise.all([
          readFile(file.source),
          readFile(target),
        ]);
        if (!sourceContents.equals(targetContents)) {
          const conflict = await this.availableMigrationConflictPath(
            label,
            file.relative,
          );
          await this.verifiedCopy(file.source, conflict);
        }
      } else {
        await this.verifiedCopy(file.source, target);
      }
      await rm(file.source);
    }

    for (const directory of directories.reverse()) {
      try {
        await rmdir(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") throw error;
      }
    }
  }

  private async migrateWorkspaceLayout() {
    await mkdir(this.paths.backupsRoot, { recursive: true });
    const settingFolders: Array<[string, string]> = [
      ["Backups", this.paths.backupsRoot],
      ["cache", path.join(this.paths.settingRoot, "cache")],
      ["CrashDumps", this.paths.crashDumpsRoot],
      ["ElectronSession", this.paths.electronSessionRoot],
      ["Logs", this.paths.logsRoot],
      ["Muster", this.paths.musterRoot],
      ["Profile", this.paths.profileRoot],
      ["Settings", this.paths.settingsRoot],
    ];
    for (const [name, target] of settingFolders) {
      await this.migrateDirectory(
        path.join(this.paths.dataRoot, name),
        target,
        `Setting_${name}`,
      );
    }

    for (const name of [
      "Zeugnisse",
      "Zertifikate",
      "Vorstellungsgespräch",
      "Absagen",
    ]) {
      await this.migrateDirectory(
        path.join(this.paths.root, name),
        path.join(this.paths.dataRoot, name),
        name,
      );
    }
    for (const name of ["Anschreiben", "Lebenslauf"]) {
      await this.migrateDirectory(
        path.join(this.paths.root, name),
        path.join(this.paths.dataRoot, name),
        `Legacy_${name}`,
      );
    }
    await this.migrateDirectory(
      path.join(this.paths.root, "Muster"),
      this.paths.musterRoot,
      "Muster",
    );
  }

  async archiveUnmatchedLegacyDocumentDirectories() {
    for (const [source, name] of [
      [this.paths.anschreibenDocuments, "Anschreiben"],
      [this.paths.lebenslaufDocuments, "Lebenslauf"],
    ] as const) {
      await this.migrateDirectory(
        source,
        path.join(this.paths.backupsRoot, "Legacy", name),
        `Legacy_Archiv_${name}`,
      );
    }
  }

  async initialize() {
    await this.migrateWorkspaceLayout();
    const directories = [
      this.paths.root,
      this.paths.dataRoot,
      this.paths.applicationsData,
      this.paths.zeugnisseArchive,
      this.paths.zertifikateArchive,
      this.paths.absagenRoot,
      this.paths.interviewsRoot,
      this.paths.anschreibenTemplates,
      this.paths.deckblattTemplates,
      this.paths.lebenslaufTemplates,
      this.paths.previewCache,
      this.paths.systemTemplateCache,
      this.paths.settingRoot,
      this.paths.profileRoot,
      this.paths.settingsRoot,
      this.paths.backupsRoot,
      this.paths.logsRoot,
      this.paths.crashDumpsRoot,
      this.paths.electronSessionRoot,
      this.paths.deletedRoot,
    ];
    await Promise.all(
      directories.map((directory) => mkdir(directory, { recursive: true })),
    );
    for (const obsoleteName of [
      "Absagen",
      "Anschreiben",
      "Lebenslauf",
      "Vorstellungsgespräch",
      "Zertifikate",
      "Zeugnisse",
    ]) {
      try {
        await rmdir(path.join(this.paths.applicationsData, obsoleteName));
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!["ENOENT", "ENOTEMPTY"].includes(String(code))) throw error;
      }
    }
  }

  applicationDataPath(folderName: string) {
    const candidate = path.resolve(this.paths.applicationsData, folderName);
    if (!isPathInside(this.paths.applicationsData, candidate)) {
      throw new Error("Ungültiger Bewerbungsordner.");
    }
    return candidate;
  }

  rejectionPath(folderName: string) {
    const candidate = path.resolve(this.paths.absagenRoot, folderName);
    if (!isPathInside(this.paths.absagenRoot, candidate)) {
      throw new Error("Ungültiger Absageordner.");
    }
    return candidate;
  }

  interviewPath(
    application: Pick<Application, "company" | "interviewAt">,
  ) {
    const interviewDate = application.interviewAt
      ? formatLocalDate(new Date(application.interviewAt))
      : "Termin_offen";
    const folderName = `${sanitizeFileName(application.company.name)}_${interviewDate}`;
    const candidate = path.resolve(this.paths.interviewsRoot, folderName);
    if (!isPathInside(this.paths.interviewsRoot, candidate)) {
      throw new Error("Ungültiger Vorstellungsgesprächsordner.");
    }
    return candidate;
  }

  async syncInterviewFolder(
    previous: Pick<Application, "company" | "interviewAt" | "status"> | undefined,
    next: Pick<Application, "company" | "interviewAt" | "status">,
  ) {
    if (next.status !== "Vorstellungsgespräch") return;

    const target = this.interviewPath(next);
    const source =
      previous?.status === "Vorstellungsgespräch"
        ? this.interviewPath(previous)
        : undefined;
    if (source === target || !source || !(await pathExists(source))) {
      await mkdir(target, { recursive: true });
      return;
    }
    if (await pathExists(target)) return;

    await rename(source, target);
  }

  documentDirectories(
    application: Pick<Application, "folderName" | "status">,
  ): DocumentDirectories {
    const applicationData = this.applicationDataPath(application.folderName);
    return {
      anschreiben: path.join(applicationData, "Anschreiben"),
      lebenslauf: path.join(applicationData, "Lebenslauf"),
      deckblatt: path.join(applicationData, "Deckblatt"),
      email: path.join(applicationData, "Email"),
      stellenanzeige: path.join(applicationData, "Stellenanzeige"),
      bewerbungsunterlagen: path.join(applicationData, "Bewerbungsunterlagen"),
      backup: path.join(applicationData, "Backup"),
    };
  }

  async allocateApplicationFolderName(
    companyName: string,
    _positionName: string,
    date = new Date(),
  ) {
    const baseFolder = `${sanitizeFileName(companyName)}_${formatLocalDate(date)}`;
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const folderName = suffix === 1 ? baseFolder : `${baseFolder}_${suffix}`;
      const occupied = await Promise.all([
        pathExists(this.applicationDataPath(folderName)),
        pathExists(path.join(this.paths.anschreibenDocuments, folderName)),
        pathExists(path.join(this.paths.lebenslaufDocuments, folderName)),
        pathExists(this.rejectionPath(folderName)),
      ]);
      if (occupied.some(Boolean)) continue;
      try {
        await mkdir(this.applicationDataPath(folderName), {
          recursive: true,
        });
        return folderName;
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : "";
        if (code !== "EEXIST") throw error;
      }
    }
    throw new Error("Für die Bewerbung konnte kein eindeutiger Ordner erstellt werden.");
  }

  private applicationArtifactPaths(folderName: string) {
    const roots = [
      this.paths.applicationsData,
      this.paths.anschreibenDocuments,
      this.paths.lebenslaufDocuments,
      this.paths.absagenRoot,
    ];
    return roots.map((root) => {
      const resolvedRoot = path.resolve(root);
      const candidate = path.resolve(resolvedRoot, folderName);
      if (candidate === resolvedRoot || !isPathInside(resolvedRoot, candidate)) {
        throw new Error("Ungültiger Bewerbungsordner.");
      }
      return { root: resolvedRoot, path: candidate };
    });
  }

  private async applicationFolderOccupied(folderName: string) {
    const occupied = await Promise.all(
      this.applicationArtifactPaths(folderName).map(({ path: candidate }) =>
        pathExists(candidate),
      ),
    );
    return occupied.some(Boolean);
  }

  private async renameApplicationArtifact(
    root: string,
    source: string,
    target: string,
  ) {
    const targetInsideSource =
      source !== target && isPathInside(source, target);
    const sourceInsideTarget =
      source !== target && isPathInside(target, source);

    if (!targetInsideSource && !sourceInsideTarget) {
      await mkdir(path.dirname(target), { recursive: true });
      await rename(source, target);
      return;
    }

    // Windows cannot rename a directory directly into one of its descendants
    // (or back onto an ancestor during rollback). Stage it beside the application
    // tree first so legacy company/date-only folders can gain a position level.
    const staging = path.join(root, `.bewerbung-relocate-${randomUUID()}`);
    await rename(source, staging);
    try {
      if (sourceInsideTarget) {
        await this.removeEmptyDirectoryChain(root, path.dirname(source));
      }
      await mkdir(path.dirname(target), { recursive: true });
      await rename(staging, target);
    } catch (error) {
      try {
        await this.removeEmptyDirectoryChain(root, path.dirname(target));
        await mkdir(path.dirname(source), { recursive: true });
        await rename(staging, source);
      } catch {
        // The original relocation error remains the primary failure.
      }
      throw error;
    }
  }

  async relocateApplicationFolders(application: Application, date: Date) {
    const baseFolder = `${sanitizeFileName(application.company.name)}_${formatLocalDate(date)}`;
    let targetFolderName = "";
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const candidate = suffix === 1 ? baseFolder : `${baseFolder}_${suffix}`;
      if (candidate === application.folderName) return application.folderName;
      if (!(await this.applicationFolderOccupied(candidate))) {
        targetFolderName = candidate;
        break;
      }
    }
    if (!targetFolderName) {
      throw new Error("Für die Bewerbung konnte kein eindeutiger Ordner erstellt werden.");
    }

    const sources = this.applicationArtifactPaths(application.folderName);
    const targets = this.applicationArtifactPaths(targetFolderName);
    const moves = (
      await Promise.all(
        sources.map(async (source, index) => ({
          source,
          target: targets[index],
          exists: await pathExists(source.path),
        })),
      )
    ).filter((move) => move.exists);
    const completed: typeof moves = [];

    try {
      for (const move of moves) {
        if (await pathExists(move.target.path)) {
          throw new Error(`Der Zielordner existiert bereits: ${move.target.path}`);
        }
        await this.withRenameRetry(() =>
          this.renameApplicationArtifact(
            move.source.root,
            move.source.path,
            move.target.path,
          ),
        );
        completed.push(move);
      }
    } catch (error) {
      for (const move of completed.reverse()) {
        try {
          await this.renameApplicationArtifact(
            move.source.root,
            move.target.path,
            move.source.path,
          );
        } catch {
          // The original rename error remains the primary failure.
        }
      }
      await this.removeEmptyArtifactParents(targets);
      if (isApplicationFolderLockError(error)) {
        throw new ApplicationFolderLockedError();
      }
      throw error;
    }

    await this.removeEmptyArtifactParents(sources);
    return targetFolderName;
  }

  private async removeEmptyArtifactParents(
    artifacts: Array<{ root: string; path: string }>,
  ) {
    const parents = new Map(
      artifacts.map(({ root, path: artifactPath }) => [
        path.dirname(artifactPath),
        root,
      ]),
    );
    await Promise.all(
      [...parents].map(([parent, root]) =>
        this.removeEmptyDirectoryChain(root, parent),
      ),
    );
  }

  private async removeEmptyDirectoryChain(root: string, start: string) {
    let current = start;
    while (current !== root && isPathInside(root, current)) {
      try {
        await rmdir(current);
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : "";
        if (code === "ENOENT") {
          current = path.dirname(current);
          continue;
        }
        if (
          ["ENOTEMPTY", "EEXIST", "EACCES", "EBUSY", "EPERM"].includes(code)
        ) {
          break;
        }
        throw error;
      }
      current = path.dirname(current);
    }
  }

  private async containsNestedApplications(folderName: string) {
    const dataRoot = this.applicationDataPath(folderName);
    let entries;
    try {
      entries = await readdir(dataRoot, { withFileTypes: true });
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      if (code === "ENOENT") return false;
      throw error;
    }
    const nestedApplications = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
          pathExists(path.join(dataRoot, entry.name, "bewerbung.json")),
        ),
    );
    return nestedApplications.some(Boolean);
  }

  async ensureApplicationDataDirectories(application: Application) {
    const dataRoot = this.applicationDataPath(application.folderName);
    await Promise.all(
      Object.values(this.documentDirectories(application)).map((directory) =>
        mkdir(directory, { recursive: true }),
      ),
    );
    return { dataRoot };
  }

  /** Move documents created by older versions into the canonical application subfolders. */
  async consolidateLegacyDocumentDirectories(
    application: Pick<Application, "folderName">,
  ) {
    const dataRoot = this.applicationDataPath(application.folderName);
    const locations = [
      {
        source: path.join(this.paths.anschreibenDocuments, application.folderName),
        defaultKind: "anschreiben" as const,
      },
      {
        source: path.join(this.paths.lebenslaufDocuments, application.folderName),
        defaultKind: "lebenslauf" as const,
      },
    ];
    const targetRoots: Record<ApplicationDocumentNameKind, string> = {
      anschreiben: path.join(dataRoot, "Anschreiben"),
      deckblatt: path.join(dataRoot, "Deckblatt"),
      lebenslauf: path.join(dataRoot, "Lebenslauf"),
      mappe: path.join(dataRoot, "Bewerbungsunterlagen"),
    };
    const moves: Array<{ source: string; target: string }> = [];
    for (const location of locations) {
      let entries;
      try {
        entries = await readdir(location.source, { withFileTypes: true, recursive: true });
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "ENOENT") continue;
        throw error;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const source = path.join(entry.parentPath, entry.name);
        const stem = path.parse(entry.name).name.toLocaleLowerCase();
        const kind = (Object.keys(targetRoots) as ApplicationDocumentNameKind[]).find(
          (candidate) =>
            stem === candidate ||
            stem.startsWith(`${candidate}_`) ||
            stem.endsWith(`_${candidate}`) ||
            stem.includes(`_${candidate}_`),
        ) ?? location.defaultKind;
        const targetRoot = targetRoots[kind];
        let target = path.join(targetRoot, entry.name);
        if (await pathExists(target)) {
          const parsed = path.parse(entry.name);
          const archiveRoot = path.join(targetRoot, "Altbestand");
          for (let suffix = 1; suffix < 10_000; suffix += 1) {
            const candidate = path.join(
              archiveRoot,
              `${parsed.name}${suffix === 1 ? "" : `_${suffix}`}${parsed.ext}`,
            );
            if (!(await pathExists(candidate))) {
              target = candidate;
              break;
            }
          }
        }
        moves.push({ source, target });
      }
    }
    const completed: typeof moves = [];
    try {
      for (const move of moves) {
        await mkdir(path.dirname(move.target), { recursive: true });
        await this.withRenameRetry(() => rename(move.source, move.target));
        completed.push(move);
      }
    } catch (error) {
      for (const move of completed.reverse()) {
        try {
          await mkdir(path.dirname(move.source), { recursive: true });
          await rename(move.target, move.source);
        } catch {
          // Preserve the original migration error.
        }
      }
      if (isApplicationFolderLockError(error)) throw new ApplicationFolderLockedError();
      throw error;
    }
    for (const location of locations) {
      if (await pathExists(location.source)) {
        await rm(location.source, { recursive: true, force: true });
      }
    }
    await this.removeEmptyArtifactParents(
      locations.map((location, index) => ({
        root: path.resolve(index === 0 ? this.paths.anschreibenDocuments : this.paths.lebenslaufDocuments),
        path: location.source,
      })),
    );
  }

  /**
   * Rename documents that still use an older naming scheme
   * (e.g. `Firma_TT.MM.JJJJ_Position_anschreiben.pdf` or `Anschreiben.docx`)
   * to `<Dokument>_<Name>_<Firma>`. Existing targets are never overwritten.
   */
  async normalizeLegacyDocumentNames(
    application: Pick<Application, "folderName" | "status" | "company" | "createdAt" | "sentAt">,
    names: Record<ApplicationDocumentNameKind, string>,
  ) {
    const dataRoot = this.applicationDataPath(application.folderName);
    const documentDirectories = this.documentDirectories(application);
    const directories: Record<ApplicationDocumentNameKind, string> = {
      anschreiben: documentDirectories.anschreiben,
      deckblatt: documentDirectories.deckblatt,
      lebenslauf: documentDirectories.lebenslauf,
      mappe: path.join(dataRoot, "Bewerbungsunterlagen"),
    };
    const base = applicationFileBaseName(application).toLocaleLowerCase();
    for (const kind of Object.keys(names) as ApplicationDocumentNameKind[]) {
      const directory = directories[kind];
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "ENOENT") continue;
        throw error;
      }
      const reserved = new Set(entries.map((entry) => entry.name.toLocaleLowerCase()));
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const parsed = path.parse(entry.name);
        const extension = parsed.ext.toLowerCase();
        if (extension !== ".pdf" && extension !== ".docx") continue;
        const stem = parsed.name.toLocaleLowerCase();
        const isLegacyName =
          stem === kind ||
          (stem.startsWith(`${base}_`) && stem.endsWith(`_${kind}`));
        if (!isLegacyName) continue;
        const targetName = `${names[kind]}${extension}`;
        if (targetName.toLocaleLowerCase() === entry.name.toLocaleLowerCase()) continue;
        if (reserved.has(targetName.toLocaleLowerCase())) continue;
        const target = path.join(directory, targetName);
        if (!isPathInside(directory, target)) continue;
        try {
          await this.withRenameRetry(() => rename(path.join(directory, entry.name), target));
          reserved.delete(entry.name.toLocaleLowerCase());
          reserved.add(targetName.toLocaleLowerCase());
        } catch (error) {
          // A file opened in Word or a PDF viewer keeps its old name until the next attempt.
          if (!isApplicationFolderLockError(error)) throw error;
        }
      }
    }
  }

  async synchronizeApplicationArtifactNames(
    previous: Application,
    next: Application,
  ) {
    const previousDate = getApplicationDate(previous);
    const nextDate = getApplicationDate(next);
    const replacements = [
      [
        previous.folderName.split(/[\\/]/)[0],
        next.folderName.split(/[\\/]/)[0],
      ],
      [sanitizeFileName(previous.company.name), sanitizeFileName(next.company.name)],
      [formatApplicationDate(previous), formatApplicationDate(next)],
      [formatLocalDate(previousDate), formatLocalDate(nextDate)],
    ].filter(([from, to]) => from !== to);
    const documentDirectories = this.documentDirectories(next);
    const directoryCandidates = [...new Set([
      this.applicationDataPath(next.folderName),
      documentDirectories.anschreiben,
      documentDirectories.lebenslauf,
    ])];
    const directories = directoryCandidates.filter(
      (candidate, index) =>
        !directoryCandidates.some(
          (parent, parentIndex) =>
            parentIndex !== index &&
            parent !== candidate &&
            isPathInside(parent, candidate),
        ),
    );
    const moves: Array<{ source: string; target: string }> = [];
    for (const directory of directories) {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true, recursive: true });
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : "";
        if (code === "ENOENT") continue;
        throw error;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const source = path.join(entry.parentPath, entry.name);
        let targetName = entry.name;
        for (const [from, to] of replacements) {
          targetName = targetName.split(from).join(to);
        }
        if (targetName === entry.name) continue;
        moves.push({ source, target: path.join(entry.parentPath, targetName) });
      }
    }

    const reservedTargets = new Set<string>();
    for (const move of moves) {
      const normalizedTarget = path.resolve(move.target).toLocaleLowerCase();
      if (reservedTargets.has(normalizedTarget)) {
        throw new Error(
          `Mehrere Dateien würden denselben aktuellen Bewerbungsnamen erhalten: ${move.target}`,
        );
      }
      reservedTargets.add(normalizedTarget);
      if (await pathExists(move.target)) {
        throw new Error(
          `Die Datei kann nicht auf den aktuellen Bewerbungsnamen umgestellt werden, weil das Ziel bereits existiert: ${move.target}`,
        );
      }
    }
    const completed: typeof moves = [];
    try {
      for (const move of moves) {
        await this.withRenameRetry(() => rename(move.source, move.target));
        completed.push(move);
      }
    } catch (error) {
      for (const move of completed.reverse()) {
        try {
          await rename(move.target, move.source);
        } catch {
          // Preserve the original rename error.
        }
      }
      if (isApplicationFolderLockError(error)) {
        throw new ApplicationFolderLockedError();
      }
      throw error;
    }
  }

  archiveRootForCategory(category: "Zeugnisse" | "Zertifikate") {
    return category === "Zeugnisse"
      ? this.paths.zeugnisseArchive
      : this.paths.zertifikateArchive;
  }

  archiveRelativePath(
    category: "Zeugnisse" | "Zertifikate",
    selectedPath: string,
  ) {
    const root = this.archiveRootForCategory(category);
    const absolute = path.resolve(selectedPath);
    if (!isPathInside(root, absolute) || absolute === path.resolve(root)) {
      throw new Error(
        `Bitte wählen Sie eine Datei aus dem zentralen Ordner „${category}“.`,
      );
    }
    return path.relative(root, absolute);
  }

  resolveArchivePath(
    category: "Zeugnisse" | "Zertifikate",
    relativePath: string,
  ) {
    const root = this.archiveRootForCategory(category);
    const absolute = path.resolve(root, relativePath);
    if (!isPathInside(root, absolute) || absolute === path.resolve(root)) {
      throw new Error("Ungültiger Dokumentpfad.");
    }
    return absolute;
  }

  async transitionApplicationDocuments(
    application: Application,
    nextStatus: ApplicationStatus,
  ) {
    const wasRejected = application.status === "Absage";
    const willBeRejected = nextStatus === "Absage";
    if (wasRejected === willBeRejected) return;
    if (await this.containsNestedApplications(application.folderName)) {
      throw new Error(
        "Dieser ältere Bewerbungsordner enthält weitere positionsbezogene Bewerbungen und kann nicht als Ganzes verschoben werden.",
      );
    }

    const current = this.documentDirectories(application);
    const next = this.documentDirectories({
      ...application,
      status: nextStatus,
    });
    if (
      current.anschreiben === next.anschreiben &&
      current.lebenslauf === next.lebenslauf
    ) return;
    const moves = wasRejected
      ? ([
          [current.lebenslauf, next.lebenslauf],
          [current.anschreiben, next.anschreiben],
        ] as const)
      : ([
          [current.anschreiben, next.anschreiben],
          [current.lebenslauf, next.lebenslauf],
        ] as const);
    const completed: Array<readonly [string, string]> = [];
    try {
      for (const [source, target] of moves) {
        if (!(await pathExists(source))) continue;
        if (await pathExists(target)) {
          throw new Error(`Der Zielordner existiert bereits: ${target}`);
        }
        await mkdir(path.dirname(target), { recursive: true });
        await rename(source, target);
        completed.push([source, target]);
      }
    } catch (error) {
      for (const [source, target] of completed.reverse()) {
        try {
          await rename(target, source);
        } catch {
          // The original transition error remains the primary failure.
        }
      }
      throw error;
    }

    const sourceRoots = wasRejected
      ? [this.paths.absagenRoot, this.paths.absagenRoot]
      : [this.paths.anschreibenDocuments, this.paths.lebenslaufDocuments];
    await this.removeEmptyArtifactParents(
      moves.map(([source], index) => ({
        root: path.resolve(sourceRoots[index]),
        path: source,
      })),
    );
  }

  async removeApplicationArtifacts(
    application: Pick<Application, "folderName">,
  ) {
    const folderName = application.folderName;
    if (await this.containsNestedApplications(folderName)) {
      throw new Error(
        "Dieser ältere Bewerbungsordner enthält weitere positionsbezogene Bewerbungen und kann nicht als Ganzes gelöscht werden.",
      );
    }
    const roots = [
      this.paths.applicationsData,
      this.paths.anschreibenDocuments,
      this.paths.lebenslaufDocuments,
      this.paths.absagenRoot,
    ];
    const targets = roots.map((root) => {
      const resolvedRoot = path.resolve(root);
      const candidate = path.resolve(root, folderName);
      if (candidate === resolvedRoot || !isPathInside(resolvedRoot, candidate)) {
        throw new Error("Ungültiger Bewerbungsordner.");
      }
      return candidate;
    });

    await Promise.all(
      targets.map((target) => rm(target, { recursive: true, force: true })),
    );
    await this.removeEmptyArtifactParents(
      targets.map((target, index) => ({
        root: path.resolve(roots[index]),
        path: target,
      })),
    );
  }
}
