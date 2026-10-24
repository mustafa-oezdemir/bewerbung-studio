import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import * as nodeFs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AppError } from "../src/shared/app-error";
import type { InterviewNoteFile } from "../src/shared/ipc";
import {
  compareInterviewNoteNames,
  hasBlockingIssues,
  interviewNoteFileName,
  interviewNoteLimits,
  nextInterviewNoteFileName,
  parseInterviewNoteFileName,
  parseInterviewQuestions,
  serializeInterviewQuestions,
} from "../src/shared/interviewQuestions";
import { localInterviewImagePattern } from "../src/shared/interviewMarkdown";
import { decodeForManagedRead, encodeForManagedWrite, lstat, mkdir, readdir, rm } from "./security/secure-fs";

/**
 * The Markdown files of one interview folder (`data/Vorstellungsgespräch/<Firma>_<Datum>`). The folder comes from
 * `FileManagementService.interviewPath`, never from the renderer; only the note names of `parseInterviewNoteFileName`
 * (`Vorstellungsgespräch_<Firma>[_<n>].md`, older `Vorstellungsgespräch[_<n>].md`) directly inside it are read or
 * written. Contents are never logged.
 */

export const interviewApplicationIdSchema = z.string().trim().min(1).max(200);
export const interviewTextSchema = z.string().max(interviewNoteLimits.maxTextLength);
export const interviewFileNameSchema = z.string().min(1).max(120)
  .refine((value) => parseInterviewNoteFileName(value) !== null);
export const interviewRevisionSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const interviewImageSourceSchema = z.string().max(200).regex(localInterviewImagePattern);

const isWindows = process.platform === "win32";
const samePath = (left: string, right: string) => {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return isWindows ? a.toLowerCase() === b.toLowerCase() : a === b;
};
export const sameInterviewFolder = samePath;

const nodeCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? String(error.code) : "";

const unsafeFolderMessage =
  "Der Vorstellungsgesprächsordner ist eine Verknüpfung oder liegt außerhalb des Bewerbungsordners und wird aus Sicherheitsgründen nicht verwendet.";

const unsafe = () => new AppError("VALIDATION_FAILED", unsafeFolderMessage, { expected: true });

/**
 * The checked interview folder: a real directory directly inside the real `interviewsRoot` (no symbolic link or
 * junction on the way). `create` makes the folder when it is missing; otherwise a missing folder is `null`.
 */
export const resolveInterviewFolder = async (interviewsRoot: string, folder: string, create: boolean) => {
  if (!samePath(path.dirname(path.resolve(folder)), interviewsRoot)) throw unsafe();
  const rootInfo = await lstat(interviewsRoot);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw unsafe();
  let info = await lstat(folder).catch((error: unknown) => {
    if (nodeCode(error) === "ENOENT") return null;
    throw error;
  });
  if (!info) {
    if (!create) return null;
    await mkdir(folder).catch((error: unknown) => {
      if (nodeCode(error) !== "EEXIST") throw error;
    });
    info = await lstat(folder);
  }
  if (info.isSymbolicLink() || !info.isDirectory()) throw unsafe();
  const [realRoot, realFolder] = await Promise.all([nodeFs.realpath(interviewsRoot), nodeFs.realpath(folder)]);
  if (!samePath(realFolder, path.join(realRoot, path.basename(folder)))) throw unsafe();
  return folder;
};

const revisionOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** The revision of a file as stored; an oversized file (never read) is identified by its size and date. */
const fileRevision = async (filePath: string) => {
  const info = await lstat(filePath);
  if (info.size > interviewNoteLimits.maxStoredFileBytes) return revisionOf(Buffer.from(`stat:${info.size}:${info.mtimeMs}`));
  return revisionOf(await nodeFs.readFile(filePath));
};

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** Reads one note: its stored bytes (revision) and its text, or the reason it cannot be shown. */
const readNote = async (folder: string, fileName: string): Promise<InterviewNoteFile & { raw: Buffer | null }> => {
  const filePath = path.join(folder, fileName);
  const info = await lstat(filePath);
  const modifiedAt = info.mtime.toISOString();
  // A file that cannot be shown still has a revision, so it can be deleted (a symbolic link has none).
  const failed = (error: string, revision = "") =>
    ({ fileName, revision, modifiedAt, content: null, error, raw: null });
  if (info.isSymbolicLink() || !info.isFile())
    return failed(`„${fileName}“ ist keine normale Datei und wird aus Sicherheitsgründen nicht geöffnet.`);
  if (info.size > interviewNoteLimits.maxStoredFileBytes)
    return failed(`„${fileName}“ ist größer als ${interviewNoteLimits.maxFileBytes / 1024 / 1024} MB und wird nicht geöffnet.`,
      await fileRevision(filePath));
  const raw = await nodeFs.readFile(filePath);
  let plain: Buffer;
  try {
    plain = decodeForManagedRead(filePath, raw);
  } catch {
    return failed(`„${fileName}“ ist beschädigt oder kann nicht entschlüsselt werden. Die Datei wird nicht überschrieben.`,
      revisionOf(raw));
  }
  if (plain.length > interviewNoteLimits.maxFileBytes)
    return failed(`„${fileName}“ ist größer als ${interviewNoteLimits.maxFileBytes / 1024 / 1024} MB und wird nicht geöffnet.`,
      revisionOf(raw));
  let content: string;
  try {
    content = utf8.decode(plain);
  } catch {
    return failed(`„${fileName}“ ist keine gültige UTF-8-Textdatei. Die Datei wird nicht überschrieben.`, revisionOf(raw));
  }
  return { fileName, revision: revisionOf(raw), modifiedAt, content, error: null, raw };
};

const publicNote = ({ raw: _raw, ...file }: InterviewNoteFile & { raw: Buffer | null }): InterviewNoteFile => file;

/** The note files of a folder: older names first, then per company part in numeric order (`_2` before `_10`). */
const noteEntries = async (folder: string) => (await readdir(folder))
  .filter((name) => parseInterviewNoteFileName(name) !== null)
  .sort(compareInterviewNoteNames)
  .map((name) => ({ name }));

export const listInterviewNoteFiles = async (interviewsRoot: string, folder: string): Promise<InterviewNoteFile[]> => {
  const resolved = await resolveInterviewFolder(interviewsRoot, folder, false);
  if (!resolved) return [];
  const entries = (await noteEntries(resolved)).slice(0, interviewNoteLimits.maxFiles);
  const files: InterviewNoteFile[] = [];
  for (const entry of entries) files.push(publicNote(await readNote(resolved, entry.name)));
  return files;
};

/** Parses the text, refuses blocking issues and returns the canonical Markdown the app saves. */
export const interviewMarkdownFromText = (text: string) => {
  const result = parseInterviewQuestions(text);
  if (hasBlockingIssues(result)) {
    const first = result.issues.find((issue) => issue.severity === "error");
    throw new AppError(
      "VALIDATION_FAILED",
      `Die Fragen wurden nicht gespeichert: ${first?.message ?? "Es wurde keine Frage erkannt."}`,
      { expected: true },
    );
  }
  return serializeInterviewQuestions(result.questions, result);
};

const writeFailed = (fileName: string, error: unknown) => new AppError(
  ["EBUSY", "EPERM", "EACCES"].includes(nodeCode(error)) ? "FILE_LOCKED" : "INTERNAL_ERROR",
  `„${fileName}“ konnte nicht gespeichert werden. Vorhandene Inhalte bleiben unverändert. ` +
    (["EBUSY", "EPERM", "EACCES"].includes(nodeCode(error))
      ? "Bitte schließen Sie die Datei in anderen Programmen und versuchen Sie es erneut."
      : nodeCode(error) === "ENOSPC" ? "Auf dem Laufwerk ist nicht genügend Speicherplatz frei." : "Bitte versuchen Sie es erneut."),
  { expected: true, cause: error },
);

