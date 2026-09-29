import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveApplicationPaths, DEFAULT_BEWERBUNG_ROOT_PATH, BEWERBUNG_ROOT_PATH_ENV } from "../src/config/application-paths";
import { workspaceSchema } from "../src/shared/schema";
import { FileManagementService, isPathInside } from "./file-management";
import type { WorkspaceChangeMode, WorkspaceStatus } from "../src/shared/ipc";

const bootstrapSchema = z.object({
  workspaceRootPath: z.string().min(1),
  setupCompleted: z.literal(true),
});

const exists = async (candidate: string) => {
  try { await stat(candidate); return true; } catch { return false; }
};

const hashFile = async (filePath: string) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
};

const timestamp = () => new Date().toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19);

const listFiles = async (root: string, excluded?: string): Promise<string[]> => {
  const files: string[] = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (excluded && isPathInside(excluded, candidate)) continue;
      if (entry.isSymbolicLink()) throw new Error("Verknüpfungen im Bewerbungsordner können nicht sicher kopiert werden.");
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile()) files.push(candidate);
    }
  }
  return files.sort();
};

const copyAndVerify = async (source: string, target: string) => {
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target, constants.COPYFILE_EXCL);
  const [sourceInfo, targetInfo] = await Promise.all([stat(source), stat(target)]);
  const [sourceHash, targetHash] = await Promise.all([hashFile(source), hashFile(target)]);
  if (sourceInfo.size !== targetInfo.size || sourceHash !== targetHash) {
    throw new Error(`Kopie konnte nicht geprüft werden: ${path.basename(source)}`);
  }
  return { size: sourceInfo.size, sha256: targetHash };
};

export class WorkspaceManager {
  readonly bootstrapPath: string;

  constructor(
    private readonly userDataPath: string,
    private readonly environment: Record<string, string | undefined> = process.env,
    private readonly legacyRootPath = DEFAULT_BEWERBUNG_ROOT_PATH,
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
    const workspacePath = path.join(candidate, "data", "Settings", "workspace.json");
    const backupPath = `${workspacePath}.bak`;
    if (!(await exists(workspacePath)) && !(await exists(backupPath))) {
      return null;
    }
    await this.writeBootstrap(candidate);
    return candidate;
  }

  private async readWorkspace(root: string) {
    const workspacePath = path.join(root, "data", "Settings", "workspace.json");
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
    const workspacePath = path.join(target, "data", "Settings", "workspace.json");
    const temporary = `${workspacePath}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(workspacePath), { recursive: true });
    await writeFile(temporary, JSON.stringify(nextWorkspace, null, 2), "utf8");
    await rename(temporary, workspacePath);

    const sourceProfileDirectory = path.join(source, "data", "Profile");
    if (!(await exists(sourceProfileDirectory))) return;
    for (const sourceFile of await listFiles(sourceProfileDirectory)) {
      const targetFile = path.join(
        target,
        "data",
        "Profile",
        path.relative(sourceProfileDirectory, sourceFile),
      );
      if (!(await exists(targetFile))) await copyAndVerify(sourceFile, targetFile);
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
      const workspacePath = path.join(root, "data", "Settings", "workspace.json");
      if (!(await exists(workspacePath)) && !(await exists(`${workspacePath}.bak`))) {
        return {
          state: "error", root,
          message: "Die gespeicherten Bewerbungsdaten wurden in diesem Ordner nicht gefunden. Der Ordner wurde nicht verändert.",
        };
      }
      return { state: "ready", root };
    }
    // Existing installations must retain their original data without a setup prompt.
    const legacyRoot = path.resolve(this.legacyRootPath);
    if (await exists(path.join(legacyRoot, "data", "Settings", "workspace.json"))) {
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
    const workspacePath = path.join(root, "data", "Settings", "workspace.json");
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

  async activate(root: string) {
    await this.writeBootstrap(path.resolve(root));
  }

  async fullBackup(rootPath: string, oldSchemaVersion = 1, newSchemaVersion = 1, migratedFields: string[] = []) {
    const root = await this.validateRoot(rootPath, false);
    const backupRoot = path.join(root, "data", "Backups", `Migration_${timestamp()}_${randomUUID().slice(0, 8)}`);
    await mkdir(backupRoot, { recursive: true });
    const entries: Array<{ path: string; size: number; sha256: string }> = [];
    try {
      for (const source of await listFiles(root, backupRoot)) {
        const relative = path.relative(root, source);
        const target = path.join(backupRoot, relative);
        const verified = await copyAndVerify(source, target);
        entries.push({ path: relative, ...verified });
      }
      const workspaceSource = path.join(root, "data", "Settings", "workspace.json");
      if (await exists(workspaceSource) && !(await exists(path.join(backupRoot, "workspace.json")))) {
        await copyAndVerify(workspaceSource, path.join(backupRoot, "workspace.json"));
      }
      const manifest = {
        migratedAt: new Date().toISOString(), oldSchemaVersion, newSchemaVersion,
        sourcePath: root, backupPath: backupRoot, migratedFields,
        warnings: [], errors: [], files: entries,
      };
      await writeFile(path.join(backupRoot, "migration-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
      return backupRoot;
    } catch (error) {
      await rm(backupRoot, { recursive: true, force: true });
      throw error;
    }
  }

  async changeRoot(currentRootPath: string, nextRootPath: string, mode: WorkspaceChangeMode) {
    if (!["move", "copy", "new"].includes(mode)) throw new Error("Ungültige Speicherort-Aktion.");
    if (!path.isAbsolute(nextRootPath)) throw new Error("Bitte wählen Sie einen gültigen Ordner.");
    const prospectiveSource = path.resolve(currentRootPath);
    const prospectiveTarget = path.resolve(nextRootPath);
    if (prospectiveSource !== prospectiveTarget &&
      (isPathInside(prospectiveSource, prospectiveTarget) || isPathInside(prospectiveTarget, prospectiveSource))) {
      throw new Error("Der neue Bewerbungsordner darf nicht im bisherigen Ordner liegen.");
    }
    const source = await this.validateRoot(currentRootPath, false);
    const target = await this.validateRoot(nextRootPath, true);
    if (source === target) return target;
    if (mode !== "new") {
      const existing = await readdir(target);
      if (existing.length) throw new Error("Der neue Bewerbungsordner muss leer sein, damit keine Dateien überschrieben werden.");
      await this.fullBackup(source);
      try {
        for (const file of await listFiles(source)) {
          await copyAndVerify(file, path.join(target, path.relative(source, file)));
        }
        const workspacePath = path.join(target, "data", "Settings", "workspace.json");
        if (await exists(workspacePath)) {
          try {
            const parsed = workspaceSchema.safeParse(JSON.parse(await readFile(workspacePath, "utf8")));
            if (!parsed.success) throw new Error("invalid");
          } catch {
            throw new Error("Die Daten im neuen Bewerbungsordner sind ungültig.");
          }
        }
      } catch (error) {
        throw error;
      }
    } else {
      const workspacePath = path.join(target, "data", "Settings", "workspace.json");
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
    await this.writeBootstrap(target);
    // A move keeps the old root as a recoverable copy. Explicit cleanup can follow separately.
    return target;
  }
}
