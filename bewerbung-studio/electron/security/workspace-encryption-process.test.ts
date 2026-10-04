import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/shared/schema";

const run = promisify(execFile);

describe("encryption migration across operating-system processes", () => {
  it("resumes a partly converted workspace in a new process", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bm-migration-process-"));
    try {
      const settings = path.join(root, "data", "Setting", "Settings");
      const application = path.join(root, "data", "Bewerbungen", "Test");
      await Promise.all([mkdir(settings, { recursive: true }), mkdir(application, { recursive: true })]);
      const workspaceFile = path.join(settings, "workspace.json");
      await writeFile(workspaceFile, JSON.stringify({
        schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
        settings: defaultSettings, updatedAt: new Date().toISOString(),
      }));
      await writeFile(path.join(application, "document.txt"), "synthetic private document");
      const worker = path.resolve("scripts/encryption-restart-worker.mjs");
      await run(process.execPath, [worker, "prepare", root], { timeout: 30_000 });
      expect(await readFile(path.join(settings, "encryption-migration.json"), "utf8")).toContain('"direction":"enable"');
      await run(process.execPath, [worker, "resume", root], { timeout: 30_000 });
      await expect(readFile(path.join(settings, "encryption-migration.json"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      const resolved = path.resolve(root);
      if (!resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`) ||
          !path.basename(resolved).startsWith("bm-migration-process-"))
        throw new Error("Unexpected migration test directory");
      await rm(resolved, { recursive: true, force: true });
    }
  }, 70_000);
});
