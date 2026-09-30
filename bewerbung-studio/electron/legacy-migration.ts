import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import type { ApplicationPaths } from "../src/config/application-paths";
import type { LegacyMigrationPreview } from "../src/shared/ipc";
import {
  workspaceSchema,
  type Attachment,
  type Workspace,
} from "../src/shared/schema";
import {
  FileManagementService,
  isPathInside,
  sanitizeFileName,
} from "./file-management";

const pathExists = async (candidate: string) => {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
};

const filesAreEqual = async (left: string, right: string) => {
  const [leftInfo, rightInfo] = await Promise.all([stat(left), stat(right)]);
  if (leftInfo.size !== rightInfo.size) return false;
  const [leftBytes, rightBytes] = await Promise.all([
    readFile(left),
    readFile(right),
  ]);
  return leftBytes.equals(rightBytes);
};

const uniqueFilePath = async (requestedPath: string) => {
  if (!(await pathExists(requestedPath))) return requestedPath;
  const extension = path.extname(requestedPath);
  const baseName = path.basename(requestedPath, extension);
  const directory = path.dirname(requestedPath);
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = path.join(directory, `${baseName}_${suffix}${extension}`);
    if (!(await pathExists(candidate))) return candidate;
  }
  throw new Error(`Für „${requestedPath}“ konnte kein eindeutiger Dateiname erzeugt werden.`);
};

const listFiles = async (root: string) => {
  const files: string[] = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(candidate);
      if (entry.isFile()) files.push(candidate);
    }
  }
  return files;
};

const copyFileWithoutOverwrite = async (
  source: string,
  requestedTarget: string,
) => {
  await mkdir(path.dirname(requestedTarget), { recursive: true });
  if (await pathExists(requestedTarget)) {
    if (await filesAreEqual(source, requestedTarget)) return requestedTarget;
    const uniqueTarget = await uniqueFilePath(requestedTarget);
    await copyFile(source, uniqueTarget);
    return uniqueTarget;
  }
  await copyFile(source, requestedTarget);
  return requestedTarget;
};

const copyDirectoryWithoutOverwrite = async (
  sourceRoot: string,
  targetRoot: string,
  shouldCopy: (relativePath: string) => boolean = () => true,
) => {
  if (!(await pathExists(sourceRoot))) return;
  for (const sourceFile of await listFiles(sourceRoot)) {
    const relativePath = path.relative(sourceRoot, sourceFile);
    if (!shouldCopy(relativePath)) continue;
    if (!isPathInside(sourceRoot, sourceFile)) {
      throw new Error("Ungültiger Migrationsquellpfad.");
    }
    await copyFileWithoutOverwrite(
      sourceFile,
      path.join(targetRoot, relativePath),
    );
  }
};

const legacyApplicationDocumentDirectories = new Set([
  "Anschreiben",
  "Lebenslauf",
  "Zeugnisse",
  "Zertifikate",
]);

const isApplicationDataFile = (
  relativePath: string,
  applicationFolderNames: string[],
) => {
  // Folder names are stored with `/`; the relative path uses the separator of the platform.
  const native = (folderName: string) => folderName.split(/[\\/]+/).join(path.sep);
  const applicationFolder = [...applicationFolderNames]
    .map(native)
    .sort((left, right) => right.length - left.length)
    .find(
      (folderName) =>
        relativePath === folderName ||
        relativePath.startsWith(`${folderName}${path.sep}`),
    );
  if (!applicationFolder) return true;
  const applicationRelativePath = path.relative(
    applicationFolder,
    relativePath,
  );
  const [applicationSubdirectory] = applicationRelativePath.split(path.sep);
  return !legacyApplicationDocumentDirectories.has(applicationSubdirectory);
};

export class LegacyMigrationService {
  private readonly files: FileManagementService;

  constructor(private readonly paths: ApplicationPaths) {
    this.files = new FileManagementService(paths);
  }

  private async readWorkspace(sourcePath: string) {
    const resolvedSource = path.resolve(sourcePath);
    if (
      resolvedSource === this.paths.dataRoot ||
      isPathInside(this.paths.root, resolvedSource)
    ) {
      throw new Error("Der Migrationsquellordner muss außerhalb des neuen Hauptordners liegen.");
    }
    const workspaceCandidates = [
      path.join(resolvedSource, "Setting", "Settings", "workspace.json"),
      path.join(resolvedSource, "Settings", "workspace.json"),
    ];
    const workspacePath =
      (await Promise.all(
        workspaceCandidates.map(async (candidate) => ({
          candidate,
          exists: await pathExists(candidate),
        })),
      )).find((item) => item.exists)?.candidate ?? workspaceCandidates[0];
    const parsed: unknown = JSON.parse(await readFile(workspacePath, "utf8"));
    return {
      sourcePath: resolvedSource,
      workspace: workspaceSchema.parse(parsed),
    };
  }