/** Writes the encoded bytes to a new temporary file next to the target (`*.tmp` stays out of Git) and syncs it. */
const writeTemporary = async (folder: string, bytes: Buffer) => {
  const temporary = path.join(folder, `.${randomUUID()}.tmp`);
  const handle = await nodeFs.open(temporary, "wx");
  try {
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return temporary;
};

/**
 * A new note under the next free name of the company (`interviewCompanySlug`): `Vorstellungsgespräch_<Firma>.md`,
 * then `_1`, `_2` … one above the highest (names in any letter case count, Windows treats them as one file). The
 * complete file is installed with an exclusive hard link (or an exclusive copy where links are not supported), so an
 * existing file is never overwritten, even by a file created at the same moment.
 */
export const createInterviewNoteFile = async (
  interviewsRoot: string,
  folder: string,
  markdown: string,
  company: string | null,
) => {
  const resolved = (await resolveInterviewFolder(interviewsRoot, folder, true))!;
  const firstName = interviewNoteFileName(company, 0);
  const bytes = encodeForManagedWrite(path.join(resolved, firstName), Buffer.from(markdown, "utf8"));
  let temporary: string;
  try {
    temporary = await writeTemporary(resolved, bytes);
  } catch (error) {
    throw writeFailed(firstName, error);
  }
  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const fileName = nextInterviewNoteFileName(company, await readdir(resolved));
      const target = path.join(resolved, fileName);
      try {
        try {
          await nodeFs.link(temporary, target);
        } catch (error) {
          if (!["EPERM", "ENOTSUP", "ENOSYS", "EXDEV", "EINVAL"].includes(nodeCode(error))) throw error;
          await nodeFs.copyFile(temporary, target, constants.COPYFILE_EXCL);
        }
      } catch (error) {
        if (nodeCode(error) === "EEXIST") continue;
        throw writeFailed(fileName, error);
      }
      return publicNote(await readNote(resolved, fileName));
    }
    throw new AppError("INTERNAL_ERROR", "Es konnte kein freier Dateiname gefunden werden.", { expected: true });
  } finally {
    await rm(temporary, { force: true });
  }
};

/**
 * Replaces exactly this note when it is still the revision the user edited. The new content goes to a temporary
 * file first and replaces the note in one rename: a failed write leaves the old file as it was.
 */
export const updateInterviewNoteFile = async (
  interviewsRoot: string,
  folder: string,
  fileName: string,
  markdown: string,
  expectedRevision: string,
): Promise<{ file: InterviewNoteFile; changed: boolean }> => {
  const notFound = () => new AppError(
    "RESOURCE_NOT_FOUND",
    `„${fileName}“ wurde im Vorstellungsgesprächsordner nicht gefunden. Bitte laden Sie die Liste neu.`,
    { expected: true },
  );
  const resolved = await resolveInterviewFolder(interviewsRoot, folder, false);
  if (!resolved || parseInterviewNoteFileName(fileName) === null) throw notFound();
  // Exactly a name the folder lists: no separator, no "..", no other spelling.
  if (!(await readdir(resolved)).includes(fileName)) throw notFound();
  const current = await readNote(resolved, fileName);
  if (current.error !== null || current.raw === null) {
    throw new AppError("VALIDATION_FAILED", current.error ?? `„${fileName}“ kann nicht gelesen werden.`, { expected: true });
  }
  const changedOutside = () => new AppError(
    "VALIDATION_FAILED",
    `„${fileName}“ wurde inzwischen außerhalb dieser Ansicht geändert und wurde nicht überschrieben. Bitte laden Sie die Datei neu.`,
    { expected: true },
  );
  if (current.revision !== expectedRevision) throw changedOutside();
  if (current.content === markdown) return { file: publicNote(current), changed: false };

  const target = path.join(resolved, fileName);
  const bytes = encodeForManagedWrite(target, Buffer.from(markdown, "utf8"));
  let temporary: string | null = null;
  try {
    temporary = await writeTemporary(resolved, bytes);
    if (revisionOf(await nodeFs.readFile(target)) !== expectedRevision) throw changedOutside();
    await nodeFs.rename(temporary, target);
    temporary = null;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw writeFailed(fileName, error);
  } finally {
    if (temporary) await rm(temporary, { force: true });
  }
  return { file: publicNote(await readNote(resolved, fileName)), changed: true };
};

