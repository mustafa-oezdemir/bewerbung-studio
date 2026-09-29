import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, rename, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import type { Application, ApplicationStatus } from "../src/shared/schema";
import type { ApplicationPaths } from "../src/config/application-paths";
import {
  formatApplicationDate,
  formatApplicationDateFolder,
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
};

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

  async initialize() {
    const directories = [
      this.paths.root,
      this.paths.dataRoot,
      this.paths.applicationsData,
      this.paths.anschreibenDocuments,
      this.paths.lebenslaufDocuments,
      this.paths.zeugnisseArchive,
      this.paths.zertifikateArchive,
      this.paths.absagenRoot,
      this.paths.interviewsRoot,
      this.paths.anschreibenTemplates,
      this.paths.deckblattTemplates,
      this.paths.lebenslaufTemplates,
      this.paths.previewCache,
      this.paths.systemTemplateCache,
      path.join(this.paths.dataRoot, "Profile"),
      path.join(this.paths.dataRoot, "Settings"),
      path.join(this.paths.dataRoot, "Backups"),
    ];
    await Promise.all(
      directories.map((directory) => mkdir(directory, { recursive: true })),
    );
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
      anschreiben: applicationData,
      lebenslauf: applicationData,
      deckblatt: applicationData,
      email: path.join(applicationData, "Email"),
    };
  }

  async allocateApplicationFolderName(
    companyName: string,
    positionName: string,
    date = new Date(),
  ) {
    const companyDateFolder = `${sanitizeFileName(companyName)}_${formatApplicationDateFolder(date)}`;
    const positionFolder = sanitizeFileName(positionName);
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const uniquePositionFolder =
        suffix === 1 ? positionFolder : `${positionFolder}_${suffix}`;
      const folderName = path.join(companyDateFolder, uniquePositionFolder);
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
    const companyDateFolder = `${sanitizeFileName(application.company.name)}_${formatApplicationDateFolder(date)}`;
    const positionFolder = sanitizeFileName(application.job.title);
    let targetFolderName = "";
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const uniquePositionFolder =
        suffix === 1 ? positionFolder : `${positionFolder}_${suffix}`;
      const candidate = path.join(companyDateFolder, uniquePositionFolder);
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
    await Promise.all([
      mkdir(path.join(dataRoot, "Stellenanzeige"), { recursive: true }),
      mkdir(path.join(dataRoot, "Email"), { recursive: true }),
    ]);
    return { dataRoot };
  }

  /** Move documents created by older versions into the canonical application folder. */
  async consolidateLegacyDocumentDirectories(
    application: Pick<Application, "folderName" | "status">,
  ) {
    if (application.status === "Absage") return;
    const targetRoot = this.applicationDataPath(application.folderName);
    const legacyRoots = [
      path.join(this.paths.anschreibenDocuments, application.folderName),
      path.join(this.paths.lebenslaufDocuments, application.folderName),
    ];
    const moves: Array<{ source: string; target: string }> = [];
    for (const [legacyIndex, legacyRoot] of legacyRoots.entries()) {
      let entries;
      try {
        entries = await readdir(legacyRoot, { withFileTypes: true, recursive: true });
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "ENOENT") continue;
        throw error;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const source = path.join(entry.parentPath, entry.name);
        const relative = path.relative(legacyRoot, source);
        let target = path.resolve(targetRoot, relative);
        if (!isPathInside(targetRoot, target)) throw new Error("Ungültiger Dokumentpfad.");
        if (await pathExists(target)) {
          const parsed = path.parse(entry.name);
          const archiveRoot = path.join(
            targetRoot,
            "Altbestand",
            legacyIndex === 0 ? "Anschreiben" : "Lebenslauf",
          );
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
    for (const legacyRoot of legacyRoots) {
      if (await pathExists(legacyRoot)) await rm(legacyRoot, { recursive: true, force: true });
    }
    await this.removeEmptyArtifactParents(
      legacyRoots.map((legacyRoot, index) => ({
        root: path.resolve(index === 0 ? this.paths.anschreibenDocuments : this.paths.lebenslaufDocuments),
        path: legacyRoot,
      })),
    );
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
        if (
          path.resolve(entry.parentPath) ===
            path.resolve(documentDirectories.anschreiben) &&
          /^Anschreiben\.docx$/i.test(entry.name)
        ) {
          targetName = `${applicationFileBaseName(next)}_Anschreiben.docx`;
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
