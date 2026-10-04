import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const [phase, root] = process.argv.slice(2);
if (!["prepare", "resume"].includes(phase) || !path.isAbsolute(root))
  throw new Error("An isolated migration fixture and phase are required.");
const password = "Kaffee Zug Marburg Wolke 2026!";
const workspaceFile = path.join(root, "data", "Setting", "Settings", "workspace.json");
const applicationFile = path.join(root, "data", "Bewerbungen", "Test", "document.txt");
const journalFile = path.join(root, "data", "Setting", "Settings", "encryption-migration.json");
const vite = await createServer({ configFile: false, root: process.cwd(), appType: "custom",
  logLevel: "error", server: { middlewareMode: true } });
try {
  if (phase === "prepare") {
    const { EncryptionService } = await vite.ssrLoadModule("/electron/security/encryption-service.ts");
    const { enableWorkspaceEncryption } = await vite.ssrLoadModule("/electron/security/workspace-encryption.ts");
    const plaintext = await readFile(workspaceFile, "utf8");
    const { service } = await EncryptionService.create(password, plaintext);
    await enableWorkspaceEncryption(root, service);
    // Model a process stopped after the workspace was committed but before a
    // managed document was converted. The journal is what the next process sees.
    await writeFile(applicationFile, "synthetic private document");
    await writeFile(journalFile, JSON.stringify({
      version: 1, id: randomUUID(), direction: "enable", startedAt: new Date().toISOString(),
      stageName: `.encryption-stage-${randomUUID()}`,
      files: [path.relative(root, applicationFile)], envelope: service.currentEnvelope,
    }));
    service.lock();
  } else {
    const { WorkspaceSecurity } = await vite.ssrLoadModule("/electron/security/workspace-security.ts");
    const { readMigrationJournal } = await vite.ssrLoadModule("/electron/security/workspace-encryption.ts");
    const controller = new WorkspaceSecurity(root);
    if ((await controller.unlock(password)).mode !== "unlocked") throw new Error("Migration did not unlock");
    if (await readMigrationJournal(root)) throw new Error("Migration journal remains after restart");
    const raw = await readFile(applicationFile);
    if (raw.includes("synthetic private document") ||
        controller.service.decryptFile(raw).toString("utf8") !== "synthetic private document")
      throw new Error("Managed file was not encrypted after restart");
    controller.lock();
  }
} finally {
  await vite.close();
}