/** The path of exactly this note for opening it in another program: a listed, regular file of the folder. */
export const interviewNoteFilePath = async (interviewsRoot: string, folder: string, fileName: string) => {
  const notFound = () => new AppError(
    "RESOURCE_NOT_FOUND",
    `„${fileName}“ wurde im Vorstellungsgesprächsordner nicht gefunden. Bitte laden Sie die Liste neu.`,
    { expected: true },
  );
  const resolved = await resolveInterviewFolder(interviewsRoot, folder, false);
  if (!resolved || parseInterviewNoteFileName(fileName) === null) throw notFound();
  if (!(await readdir(resolved)).includes(fileName)) throw notFound();
  const target = path.join(resolved, fileName);
  const info = await lstat(target);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new AppError("VALIDATION_FAILED", `„${fileName}“ ist keine normale Datei und wird nicht geöffnet.`, { expected: true });
  }
  return target;
};

const timestamp = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
};

/**
 * Deletes exactly this note when it is still the revision the user saw: the file leaves the interview folder and is
 * kept (bytes unchanged, encrypted stays encrypted) in `archiveRoot/<interview folder>/<name>_gelöscht_<time>.md`.
 * A damaged file can be deleted as well; a symbolic link is never touched.
 */
export const removeInterviewNoteFile = async (
  interviewsRoot: string,
  folder: string,
  fileName: string,
  expectedRevision: string,
  archiveRoot: string,
): Promise<{ archivedAs: string }> => {
  const notFound = () => new AppError(
    "RESOURCE_NOT_FOUND",
    `„${fileName}“ wurde im Vorstellungsgesprächsordner nicht gefunden. Bitte laden Sie die Liste neu.`,
    { expected: true },
  );
  const resolved = await resolveInterviewFolder(interviewsRoot, folder, false);
  if (!resolved || parseInterviewNoteFileName(fileName) === null) throw notFound();
  if (!(await readdir(resolved)).includes(fileName)) throw notFound();
  const target = path.join(resolved, fileName);
  const info = await lstat(target);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new AppError("VALIDATION_FAILED", `„${fileName}“ ist keine normale Datei und wird nicht gelöscht.`, { expected: true });
  }
  if (await fileRevision(target) !== expectedRevision) {
    throw new AppError(
      "VALIDATION_FAILED",
      `„${fileName}“ wurde inzwischen außerhalb dieser Ansicht geändert und wurde nicht gelöscht. Bitte laden Sie die Datei neu.`,
      { expected: true },
    );
  }
  const archiveFolder = path.join(archiveRoot, path.basename(resolved));
  const baseName = `${path.parse(fileName).name}_gelöscht_${timestamp()}`;
  try {
    await mkdir(archiveFolder, { recursive: true });
    for (let suffix = 1; suffix < 100; suffix += 1) {
      const archived = path.join(archiveFolder, `${baseName}${suffix === 1 ? "" : `_${suffix}`}.md`);
      // Never replace an archived file: link exclusively, then remove the note (the same bytes stay in the archive).
      try {
        await nodeFs.link(target, archived);
      } catch (error) {
        if (nodeCode(error) === "EEXIST") continue;
        if (!["EPERM", "ENOTSUP", "ENOSYS", "EXDEV", "EINVAL"].includes(nodeCode(error))) throw error;
        try {
          await nodeFs.copyFile(target, archived, constants.COPYFILE_EXCL);
        } catch (copyError) {
          if (nodeCode(copyError) === "EEXIST") continue;
          throw copyError;
        }
      }
      await rm(target);
      return { archivedAs: path.join(path.basename(archiveRoot), path.basename(archiveFolder), path.basename(archived)) };
    }
    throw new AppError("INTERNAL_ERROR", "Es konnte kein freier Archivname gefunden werden.", { expected: true });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      ["EBUSY", "EPERM", "EACCES"].includes(nodeCode(error)) ? "FILE_LOCKED" : "INTERNAL_ERROR",
      `„${fileName}“ konnte nicht gelöscht werden. Die Datei bleibt unverändert im Ordner. ` +
        (["EBUSY", "EPERM", "EACCES"].includes(nodeCode(error))
          ? "Bitte schließen Sie die Datei in anderen Programmen und versuchen Sie es erneut."
          : "Bitte versuchen Sie es erneut."),
      { expected: true, cause: error },
    );
  }
};
