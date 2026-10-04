import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const faults = vi.hoisted(() => ({
  copy: null as null | ((source: string, target: string) => void),
  rename: null as null | ((source: string, target: string) => void),
  write: null as null | ((filePath: string) => void),
}));

vi.mock("./security/secure-fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("./security/secure-fs")>();
  return {
    ...real,
    copyFile: async (source: string, target: string, mode?: number) => {
      faults.copy?.(source, target);
      return real.copyFile(source, target, mode);
    },
    rename: async (source: string, target: string) => {
      faults.rename?.(source, target);
      return real.rename(source, target);
    },
    open: async (filePath: string, flags: string) => {
      const handle = await real.open(filePath, flags);
      return new Proxy(handle, {
        get(target, key) {
          if (key === "writeFile") return async (...args: Parameters<typeof target.writeFile>) => {
            faults.write?.(filePath);
            return target.writeFile(...args);
          };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  };
});

import { DataStore } from "./storage";

const failure = (code: string) => Object.assign(new Error(`Injected ${code}`), { code });
const roots: string[] = [];

afterEach(async () => {
  faults.copy = null;
  faults.rename = null;
  faults.write = null;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bm-storage-fault-"));
  roots.push(root);
  const store = new DataStore(root);
  await store.initialize();
  const workspacePath = path.join(root, "data", "Setting", "Settings", "workspace.json");
  const before = await readFile(workspacePath);
  return { root, store, workspacePath, before };
};

const assertOldPrimary = async (workspacePath: string, before: Buffer) => {
  expect(await readFile(workspacePath)).toEqual(before);
  expect((await readdir(path.dirname(workspacePath))).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  const restarted = new DataStore(path.resolve(workspacePath, "../../../../"));
  await restarted.initialize();
  expect(restarted.getWorkspace().settings.theme).toBe("system");
};

describe("DataStore filesystem failure recovery", () => {
  it("removes a partial temporary file if writing runs out of space", async () => {
    const { store, workspacePath, before } = await fixture();
    faults.write = (filePath) => {
      if (filePath.startsWith(`${workspacePath}.`) && filePath.endsWith(".tmp"))
        throw failure("ENOSPC");
    };
    await expect(store.saveSettings({ ...store.getWorkspace().settings, theme: "dark" })).rejects.toMatchObject({ code: "ENOSPC" });
    faults.write = null;
    await assertOldPrimary(workspacePath, before);
  });

  it("keeps the primary if the backup copy runs out of disk space", async () => {
    const { store, workspacePath, before } = await fixture();
    faults.copy = (_source, target) => {
      if (target === `${workspacePath}.bak`) throw failure("ENOSPC");
    };
    await expect(store.saveSettings({ ...store.getWorkspace().settings, theme: "dark" })).rejects.toMatchObject({ code: "ENOSPC" });
    faults.copy = null;
    await assertOldPrimary(workspacePath, before);
  });

  it("keeps the primary if replacing it fails with a disk error", async () => {
    const { store, workspacePath, before } = await fixture();
    faults.rename = (source, target) => {
      if (source.endsWith(".tmp") && target === workspacePath) throw failure("ENOSPC");
    };
    await expect(store.saveSettings({ ...store.getWorkspace().settings, theme: "dark" })).rejects.toMatchObject({ code: "ENOSPC" });
    faults.rename = null;
    await assertOldPrimary(workspacePath, before);
  });

  it("restores the old primary if the Windows replacement retry fails", async () => {
    const { store, workspacePath, before } = await fixture();
    let replacementAttempts = 0;
    faults.rename = (source, target) => {
      if (source.endsWith(".tmp") && target === workspacePath) {
        replacementAttempts += 1;
        throw failure(replacementAttempts === 1 ? "EEXIST" : "ENOSPC");
      }
    };
    await expect(store.saveSettings({ ...store.getWorkspace().settings, theme: "dark" })).rejects.toMatchObject({ code: "ENOSPC" });
    faults.rename = null;
    expect(replacementAttempts).toBe(2);
    await assertOldPrimary(workspacePath, before);
  });

  it("does not begin a restore when its emergency copy fails", async () => {
    const { root, store, workspacePath, before } = await fixture();
    const exportPath = path.join(root, "backup.json");
    await writeFile(exportPath, before);
    faults.copy = (_source, target) => {
      if (path.basename(target).startsWith("vor-import-")) throw failure("EACCES");
    };
    await expect(store.importBackup(exportPath)).rejects.toMatchObject({ code: "EACCES" });
    faults.copy = null;
    await assertOldPrimary(workspacePath, before);
  });

  it("keeps the original workspace when the restore rename fails", async () => {
    const { root, store, workspacePath, before } = await fixture();
    const exportPath = path.join(root, "different-backup.json");
    const imported = JSON.parse(before.toString("utf8"));
    imported.settings.theme = "dark";
    await writeFile(exportPath, JSON.stringify(imported));
    faults.rename = (source, target) => {
      if (source.endsWith(".tmp") && target === workspacePath) throw failure("ENOSPC");
    };
    await expect(store.importBackup(exportPath)).rejects.toMatchObject({ code: "ENOSPC" });
    faults.rename = null;
    expect(store.getWorkspace().settings.theme).toBe("system");
    expect((await readdir(store.files.paths.backupsRoot)).some((name) => name.startsWith("vor-import-")))
      .toBe(true);
    await assertOldPrimary(workspacePath, before);
  });
});
