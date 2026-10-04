import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { resolveApplicationPaths, DEFAULT_BEWERBUNG_ROOT_PATH, BEWERBUNG_ROOT_PATH_ENV } from "../src/config/application-paths";
import { workspaceSchema } from "../src/shared/schema";
import { parseEncryptedWorkspace } from "./security/encryption-service";
import { encodeForManagedWrite } from "./security/secure-fs";
import { FileManagementService, isPathInside } from "./file-management";
import type { WorkspaceChangeMode, WorkspaceStatus } from "../src/shared/ipc";

const bootstrapSchema = z.object({
  workspaceRootPath: z.string().min(1),
  setupCompleted: z.literal(true),
});

const exists = async (candidate: string) => {
  try { await stat(candidate); return true; } catch { return false; }
};

const isDirectory = async (candidate: string) => {
  const info = await lstat(candidate).catch(() => null);
  return Boolean(info?.isDirectory() && !info.isSymbolicLink());
};

const hashFile = async (filePath: string) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
};

const timestamp = () => new Date().toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19);

const workspacePaths = (root: string) => {
  const paths = resolveApplicationPaths(root);
  return [
    path.join(paths.settingsRoot, "workspace.json"),
    path.join(paths.dataRoot, "Settings", "workspace.json"),
  ];
};

export const resolveWorkspaceRootFromFile = (filePath: string) => {
  const selected = path.resolve(filePath);
  if (path.basename(selected).toLowerCase() !== "workspace.json") return null;
  const settings = path.dirname(selected);
  const parent = path.dirname(settings);
  const data = path.dirname(parent);
  if (path.basename(settings).toLowerCase() === "settings" &&
      path.basename(parent).toLowerCase() === "setting" &&
      path.basename(data).toLowerCase() === "data") return path.dirname(data);
  if (path.basename(settings).toLowerCase() === "settings" &&
      path.basename(parent).toLowerCase() === "data") return path.dirname(parent);
  return null;
};

const safeFolderName = (name: string) =>
  !path.isAbsolute(name) && !path.win32.isAbsolute(name) &&
  !name.split(/[\\/]+/).some((part) => !part || part === "." || part === ".." || part.includes(":"));

type WorkspaceInspection = {
  root: string;
  filePath: string;
  warnings: string[];
  recoveryAvailable: boolean;
  encrypted: boolean;
};

type LockMetadata = { hostname: string; pid: number; openedAt: string; appVersion: string };

export const sameWorkspaceRoot = (left: string, right: string) => {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
};

const existingWorkspacePath = async (root: string) => {
  for (const candidate of workspacePaths(root)) {
    if (await exists(candidate) || await exists(`${candidate}.bak`)) return candidate;
  }
  return workspacePaths(root)[0];
};

const listFiles = async (root: string, excluded?: string): Promise<string[]> => {
  const files: string[] = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (excluded && isPathInside(excluded, candidate)) continue;
      if (entry.name === ".workspace.lock") continue;
      if (entry.isSymbolicLink()) throw new Error("Verknüpfungen im Bewerbungsordner können nicht sicher kopiert werden.");
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile()) files.push(candidate);
    }
  }
  return files.sort();
};

const copyAndVerify = async (source: string, target: string, copy: typeof copyFile = copyFile) => {
  await mkdir(path.dirname(target), { recursive: true });
  await copy(source, target, constants.COPYFILE_EXCL);
  const [sourceInfo, targetInfo] = await Promise.all([stat(source), stat(target)]);
  const [sourceHash, targetHash] = await Promise.all([hashFile(source), hashFile(target)]);
  if (sourceInfo.size !== targetInfo.size || sourceHash !== targetHash) {
    throw new Error(`Kopie konnte nicht geprüft werden: ${path.basename(source)}`);
  }
  return { size: sourceInfo.size, sha256: targetHash };
};

/** The folder a fresh installation uses under the user's Dokumente. */
export const DEFAULT_WORKSPACE_FOLDER = "BewerbungsManager";

export class WorkspaceManager {
  readonly bootstrapPath: string;
  private readonly lockId = randomUUID();
  private readonly lockedRoots = new Set<string>();

