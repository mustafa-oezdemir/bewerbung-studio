import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/shared/schema";
import { EncryptionService, parseEncryptedWorkspace } from "./encryption-service";
import { disableWorkspaceEncryption, enableWorkspaceEncryption, readMigrationJournal, resumeWorkspaceEncryptionMigration, rollbackUncommittedMigration } from "./workspace-encryption";
import { clearActiveEncryption, readFile as secureReadFile, setActiveEncryption, writeFile as secureWriteFile } from "./secure-fs";
import { WorkspaceSecurity } from "./workspace-security";
import { DataStore } from "../storage";

const roots: string[] = [];
afterEach(async () => {
  clearActiveEncryption();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bm-encryption-"));
  roots.push(root);
  const settings = path.join(root, "data", "Setting", "Settings");
  const application = path.join(root, "data", "Bewerbungen", "Secret_Company");
  await mkdir(settings, { recursive: true });
  await mkdir(application, { recursive: true });
  const workspace = JSON.stringify({
    schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
    todos: [], customCvDesigns: [], settings: defaultSettings,
    updatedAt: new Date().toISOString(),
  });
  const workspaceFile = path.join(settings, "workspace.json");
  const applicationFile = path.join(application, "bewerbung.json");
  const documentFile = path.join(application, "document.pdf");
  await writeFile(workspaceFile, workspace);
  await writeFile(`${workspaceFile}.bak`, workspace);
  await writeFile(applicationFile, "Max Mustermann max@example.test");
  await writeFile(documentFile, Buffer.from("PDF Secret Company GmbH Berlin"));
  return { root, workspace, workspaceFile, applicationFile, documentFile };
};

describe("workspace encryption migration", () => {
  it("rolls back an uncommitted preparation without changing plaintext originals", async () => {
    const item = await fixture();
    const { service } = await EncryptionService.create("Kaffee Zug Marburg Wolke 2026!", item.workspace);
    const stageName = `.encryption-stage-${randomUUID()}`;
    const staged = path.join(item.root, stageName, path.relative(item.root, item.documentFile));
    await mkdir(path.dirname(staged), { recursive: true });
    await writeFile(staged, service.encryptFile(await readFile(item.documentFile)));
    await writeFile(path.join(item.root, "data", "Setting", "Settings", "encryption-migration.json"), JSON.stringify({
      version: 1, id: randomUUID(), direction: "enable", startedAt: new Date().toISOString(),
      stageName, files: [path.relative(item.root, item.documentFile)], envelope: service.currentEnvelope,
    }));
    expect(await rollbackUncommittedMigration(item.root)).toBe(true);
    expect(await readMigrationJournal(item.root)).toBeNull();
    expect(await readFile(item.documentFile, "utf8")).toBe("PDF Secret Company GmbH Berlin");
  });

  it("resumes a mixed crash state without discarding the original file", async () => {
    const item = await fixture();
    const { service } = await EncryptionService.create("Kaffee Zug Marburg Wolke 2026!", item.workspace);
    await enableWorkspaceEncryption(item.root, service);
    await writeFile(item.applicationFile, "Max Mustermann max@example.test");
    const journal = {
      version: 1, id: randomUUID(), direction: "enable",
      startedAt: new Date().toISOString(), stageName: `.encryption-stage-${randomUUID()}`,
      files: [path.relative(item.root, item.applicationFile)], envelope: service.currentEnvelope,
    };
    await writeFile(path.join(item.root, "data", "Setting", "Settings", "encryption-migration.json"), JSON.stringify(journal));
    await resumeWorkspaceEncryptionMigration(item.root, service);
    expect(await readMigrationJournal(item.root)).toBeNull();
    expect(service.decryptFile(await readFile(item.applicationFile)).toString("utf8")).toBe("Max Mustermann max@example.test");
  });

  it("loads, updates and backs up a real DataStore after password unlock", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bm-encrypted-store-"));
    roots.push(root);
    const original = new DataStore(root);
    await original.initialize();
    const controller = new WorkspaceSecurity(root);
    const recoveryKey = await controller.enable("Kaffee Zug Marburg Wolke 2026!");
    controller.lock();
    const reopened = new WorkspaceSecurity(root);
    await expect(reopened.unlock("wrong password 1234")).rejects.toThrow();
    await reopened.unlock(recoveryKey, "recovery");
    setActiveEncryption(root, reopened.service!);
    const encryptedStore = new DataStore(root);
    await encryptedStore.initialize();
    await encryptedStore.saveSettings({ ...encryptedStore.getWorkspace().settings, theme: "dark" });
    const exported = path.join(root, "export.json");
    await encryptedStore.writeBackup(exported);
    const rawWorkspace = await readFile(path.join(root, "data", "Setting", "Settings", "workspace.json"), "utf8");
    expect(rawWorkspace).not.toContain("autoBackupEnabled");
    expect(JSON.parse(rawWorkspace).format).toBe("bewerbungsmanager-encrypted-workspace");
    expect(await readFile(exported, "utf8")).not.toContain("autoBackupEnabled");
    clearActiveEncryption();
    reopened.lock();
    const again = new WorkspaceSecurity(root);
    await again.unlock("Kaffee Zug Marburg Wolke 2026!");
    setActiveEncryption(root, again.service!);
    const finalStore = new DataStore(root);
    await finalStore.initialize();
    expect(finalStore.getWorkspace().settings.theme).toBe("dark");
    again.lock();
  }, 20_000);

  it("encrypts all managed content, reads new writes, and reverses the migration", async () => {
    const item = await fixture();
    const { service, recoveryKey } = await EncryptionService.create("Kaffee Zug Marburg Wolke 2026!", item.workspace);
    await enableWorkspaceEncryption(item.root, service);
    expect(await readMigrationJournal(item.root)).toBeNull();
    const rawWorkspace = await readFile(item.workspaceFile, "utf8");
    expect(parseEncryptedWorkspace(JSON.parse(rawWorkspace))).not.toBeNull();
    for (const file of [item.workspaceFile, `${item.workspaceFile}.bak`, item.applicationFile, item.documentFile]) {
      const raw = await readFile(file);
      expect(raw.includes("Max Mustermann")).toBe(false);
      expect(raw.includes("Secret Company GmbH")).toBe(false);
      expect(raw.includes(recoveryKey)).toBe(false);
    }
    setActiveEncryption(item.root, service);
    expect(await secureReadFile(item.applicationFile, "utf8")).toBe("Max Mustermann max@example.test");
    await secureWriteFile(item.applicationFile, "Neue geheime Daten");
    expect((await readFile(item.applicationFile)).includes("Neue geheime Daten")).toBe(false);
    expect(await secureReadFile(item.applicationFile, "utf8")).toBe("Neue geheime Daten");
    clearActiveEncryption();
    await disableWorkspaceEncryption(item.root, service);
    expect(await readFile(item.applicationFile, "utf8")).toBe("Neue geheime Daten");
    expect(await readFile(item.workspaceFile, "utf8")).toBe(item.workspace);
  });
});
