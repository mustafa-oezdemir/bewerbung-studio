import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { workspaceSchema } from "../../src/shared/schema";
import { EncryptionService, encryptedWorkspaceSchema, isEncryptedFileBytes, parseEncryptedWorkspace } from "./encryption-service";

const journalSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  direction: z.enum(["enable", "disable"]),
  startedAt: z.iso.datetime(),
  stageName: z.string().regex(/^\.encryption-stage-[0-9a-f-]+$/),
  files: z.array(z.string().min(1)),
  envelope: encryptedWorkspaceSchema,
}).strict();
export type MigrationJournal = z.infer<typeof journalSchema>;

const workspacePath = (root: string) => path.join(root, "data", "Setting", "Settings", "workspace.json");
const journalPath = (root: string) => path.join(root, "data", "Setting", "Settings", "encryption-migration.json");

const filesInDataRoot = async (root: string) => {
  const data = path.join(root, "data");
  const files: string[] = [];
  const pending = [data];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("Symbolische Verknüpfungen im Datenordner verhindern eine sichere Umstellung.");
      const candidate = path.join(current, entry.name);
      if (candidate === journalPath(root)) continue;
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile()) files.push(path.relative(root, candidate));
    }
  }
  return files.sort((left, right) => left === path.relative(root, workspacePath(root)) ? 1 : right === path.relative(root, workspacePath(root)) ? -1 : left.localeCompare(right));
};

const atomicRawWrite = async (filePath: string, bytes: Buffer) => {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporary, bytes);
  await rename(temporary, filePath);
};