  constructor(
    private readonly userDataPath: string,
    private readonly environment: Record<string, string | undefined> = process.env,
    private readonly legacyRootPath = DEFAULT_BEWERBUNG_ROOT_PATH,
    private readonly copyOperation: typeof copyFile = copyFile,
  ) {
    this.bootstrapPath = path.join(userDataPath, "bootstrap.json");
  }

  private async readBootstrap() {
    try {
      return bootstrapSchema.parse(JSON.parse(await readFile(this.bootstrapPath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new Error("Die gespeicherte Speicherort-Konfiguration ist beschädigt.");
    }
  }

  private async writeBootstrap(root: string) {
    await mkdir(this.userDataPath, { recursive: true });
    const temporary = `${this.bootstrapPath}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify({ workspaceRootPath: root, setupCompleted: true }, null, 2), "utf8");
    await rename(temporary, this.bootstrapPath);
  }

  async workspaceDetails(root: string) {
    const filePath = await existingWorkspacePath(root);
    const info = await stat(filePath).catch(() => stat(`${filePath}.bak`));
    return { filePath, modifiedAt: info.mtime.toISOString() };
  }

  async inspectWorkspaceFile(filePath: string): Promise<WorkspaceInspection> {
    const root = resolveWorkspaceRootFromFile(filePath);
    if (!root) throw new Error("Die Workspace-Datei wurde erkannt, aber der zugehörige Bewerbungsordner konnte nicht vollständig gefunden werden.");
    await this.validateRoot(root, false);
    const paths = resolveApplicationPaths(root);
    if (!(await isDirectory(paths.dataRoot)) || !(await isDirectory(path.dirname(filePath)))) {
      throw new Error("Die Workspace-Datei wurde erkannt, aber der zugehörige Bewerbungsordner konnte nicht vollständig gefunden werden.");
    }
    const companionRoots = [paths.applicationsData, paths.profileRoot, paths.musterRoot,
      paths.zeugnisseArchive, paths.zertifikateArchive, path.join(paths.dataRoot, "Profile")];
    if (!(await Promise.all(companionRoots.map(isDirectory))).some(Boolean)) {
      throw new Error("Die Workspace-Datei wurde erkannt, aber der zugehörige Bewerbungsordner konnte nicht vollständig gefunden werden.");
    }
    const parse = async (candidate: string) => {
      try {
        const raw = JSON.parse(await readFile(candidate, "utf8")) as unknown;
        const envelope = parseEncryptedWorkspace(raw);
        return envelope ? { encrypted: true as const, workspace: null } :
          { encrypted: false as const, workspace: workspaceSchema.parse(raw) };
      } catch (error) {
        if (error instanceof Error && error.message.includes("neueren Version")) throw error;
        return null;
      }
    };
    let parsed = await parse(filePath);
    let recoveryAvailable = false;
    if (!parsed) {
      parsed = await parse(`${filePath}.bak`);
      if (!parsed) throw new Error("Der ausgewählte Datenbestand ist ungültig oder beschädigt.");
      recoveryAvailable = true;
    }
    if (parsed.encrypted) return { root, filePath: path.resolve(filePath), warnings: [], recoveryAvailable, encrypted: true };
    const workspace = parsed.workspace;
    const warnings: string[] = [];
    const profiles = new Set(workspace.profiles.map((profile) => profile.id));
    for (const application of workspace.applications) {
      if (!safeFolderName(application.folderName)) throw new Error(`Ungültiger Bewerbungsordner: ${application.folderName}`);
      if (application.profileId && !profiles.has(application.profileId))
        warnings.push(`Profilverknüpfung fehlt: ${application.company.name}`);
      const folder = path.resolve(paths.applicationsData, application.folderName);
      if (!isPathInside(paths.applicationsData, folder)) throw new Error(`Ungültiger Bewerbungsordner: ${application.folderName}`);
      if ((await lstat(folder).catch(() => null))?.isSymbolicLink())
        throw new Error(`Ungültiger Bewerbungsordner: ${application.folderName}`);
      if (!(await isDirectory(folder))) warnings.push(`Bewerbungsordner fehlt: ${application.folderName}`);
    }
    for (const attachment of workspace.attachments) {
      let file: string | null = null;
      if (attachment.archiveRelativePath) {
        const archive = attachment.category === "Zeugnisse" ? paths.zeugnisseArchive : paths.zertifikateArchive;
        file = path.resolve(archive, attachment.archiveRelativePath);
        if (!isPathInside(archive, file)) throw new Error("Ungültiger Dokumentpfad im Datenbestand.");
      } else if (attachment.storedName) {
        const application = workspace.applications.find((item) => item.id === attachment.applicationId);
        if (application) {
          if (path.basename(attachment.storedName) !== attachment.storedName) throw new Error("Ungültiger Dokumentpfad im Datenbestand.");
          file = path.join(paths.applicationsData, application.folderName, attachment.category, attachment.storedName);
        } else warnings.push(`Anhang ohne Bewerbung: ${attachment.fileName}`);
      } else {
        warnings.push(`Anhang ohne gespeicherten Pfad: ${attachment.fileName}`);
      }
      if (file && !(await exists(file))) warnings.push(`Anhang fehlt: ${attachment.fileName}`);
    }
    return { root, filePath: path.resolve(filePath), warnings, recoveryAvailable, encrypted: false };
  }

  async restoreWorkspaceBackup(filePath: string) {
    const inspection = await this.inspectWorkspaceFile(filePath);
    if (!inspection.recoveryAvailable) return inspection;
    const saved = `${filePath}.beschädigt-${timestamp()}-${randomUUID().slice(0, 8)}`;
    if (await exists(filePath)) await copyFile(filePath, saved);
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    await copyFile(`${filePath}.bak`, temporary);
    await rename(temporary, filePath);
    return this.inspectWorkspaceFile(filePath);
  }

  private lockPath(root: string) { return path.join(root, ".workspace.lock"); }

  lockToken(root: string) {
    return [...this.lockedRoots].some((locked) => sameWorkspaceRoot(locked, root)) ? this.lockId : undefined;
  }

  async lockConflict(root: string) {
    if ([...this.lockedRoots].some((locked) => sameWorkspaceRoot(locked, root))) return false;
    const lockPath = this.lockPath(root);
    let raw: string;
    try { raw = await readFile(lockPath, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      return true;
    }
    let metadata: LockMetadata;
    try { metadata = JSON.parse(raw) as LockMetadata; }
    catch { return Date.now() - (await stat(lockPath)).mtimeMs < 120_000; }
    if (typeof metadata.hostname !== "string" || !Number.isInteger(metadata.pid) || metadata.pid <= 0)
      return Date.now() - (await stat(lockPath)).mtimeMs < 120_000;
    if (metadata.hostname === os.hostname()) {
      if (metadata.pid === process.pid) return false;
      try { process.kill(metadata.pid, 0); return true; }
      catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
    }
    return Date.now() - (await stat(lockPath)).mtimeMs < 120_000;
  }

  async acquireLock(root: string, appVersion: string, force = false) {
    const resolved = path.resolve(root);
    if ([...this.lockedRoots].some((locked) => sameWorkspaceRoot(locked, resolved))) return;
    if (await this.lockConflict(resolved)) {
      if (!force) throw new Error("Dieser Datenbestand scheint bereits auf einem anderen Computer oder in einer anderen Instanz geöffnet zu sein.");
    }
    const lockPath = this.lockPath(resolved);
    if (await exists(lockPath)) {
      if (await this.lockConflict(resolved) && !force)
        throw new Error("Dieser Datenbestand scheint bereits auf einem anderen Computer oder in einer anderen Instanz geöffnet zu sein.");
      await rm(lockPath);
    }
    const metadata = { hostname: os.hostname(), pid: process.pid, openedAt: new Date().toISOString(), appVersion, lockId: this.lockId };
    await writeFile(lockPath, JSON.stringify(metadata, null, 2), { flag: "wx" });
    this.lockedRoots.add(resolved);
  }

  async refreshLock() {
    for (const root of this.lockedRoots) {
      const lockPath = this.lockPath(root);
      try {
        const metadata = JSON.parse(await readFile(lockPath, "utf8")) as { lockId?: string };
        if (metadata.lockId !== this.lockId) continue;
        const now = new Date();
        const { utimes } = await import("node:fs/promises");
        await utimes(lockPath, now, now);
      } catch { /* A lost lock is detected by the next save. */ }
    }
  }

  async releaseLock(root: string) {
    root = path.resolve(root);
    if (!this.lockedRoots.has(root)) return;
    this.lockedRoots.delete(root);
    const lockPath = this.lockPath(root);
    try {
      const metadata = JSON.parse(await readFile(lockPath, "utf8")) as { lockId?: string };
      if (metadata.lockId === this.lockId) await rm(lockPath);
    } catch { /* The lock may already have been removed. */ }
  }

  async releaseAllLocks() {
    for (const root of [...this.lockedRoots]) await this.releaseLock(root);
  }

  async prepareExistingWorkspace(filePath: string, currentRoot?: string) {
    const inspection = await this.inspectWorkspaceFile(filePath);
    if (inspection.recoveryAvailable) throw new Error("Die Workspace-Datei ist beschädigt, aber eine gültige Sicherung wurde gefunden.");
    if (currentRoot && !sameWorkspaceRoot(currentRoot, inspection.root)) await this.fullBackup(currentRoot);
    return inspection;
  }

  private async repairNestedApplicationsRoot(root: string) {
    const applicationsFolder = path.basename(root).toLocaleLowerCase();
    const dataFolder = path.basename(path.dirname(root)).toLocaleLowerCase();
    const candidate =
      applicationsFolder === "bewerbungen" && dataFolder === "data"
        ? path.dirname(path.dirname(root))
        : applicationsFolder === "data"
          ? path.dirname(root)
          : null;
    if (!candidate) return null;
    const candidates = workspacePaths(candidate);
    const found = await Promise.all(
      candidates.flatMap((workspacePath) => [exists(workspacePath), exists(`${workspacePath}.bak`)]),
    );
    if (!found.some(Boolean)) {
      return null;
    }
    await this.writeBootstrap(candidate);
    return candidate;
  }

  private async readWorkspace(root: string) {
    const workspacePath = await existingWorkspacePath(root);
    if (!(await exists(workspacePath))) return null;
    try {
      return workspaceSchema.parse(JSON.parse(await readFile(workspacePath, "utf8")));
    } catch {
      throw new Error("Der Bewerbungsordner enthält ungültige Daten.");
    }
  }

  private async preservePersonalData(source: string, target: string) {
    const sourceWorkspace = await this.readWorkspace(source);
    if (!sourceWorkspace) return;
    const targetWorkspace = await this.readWorkspace(target);
    const mergeById = <T extends { id: string }>(current: T[], incoming: T[]) => {
      const items = new Map(current.map((item) => [item.id, item]));
      for (const item of incoming) if (!items.has(item.id)) items.set(item.id, item);
      return [...items.values()];
    };
    const nextWorkspace = workspaceSchema.parse({
      ...(targetWorkspace ?? sourceWorkspace),
      applications: targetWorkspace?.applications ?? [],
      events: targetWorkspace?.events ?? [],
      attachments: targetWorkspace?.attachments ?? [],
      profiles: mergeById(
        targetWorkspace?.profiles ?? [],
        sourceWorkspace.profiles,
      ),
      todos: mergeById(
        targetWorkspace?.todos ?? [],
        sourceWorkspace.todos,
      ),
      customCvDesigns: mergeById(
        targetWorkspace?.customCvDesigns ?? [],
        sourceWorkspace.customCvDesigns,
      ),
      updatedAt: new Date().toISOString(),
    });
    const workspacePath = path.join(resolveApplicationPaths(target).settingsRoot, "workspace.json");
    const temporary = `${workspacePath}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(workspacePath), { recursive: true });
    await writeFile(temporary, JSON.stringify(nextWorkspace, null, 2), "utf8");
    await rename(temporary, workspacePath);

    const sourcePaths = resolveApplicationPaths(source);
    const targetPaths = resolveApplicationPaths(target);
    const sourceProfileDirectory = (await exists(sourcePaths.profileRoot))
      ? sourcePaths.profileRoot
      : path.join(sourcePaths.dataRoot, "Profile");
    if (!(await exists(sourceProfileDirectory))) return;
    for (const sourceFile of await listFiles(sourceProfileDirectory)) {
      const targetFile = path.join(
        targetPaths.profileRoot,
        path.relative(sourceProfileDirectory, sourceFile),
      );
      if (!(await exists(targetFile))) await copyAndVerify(sourceFile, targetFile, this.copyOperation);
    }
  }

  async status(): Promise<WorkspaceStatus> {
    const override = this.environment[BEWERBUNG_ROOT_PATH_ENV]?.trim();
    if (override) return { state: "ready", root: path.resolve(override) };
    const config = await this.readBootstrap();
    if (config) {
      const configuredRoot = path.resolve(config.workspaceRootPath);
      const root =
        (await this.repairNestedApplicationsRoot(configuredRoot)) ??
        configuredRoot;
      if (!(await exists(root))) return { state: "missing", root };
      const candidates = workspacePaths(root);
      const found = await Promise.all(
        candidates.flatMap((workspacePath) => [exists(workspacePath), exists(`${workspacePath}.bak`)]),
      );
      if (!found.some(Boolean)) {
        return {
          state: "error", root,
          message: "Die gespeicherten Bewerbungsdaten wurden in diesem Ordner nicht gefunden. Der Ordner wurde nicht verändert.",
        };
      }
      return { state: "ready", root };
    }
    // Existing installations must retain their original data without a setup prompt.
    const legacyRoot = path.resolve(this.legacyRootPath);
    if ((await Promise.all(workspacePaths(legacyRoot).map(exists))).some(Boolean)) {
      await this.writeBootstrap(legacyRoot);
      return { state: "ready", root: legacyRoot };
    }
    return { state: "setup" };
  }

  async validateRoot(rootPath: string, create: boolean) {
    if (!path.isAbsolute(rootPath) || !rootPath.trim()) throw new Error("Bitte wählen Sie einen gültigen Ordner.");
    const root = path.resolve(rootPath);
    if (create) await mkdir(root, { recursive: true });
    const info = await lstat(root).catch(() => null);
    if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error("Der ausgewählte Bewerbungsordner ist nicht verfügbar.");
    const testPath = path.join(root, `.bewerbungsmanager-write-${randomUUID()}`);
    try {
      const handle = await open(testPath, "wx");
      await handle.close();
      await rm(testPath);
    } catch {
      throw new Error("In den ausgewählten Bewerbungsordner kann nicht geschrieben werden.");
    }
    return root;
  }

  async setup(rootPath: string, activate = true) {
    const root = await this.validateRoot(rootPath, true);
    const workspacePath = await existingWorkspacePath(root);
    if (await exists(workspacePath)) {
      try {
        const parsed = workspaceSchema.safeParse(JSON.parse(await readFile(workspacePath, "utf8")));
        if (!parsed.success) throw new Error("invalid");
      } catch {
        throw new Error("Der vorhandene Bewerbungsordner enthält ungültige Daten.");
      }
    }
    await new FileManagementService(resolveApplicationPaths(root)).initialize();
    if (activate) await this.writeBootstrap(root);
    return root;
  }

  /**
   * A first start without any configured data (e.g. the app installed on a new computer): the Bewerbungsdaten go to
   * `<Dokumente>\BewerbungsManager` without a setup question; the user can move them later (Einstellungen →
   * Speicherort). A data set already in that folder is opened as it is. An encrypted one is never opened silently
   * (it needs its password): `null`, and the user chooses on the setup screen.
   */
  async setupDefault(documentsPath: string) {
    const root = path.join(documentsPath, DEFAULT_WORKSPACE_FOLDER);
    const workspacePath = await existingWorkspacePath(root);
    if (await exists(workspacePath)) {
      const inspection = await this.inspectWorkspaceFile(workspacePath).catch(() => null);
      if (!inspection || inspection.encrypted) return null;
    }
    return this.setup(root);
  }

  async activate(root: string) {
    await this.writeBootstrap(path.resolve(root));
  }

  async deactivate() {
    await rm(this.bootstrapPath, { force: true });
  }

  async fullBackup(rootPath: string, oldSchemaVersion = 1, newSchemaVersion = 1, migratedFields: string[] = []) {
    const root = await this.validateRoot(rootPath, false);
    const backupRoot = path.join(resolveApplicationPaths(root).backupsRoot, `Migration_${timestamp()}_${randomUUID().slice(0, 8)}`);
    await mkdir(backupRoot, { recursive: true });
    const entries: Array<{ path: string; size: number; sha256: string }> = [];
    try {
      for (const source of await listFiles(root, backupRoot)) {
        const relative = path.relative(root, source);
        const target = path.join(backupRoot, relative);
        const verified = await copyAndVerify(source, target, this.copyOperation);
        entries.push({ path: relative, ...verified });
      }
      const workspaceSource = await existingWorkspacePath(root);
      if (await exists(workspaceSource) && !(await exists(path.join(backupRoot, "workspace.json")))) {
        await copyAndVerify(workspaceSource, path.join(backupRoot, "workspace.json"), this.copyOperation);
      }
      const manifest = {
        migratedAt: new Date().toISOString(), oldSchemaVersion, newSchemaVersion,
        sourcePath: root, backupPath: backupRoot, migratedFields,
        warnings: [], errors: [], files: entries,
      };
      const manifestPath = path.join(backupRoot, "migration-manifest.json");
      await writeFile(manifestPath, encodeForManagedWrite(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2))));
      return backupRoot;
    } catch (error) {
      await rm(backupRoot, { recursive: true, force: true });
      throw error;
    }
  }