  async preview(sourcePath: string): Promise<LegacyMigrationPreview> {
    const source = await this.readWorkspace(sourcePath);
    const files = await listFiles(source.sourcePath);
    let totalBytes = 0;
    for (const file of files) totalBytes += (await stat(file)).size;
    return {
      sourcePath: source.sourcePath,
      fileCount: files.length,
      totalBytes,
      applications: source.workspace.applications.length,
      attachments: source.workspace.attachments.length,
    };
  }

  private async copyLegacyData(sourcePath: string, workspace: Workspace) {
    const directDataDirectories: Array<[string[], string]> = [
      [["Bewerbungen"], this.paths.applicationsData],
      [["Setting", "Muster"], this.paths.musterRoot],
      [["Setting", "Profile"], this.paths.profileRoot],
      [["Setting", "Backups"], this.paths.backupsRoot],
    ];
    for (const [segments, target] of directDataDirectories) {
      const legacySegments = [segments.at(-1)!];
      const canonicalSource = path.join(sourcePath, ...segments);
      const source = (await pathExists(canonicalSource))
        ? canonicalSource
        : path.join(sourcePath, ...legacySegments);
      await copyDirectoryWithoutOverwrite(
        source,
        target,
        segments[0] === "Bewerbungen"
          ? (relativePath) =>
              isApplicationDataFile(
                relativePath,
                workspace.applications.map(
                  (application) => application.folderName,
                ),
              )
          : undefined,
      );
    }
    await copyDirectoryWithoutOverwrite(
      (await pathExists(path.join(sourcePath, "Setting", "Settings")))
        ? path.join(sourcePath, "Setting", "Settings")
        : path.join(sourcePath, "Settings"),
      this.paths.settingsRoot,
      (relativePath) =>
        !["workspace.json", "workspace.json.bak"].includes(relativePath),
    );
    await copyDirectoryWithoutOverwrite(
      path.join(sourcePath, "Anschreiben"),
      path.join(this.paths.anschreibenDocuments, "Bestand"),
    );
    await copyDirectoryWithoutOverwrite(
      path.join(sourcePath, "Lebenslauf"),
      path.join(this.paths.lebenslaufDocuments, "Bestand"),
    );
    await copyDirectoryWithoutOverwrite(
      path.join(sourcePath, "Zeugnisse"),
      this.paths.zeugnisseArchive,
    );
    await copyDirectoryWithoutOverwrite(
      path.join(sourcePath, "Zertifikate"),
      this.paths.zertifikateArchive,
    );
  }

  private async migrateApplicationDocuments(
    sourcePath: string,
    workspace: Workspace,
  ) {
    for (const application of workspace.applications) {
      const legacyRoot = path.join(
        sourcePath,
        "Bewerbungen",
        application.folderName,
      );
      const targetDirectories = this.files.documentDirectories(application);
      await copyDirectoryWithoutOverwrite(
        path.join(legacyRoot, "Anschreiben"),
        targetDirectories.anschreiben,
      );
      await copyDirectoryWithoutOverwrite(
        path.join(legacyRoot, "Lebenslauf"),
        targetDirectories.lebenslauf,
      );
    }
  }

  private async migrateAttachment(
    sourcePath: string,
    workspace: Workspace,
    attachment: Attachment,
  ) {
    if (attachment.archiveRelativePath) return attachment;
    if (!attachment.storedName) return attachment;
    const application = workspace.applications.find(
      (item) => item.id === attachment.applicationId,
    );
    if (!application) return attachment;
    const legacyFile = path.join(
      sourcePath,
      "Bewerbungen",
      application.folderName,
      attachment.category,
      attachment.storedName,
    );
    if (!(await pathExists(legacyFile))) return attachment;
    const archiveRoot = this.files.archiveRootForCategory(attachment.category);
    const requestedTarget = path.join(
      archiveRoot,
      sanitizeFileName(attachment.fileName),
    );
    const target = await copyFileWithoutOverwrite(legacyFile, requestedTarget);
    return {
      ...attachment,
      archiveRelativePath: path.relative(archiveRoot, target),
    };
  }

  async migrate(sourcePath: string): Promise<Workspace> {
    const source = await this.readWorkspace(sourcePath);
    await this.files.initialize();
    await this.copyLegacyData(source.sourcePath, source.workspace);
    await this.migrateApplicationDocuments(source.sourcePath, source.workspace);
    const attachments = await Promise.all(
      source.workspace.attachments.map((attachment) =>
        this.migrateAttachment(
          source.sourcePath,
          source.workspace,
          attachment,
        ),
      ),
    );
    return workspaceSchema.parse({
      ...source.workspace,
      attachments,
    });
  }
}