export const readMigrationJournal = async (root: string) => {
  const raw = await readFile(journalPath(root), "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!raw) return null;
  const journal = journalSchema.parse(JSON.parse(raw));
  const dataRoot = path.resolve(root, "data");
  for (const relative of journal.files) {
    const target = path.resolve(root, relative);
    if (path.isAbsolute(relative) || !target.startsWith(`${dataRoot}${path.sep}`) ||
        target === journalPath(root) || relative.split(/[\\/]/).includes(".."))
      throw new Error("Das Verschlüsselungsjournal enthält einen ungültigen Dateipfad.");
  }
  return journal;
};

export const readEncryptionEnvelope = async (root: string) => {
  const raw = JSON.parse(await readFile(workspacePath(root), "utf8")) as unknown;
  return parseEncryptedWorkspace(raw);
};

const fileIsInTargetFormat = (bytes: Buffer, direction: MigrationJournal["direction"]) => {
  if (direction === "enable") {
    if (isEncryptedFileBytes(bytes)) return true;
    if (bytes[0] === 0x7b) {
      try { return parseEncryptedWorkspace(JSON.parse(bytes.toString("utf8"))) !== null; }
      catch { return false; }
    }
    return false;
  }
  return !isEncryptedFileBytes(bytes) && !(bytes[0] === 0x7b && (() => {
    try { return parseEncryptedWorkspace(JSON.parse(bytes.toString("utf8"))) !== null; }
    catch { return false; }
  })());
};

const activeWorkspaceRelative = path.join("data", "Setting", "Settings", "workspace.json");

const plaintextOfEncrypted = (raw: Buffer, service: EncryptionService) => {
  if (isEncryptedFileBytes(raw)) return service.decryptFile(raw);
  const envelope = parseEncryptedWorkspace(JSON.parse(raw.toString("utf8")));
  if (!envelope) throw new Error("Eine verschlüsselte Datei ist beschädigt.");
  return Buffer.from(service.decryptWorkspace(envelope), "utf8");
};

const isVerifiedTargetFormat = (bytes: Buffer, direction: MigrationJournal["direction"], service: EncryptionService) => {
  if (!fileIsInTargetFormat(bytes, direction)) return false;
  if (direction === "disable") return true;
  try { plaintextOfEncrypted(bytes, service); return true; }
  catch { return false; }
};

const convertFile = (relative: string, raw: Buffer, journal: MigrationJournal, service: EncryptionService) => {
  // The active workspace is committed last and keeps the portable key envelope.
  if (journal.direction === "enable") {
    if (relative === activeWorkspaceRelative || relative === `${activeWorkspaceRelative}.bak`) {
      workspaceSchema.parse(JSON.parse(raw.toString("utf8")));
      return Buffer.from(service.encryptWorkspace(raw.toString("utf8")), "utf8");
    }
    return service.encryptFile(raw);
  }
  return plaintextOfEncrypted(raw, service);
};

const stageAndCommit = async (root: string, journal: MigrationJournal, service: EncryptionService) => {
  const stageRoot = path.join(root, journal.stageName);
  const stageInfo = await lstat(stageRoot).catch(() => null);
  if (stageInfo && (!stageInfo.isDirectory() || stageInfo.isSymbolicLink()))
    throw new Error("Der temporäre Verschlüsselungsordner ist ungültig.");
  await mkdir(stageRoot, { recursive: true });
  for (const relative of journal.files) {
    const original = path.join(root, relative);
    const staged = path.join(stageRoot, relative);
    const originalInfo = await lstat(original);
    if (!originalInfo.isFile() || originalInfo.isSymbolicLink())
      throw new Error("Eine Quelldatei der Verschlüsselungsumstellung ist ungültig.");
    const current = await readFile(original);
    if (isVerifiedTargetFormat(current, journal.direction, service)) continue;
    const stagedInfo = await lstat(staged).catch(() => null);
    if (!stagedInfo?.isFile()) {
      const converted = convertFile(relative, current, journal, service);
      await mkdir(path.dirname(staged), { recursive: true });
      await writeFile(staged, converted, { flag: "wx" });
    }
    const stagedBytes = await readFile(staged);
    const stagedPlain = journal.direction === "enable" ? plaintextOfEncrypted(stagedBytes, service) : stagedBytes;
    const originalPlain = journal.direction === "enable" ? current : plaintextOfEncrypted(current, service);
    if (createHash("sha256").update(stagedPlain).digest("hex") !== createHash("sha256").update(originalPlain).digest("hex"))
      throw new Error("Eine Datei der Verschlüsselungsumstellung konnte nicht geprüft werden.");
  }
  for (const relative of journal.files) {
    const original = path.join(root, relative);
    const staged = path.join(stageRoot, relative);
    const originalInfo = await lstat(original);
    if (!originalInfo.isFile() || originalInfo.isSymbolicLink())
      throw new Error("Eine Quelldatei der Verschlüsselungsumstellung ist ungültig.");
    const current = await readFile(original);
    if (isVerifiedTargetFormat(current, journal.direction, service)) continue;
    const stagedBytes = await readFile(staged);
    const stagedPlain = journal.direction === "enable" ? plaintextOfEncrypted(stagedBytes, service) : stagedBytes;
    const originalPlain = journal.direction === "enable" ? current : plaintextOfEncrypted(current, service);
    if (createHash("sha256").update(stagedPlain).digest("hex") !== createHash("sha256").update(originalPlain).digest("hex"))
      throw new Error("Eine Datei der Verschlüsselungsumstellung konnte nicht geprüft werden.");
    await rename(staged, original);
  }
  for (const relative of await filesInDataRoot(root)) {
    if (!isVerifiedTargetFormat(await readFile(path.join(root, relative)), journal.direction, service))
      throw new Error("Die Verschlüsselungsumstellung ist nicht vollständig. Der Datenbestand bleibt für die Wiederaufnahme gesperrt.");
  }
  await rm(stageRoot, { recursive: true, force: true });
  await rm(journalPath(root), { force: true });
};

export const enableWorkspaceEncryption = async (root: string, service: EncryptionService) => {
  if (await readMigrationJournal(root)) throw new Error("Eine Verschlüsselungsumstellung muss zuerst abgeschlossen werden.");
  const envelope = service.currentEnvelope;
  const files = await filesInDataRoot(root);
  const journal: MigrationJournal = {
    version: 1, id: randomUUID(), direction: "enable", startedAt: new Date().toISOString(),
    stageName: `.encryption-stage-${randomUUID()}`, files, envelope,
  };
  await atomicRawWrite(journalPath(root), Buffer.from(JSON.stringify(journal, null, 2)));
  await stageAndCommit(root, journal, service);
};

export const disableWorkspaceEncryption = async (root: string, service: EncryptionService) => {
  if (await readMigrationJournal(root)) throw new Error("Eine Verschlüsselungsumstellung muss zuerst abgeschlossen werden.");
  const files = await filesInDataRoot(root);
  const journal: MigrationJournal = {
    version: 1, id: randomUUID(), direction: "disable", startedAt: new Date().toISOString(),
    stageName: `.encryption-stage-${randomUUID()}`, files, envelope: service.currentEnvelope,
  };
  await atomicRawWrite(journalPath(root), Buffer.from(JSON.stringify(journal, null, 2)));
  await stageAndCommit(root, journal, service);
};

export const resumeWorkspaceEncryptionMigration = async (root: string, service: EncryptionService) => {
  const journal = await readMigrationJournal(root);
  if (!journal) return null;
  await stageAndCommit(root, journal, service);
  return journal.direction;
};

export const rollbackUncommittedMigration = async (root: string) => {
  const journal = await readMigrationJournal(root);
  if (!journal) return false;
  for (const relative of journal.files) {
    const bytes = await readFile(path.join(root, relative));
    if (fileIsInTargetFormat(bytes, journal.direction)) return false;
  }
  await rm(path.join(root, journal.stageName), { recursive: true, force: true });
  await rm(journalPath(root), { force: true });
  return true;
};