  async changeRoot(currentRootPath: string, nextRootPath: string, mode: WorkspaceChangeMode, activate = true) {
    if (!["move", "copy", "new"].includes(mode)) throw new Error("Ungültige Speicherort-Aktion.");
    if (!path.isAbsolute(nextRootPath)) throw new Error("Bitte wählen Sie einen gültigen Ordner.");
    const prospectiveSource = path.resolve(currentRootPath);
    const prospectiveTarget = path.resolve(nextRootPath);
    if (!sameWorkspaceRoot(prospectiveSource, prospectiveTarget) &&
      (isPathInside(prospectiveSource, prospectiveTarget) || isPathInside(prospectiveTarget, prospectiveSource))) {
      throw new Error("Der neue Bewerbungsordner darf nicht im bisherigen Ordner liegen.");
    }
    const source = await this.validateRoot(currentRootPath, false);
    const target = await this.validateRoot(nextRootPath, true);
    if (sameWorkspaceRoot(source, target)) return source;
    if (mode !== "new") {
      const existing = await readdir(target);
      if (existing.length) throw new Error("Der neue Bewerbungsordner muss leer sein, damit keine Dateien überschrieben werden.");
      await this.fullBackup(source);
      try {
        for (const file of await listFiles(source)) {
          await copyAndVerify(file, path.join(target, path.relative(source, file)), this.copyOperation);
        }
        const workspacePath = await existingWorkspacePath(target);
        if (await exists(workspacePath)) {
          try {
            const raw = JSON.parse(await readFile(workspacePath, "utf8")) as unknown;
            const parsed = workspaceSchema.safeParse(raw);
            if (!parsed.success && !parseEncryptedWorkspace(raw)) throw new Error("invalid");
          } catch {
            throw new Error("Die Daten im neuen Bewerbungsordner sind ungültig.");
          }
        }
      } catch (error) {
        throw error;
      }
    } else {
      const workspacePath = await existingWorkspacePath(target);
      if (await exists(workspacePath)) {
        try {
          const parsed = workspaceSchema.safeParse(JSON.parse(await readFile(workspacePath, "utf8")));
          if (!parsed.success) throw new Error("invalid");
        } catch {
          throw new Error("Der neue Bewerbungsordner enthält ungültige Daten.");
        }
      }
      await this.fullBackup(source);
      await new FileManagementService(resolveApplicationPaths(target)).initialize();
      await this.preservePersonalData(source, target);
    }
    if (activate) await this.writeBootstrap(target);
    // A move keeps the old root as a recoverable copy. Explicit cleanup can follow separately.
    return target;
  }
}
