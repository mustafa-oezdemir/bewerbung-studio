import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { workspaceSchema } from "../../src/shared/schema";
import { EncryptionService, parseEncryptedWorkspace } from "./encryption-service";
import {
  disableWorkspaceEncryption,
  enableWorkspaceEncryption,
  readEncryptionEnvelope,
  readMigrationJournal,
  resumeWorkspaceEncryptionMigration,
} from "./workspace-encryption";

const workspacePath = (root: string) => path.join(root, "data", "Setting", "Settings", "workspace.json");

const writeAtomic = async (filePath: string, value: string) => {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporary, value, "utf8");
  await rename(temporary, filePath);
};

export class WorkspaceSecurity {
  private current: EncryptionService | null = null;
  constructor(readonly root: string) {}

  get service() { return this.current; }
  get unlocked() { return this.current?.unlocked === true; }

  async state() {
    const journal = await readMigrationJournal(this.root);
    if (journal) return { mode: "migration" as const, direction: journal.direction };
    const envelope = await readEncryptionEnvelope(this.root);
    return { mode: envelope ? this.unlocked ? "unlocked" as const : "locked" as const : "plaintext" as const };
  }

  async unlock(credential: string, kind: "password" | "recovery" | "device" = "password") {
    const journal = await readMigrationJournal(this.root);
    const envelope = journal?.envelope ?? await readEncryptionEnvelope(this.root);
    if (!envelope) throw new Error("Dieser Datenbestand ist nicht verschlüsselt.");
    const service = EncryptionService.fromEnvelope(envelope);
    if (kind === "password") await service.unlockWithPassword(credential);
    else if (kind === "recovery") service.unlockWithRecoveryKey(credential);
    else service.unlockWithDeviceKey(Buffer.from(credential, "base64"));
    if (journal) {
      const direction = await resumeWorkspaceEncryptionMigration(this.root, service);
      if (direction === "disable") {
        service.lock();
        this.current = null;
        return { mode: "plaintext" as const, service: null };
      }
      const finalEnvelope = await readEncryptionEnvelope(this.root);
      if (!finalEnvelope) throw new Error("Die Verschlüsselungsumstellung konnte nicht abgeschlossen werden.");
      this.current = EncryptionService.fromEnvelope(finalEnvelope);
      if (kind === "password") await this.current.unlockWithPassword(credential);
      else if (kind === "recovery") this.current.unlockWithRecoveryKey(credential);
      else this.current.unlockWithDeviceKey(Buffer.from(credential, "base64"));
      service.lock();
    } else this.current = service;
    return { mode: "unlocked" as const, service: this.current };
  }

  async enable(password: string) {
    const existing = await this.state();
    if (existing.mode !== "plaintext") throw new Error("Der Datenbestand ist bereits verschlüsselt.");
    const plaintext = await readFile(workspacePath(this.root), "utf8");
    workspaceSchema.parse(JSON.parse(plaintext));
    const { service, recoveryKey } = await EncryptionService.create(password, plaintext);
    try {
      await enableWorkspaceEncryption(this.root, service);
      this.current = service;
      return recoveryKey;
    } catch (error) {
      service.lock();
      throw error;
    }
  }

  async disable(password: string) {
    const service = this.current;
    if (!service?.unlocked) throw new Error("Der Datenbestand ist gesperrt.");
    await service.unlockWithPassword(password);
    await disableWorkspaceEncryption(this.root, service);
    service.lock();
    this.current = null;
  }

  private async rewriteManagedEnvelopes() {
    const service = this.current;
    if (!service?.unlocked) throw new Error("Der Datenbestand ist gesperrt.");
    const pending = [path.join(this.root, "data")];
    const updates: Array<{ target: string; content: string }> = [];
    while (pending.length) {
      const directory = pending.pop()!;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error("Symbolische Verknüpfungen im Datenordner verhindern die Schlüsseländerung.");
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory()) { pending.push(candidate); continue; }
        if (!entry.isFile()) continue;
        const bytes = await readFile(candidate);
        if (bytes[0] !== 0x7b) continue;
        let envelope;
        try { envelope = parseEncryptedWorkspace(JSON.parse(bytes.toString("utf8"))); }
        catch { continue; }
        if (!envelope) continue;
        service.decryptWorkspace(envelope);
        updates.push({ target: candidate, content: JSON.stringify({ ...envelope, encryption: service.header }, null, 2) });
      }
    }
    // Write the active file last so a failed backup update cannot leave a new primary key header alone.
    updates.sort((a, b) => a.target === workspacePath(this.root) ? 1 : b.target === workspacePath(this.root) ? -1 : 0);
    for (const update of updates) await writeAtomic(update.target, update.content);
  }

  async changePassword(oldPassword: string, newPassword: string) {
    if (!this.current?.unlocked) throw new Error("Der Datenbestand ist gesperrt.");
    const previous = this.current.currentEnvelope;
    try {
      await this.current.changePassword(oldPassword, newPassword);
      await this.rewriteManagedEnvelopes();
    } catch (error) {
      this.current.restoreEnvelope(previous);
      throw error;
    }
  }

  async rotateRecoveryKey(password: string) {
    if (!this.current?.unlocked) throw new Error("Der Datenbestand ist gesperrt.");
    const previous = this.current.currentEnvelope;
    try {
      const result = await this.current.rotateRecoveryKey(password);
      await this.rewriteManagedEnvelopes();
      return result.recoveryKey;
    } catch (error) {
      this.current.restoreEnvelope(previous);
      throw error;
    }
  }

  lock() { this.current?.lock(); this.current = null; }
}
