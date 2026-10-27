import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { addSyntheticProfile } from "./test-profile";

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
    await store.writeBackup(exportPath);
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
    await store.writeBackup(exportPath);
    const imported = JSON.parse(await readFile(exportPath, "utf8"));
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

  it("resumes an interrupted index migration without losing a changed central record", async () => {
    const { root, store, workspacePath } = await fixture();
    const now = "2026-10-01T10:00:00.000Z";
    await store.saveTodo({ id: crypto.randomUUID(), title: "Fiktive Aufgabe", description: "",
      priority: "medium", completed: false, createdAt: now, updatedAt: now });
    const legacy = store.getWorkspace();
    legacy.todos[0].description = "Nur in der alten Workspace-Datei";
    await writeFile(workspacePath, JSON.stringify(legacy));
    const centralPath = path.join(root, "data", "Setting", "Settings", "collections.json");
    await rm(centralPath);
    faults.rename = (source, target) => {
      if (source.endsWith(".tmp") && target === workspacePath) throw failure("ENOSPC");
    };
    await expect(new DataStore(root).initialize()).rejects.toMatchObject({ code: "ENOSPC" });
    faults.rename = null;
    expect(JSON.parse(await readFile(workspacePath, "utf8")).schemaVersion).toBe(1);
    expect(JSON.parse(await readFile(centralPath, "utf8")).todos[0].description)
      .toBe("Nur in der alten Workspace-Datei");
    const reopened = new DataStore(root);
    await reopened.initialize();
    expect(reopened.getWorkspace().todos[0].description).toBe("Nur in der alten Workspace-Datei");
    expect(JSON.parse(await readFile(workspacePath, "utf8")).schemaVersion).toBe(2);
  });

  it("blocks another save after a partial application transaction and reloads the committed file", async () => {
    const { root, store } = await fixture();
    const profile = (await addSyntheticProfile(store)).profiles[0];
    const application = (await store.createApplication({
      company: { name: "Fiktiv GmbH", street: "", postalCode: "", city: "Berlin", country: "Deutschland", website: "" },
      contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
      job: { title: "Entwicklung", reference: "", source: "", url: "", fullText: "", workModel: "Hybrid",
        contractType: "Unbefristet", salaryExpectation: "" },
      templateId: "modern", accentColor: "#123456", secondaryColor: "#234567",
      designSettings: defaultDocumentDesign, profileId: profile.id, notes: "",
    })).applications[0];
    const central = path.join(root, "data", "Setting", "Settings", "collections.json");
    faults.write = (file) => {
      if (file.startsWith(`${central}.`) && file.endsWith(".tmp")) throw failure("ENOSPC");
    };
    await expect(store.saveApplication({ ...application, notes: "Gespeicherte Notiz",
      deadlineAt: "2026-11-01T00:00:00.000Z" })).rejects.toMatchObject({ code: "ENOSPC" });
    faults.write = null;
    expect(store.getApplication(application.id).notes).toBe("Gespeicherte Notiz");
    await expect(store.saveApplication({ ...store.getApplication(application.id), notes: "Später" }))
      .rejects.toThrow("nur teilweise abgeschlossen");
    const reopened = new DataStore(root);
    await reopened.initialize();
    expect(reopened.getApplication(application.id).notes).toBe("Gespeicherte Notiz");
  });
});
