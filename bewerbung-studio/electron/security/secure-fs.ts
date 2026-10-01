import * as fs from "node:fs/promises";
import path from "node:path";
import type { EncryptionService } from "./encryption-service";
import { parseEncryptedWorkspace, isEncryptedFileBytes } from "./encryption-service";

let active: { dataRoot: string; service: EncryptionService } | null = null;

export const setActiveEncryption = (root: string, service: EncryptionService) => {
  active = { dataRoot: path.resolve(root, "data"), service };
};

export const clearActiveEncryption = () => { active = null; };
export const activeEncryption = () => active?.service ?? null;

export const isManagedPath = (candidate: string) => {
  if (!active) return false;
  const resolved = path.resolve(candidate);
  return resolved.startsWith(`${active.dataRoot}${path.sep}`);
};

const decodeManagedBytes = (bytes: Buffer) => {
  if (!active) return bytes;
  if (isEncryptedFileBytes(bytes)) return active.service.decryptFile(bytes);
  if (bytes[0] === 0x7b) {
    try {
      const envelope = parseEncryptedWorkspace(JSON.parse(bytes.toString("utf8")));
      if (envelope) return Buffer.from(active.service.decryptWorkspace(envelope), "utf8");
    } catch (error) {
      if (error instanceof Error && error.message.includes("neueren Version")) throw error;
    }
  }
  throw new Error("Eine Datei im verschlüsselten Datenbestand liegt unverschlüsselt oder beschädigt vor.");
};

export const readFile = (async (filePath: string, options?: BufferEncoding | { encoding?: BufferEncoding | null }) => {
  const bytes = await fs.readFile(filePath);
  const content = isManagedPath(filePath) ? decodeManagedBytes(bytes) : bytes;
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding ? content.toString(encoding) : content;
}) as typeof fs.readFile;

export const encodeForManagedWrite = (filePath: string, content: Buffer) => {
  if (!active || !isManagedPath(filePath)) return content;
  if (path.basename(filePath).toLowerCase() === "workspace.json")
    return Buffer.from(active.service.encryptWorkspace(content.toString("utf8")), "utf8");
  return active.service.encryptFile(content);
};

export const writeFile = async (
  filePath: string,
  content: string | Uint8Array,
  options?: BufferEncoding | { encoding?: BufferEncoding; flag?: string; mode?: number },
) => {
  const bytes = typeof content === "string"
    ? Buffer.from(content, typeof options === "string" ? options : options?.encoding ?? "utf8")
    : Buffer.from(content);
  return fs.writeFile(filePath, encodeForManagedWrite(filePath, bytes), typeof options === "object" ? options : undefined);
};

export const copyFile = async (source: string, target: string, mode?: number) => {
  const sourceManaged = isManagedPath(source);
  const targetManaged = isManagedPath(target);
  if (sourceManaged && targetManaged) {
    const raw = await fs.readFile(source);
    decodeManagedBytes(raw);
    return fs.copyFile(source, target, mode);
  }
  if (sourceManaged && !targetManaged) {
    const raw = await fs.readFile(source);
    return fs.writeFile(target, decodeManagedBytes(raw));
  }
  if (!sourceManaged && targetManaged) {
    const raw = await fs.readFile(source);
    return fs.writeFile(target, encodeForManagedWrite(target, raw), { flag: mode ? "wx" : "w" });
  }
  return fs.copyFile(source, target, mode);
};

export const { access, lstat, mkdir, open, readdir, rename, rm, rmdir, stat } = fs;
