import { copyFile, cp, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { type Application, type ApplicationInput } from "../src/shared/schema";
import { DataStore } from "./storage";
import { addSyntheticProfile } from "./test-profile";

const input = (company: string, profileId: string): ApplicationInput => ({
  company: { name: company, street: "", postalCode: "", city: "Berlin", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: { title: "Entwicklung", reference: "", source: "", url: "", fullText: "", workModel: "Hybrid",
    contractType: "Unbefristet", salaryExpectation: "" },
  templateId: "modern", accentColor: "#123456", secondaryColor: "#234567",
  designSettings: defaultDocumentDesign, profileId, notes: "",
});

describe("indexed Workspace files", () => {
  let root: string;
  let store: DataStore;
  let a: Application;
  let b: Application;
  const indexPath = () => path.join(root, "data", "Setting", "Settings", "workspace.json");
  const centralPath = () => path.join(root, "data", "Setting", "Settings", "collections.json");
  const applicationPath = (item: Application) => path.join(root, "data", "Bewerbungen", item.folderName, "bewerbung.json");

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "bm-index-"));
    store = new DataStore(root);
    await store.initialize();
    const profile = (await addSyntheticProfile(store)).profiles[0];
    a = (await store.createApplication(input("Alpha GmbH", profile.id))).applications[0];
    b = (await store.createApplication(input("Beta GmbH", profile.id))).applications[0];
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("stores only references centrally and reloads each application from its own file", async () => {
    const index = JSON.parse(await readFile(indexPath(), "utf8"));
    expect(index.schemaVersion).toBe(2);
    expect(index.applications.map((item: { id: string }) => item.id)).toEqual([b.id, a.id]);
    expect(index.applications[0].company).toBeUndefined();
    expect(index.profiles[0].firstName).toBeUndefined();
    expect(index.events).toBeUndefined();
    expect(JSON.parse(await readFile(applicationPath(a), "utf8")).profileSnapshot).toEqual(a.profileSnapshot);
    expect(JSON.parse(await readFile(path.join(root, index.profiles[0].path), "utf8")).id).toBe(a.profileId);
    expect(JSON.parse(await readFile(centralPath(), "utf8")).todos).toBeDefined();
    const reopened = new DataStore(root);
    await reopened.initialize();
    expect(reopened.getWorkspace().applications.map((item) => item.id)).toEqual([b.id, a.id]);
  });

  it("updates only the changed Bewerbung file when only its profile changes", async () => {
    const beforeB = await readFile(applicationPath(b));
    const beforeBTime = (await stat(applicationPath(b))).mtimeMs;
    const beforeIndex = await readFile(indexPath());
    const beforeCentral = await readFile(centralPath());
    await store.saveApplication({ ...a, profileSnapshot: { ...a.profileSnapshot!, summary: "Nur Alpha" } });
    expect(await readFile(applicationPath(b))).toEqual(beforeB);
    expect((await stat(applicationPath(b))).mtimeMs).toBe(beforeBTime);
    expect(await readFile(indexPath())).toEqual(beforeIndex);
    expect(await readFile(centralPath())).toEqual(beforeCentral);
    expect(JSON.parse(await readFile(applicationPath(a), "utf8")).profileSnapshot.summary).toBe("Nur Alpha");
  });

  it("migrates a version 1 Workspace after a verified full backup and preserves IDs", async () => {
    const legacy = store.getWorkspace();
    const bytes = Buffer.from(JSON.stringify(legacy, null, 2));
    await writeFile(indexPath(), bytes);
    const reopened = new DataStore(root);
    await reopened.initialize();
    const index = JSON.parse(await readFile(indexPath(), "utf8"));
    expect(index.schemaVersion).toBe(2);
    expect(new Set(reopened.getWorkspace().applications.map((item) => item.id))).toEqual(new Set([a.id, b.id]));
    expect(reopened.getWorkspace().profiles).toEqual(legacy.profiles);
    const backups = (await readdir(reopened.files.paths.backupsRoot)).filter((name) => name.startsWith("Migration_"));
    expect(backups).toHaveLength(1);
    expect(await readFile(path.join(reopened.files.paths.backupsRoot, backups[0], "data", "Setting", "Settings", "workspace.json")))
      .toEqual(bytes);
    const recoveredRoot = path.join(root, "recovered-fixture");
    await cp(path.join(reopened.files.paths.backupsRoot, backups[0]), recoveredRoot, { recursive: true });
    const recovered = new DataStore(recoveredRoot);
    await recovered.initialize();
    expect(new Set(recovered.getWorkspace().applications.map((item) => item.id))).toEqual(new Set([a.id, b.id]));
    expect(recovered.getWorkspace().profiles).toEqual(legacy.profiles);
    const again = new DataStore(root);
    await again.initialize();
    expect((await readdir(again.files.paths.backupsRoot)).filter((name) => name.startsWith("Migration_"))).toHaveLength(1);
  });

  it("stops migration on divergent application JSON and leaves both records readable", async () => {
    const legacy = store.getWorkspace();
    await writeFile(indexPath(), JSON.stringify(legacy));
    const divergent = { ...a, notes: "Nur in der Bewerbungsdatei" };
    await writeFile(applicationPath(a), JSON.stringify(divergent));
    const workspaceBytes = await readFile(indexPath());
    const applicationBytes = await readFile(applicationPath(a));
    await expect(new DataStore(root).initialize()).rejects.toThrow("widersprüchlicher Dateien");
    expect(await readFile(indexPath())).toEqual(workspaceBytes);
    expect(await readFile(applicationPath(a))).toEqual(applicationBytes);
    expect((await readdir(store.files.paths.backupsRoot)).some((name) => name.startsWith("migrationskonflikte-")))
      .toBe(true);
  });

  it("refuses an external edit instead of overwriting it with stale memory", async () => {
    await writeFile(applicationPath(a), JSON.stringify({ ...a, notes: "Extern geändert" }));
    await expect(store.saveApplication({ ...a, notes: "Alter Speicherstand" })).rejects.toThrow("extern geändert");
    expect(JSON.parse(await readFile(applicationPath(a), "utf8")).notes).toBe("Extern geändert");
    expect(JSON.parse(await readFile(applicationPath(b), "utf8")).id).toBe(b.id);
  });

  it("does not discard unknown authored fields during migration or normal loading", async () => {
    const legacy = store.getWorkspace();
    const extended = { ...legacy, applications: legacy.applications.map((item) =>
      item.id === a.id ? { ...item, customNote: "Bitte erhalten" } : item) };
    await writeFile(indexPath(), JSON.stringify(extended));
    const before = await readFile(indexPath());
    await expect(new DataStore(root).initialize()).rejects.toThrow("Unbekanntes Feld");
    expect(await readFile(indexPath())).toEqual(before);
    await writeFile(indexPath(), JSON.stringify(legacy));
    const indexed = new DataStore(root);
    await indexed.initialize();
    await writeFile(applicationPath(a), JSON.stringify({ ...a, customNote: "Bitte erhalten" }));
    await expect(new DataStore(root).initialize()).rejects.toThrow("Unbekanntes Feld");
    expect(JSON.parse(await readFile(applicationPath(a), "utf8")).customNote).toBe("Bitte erhalten");
  });

  it("keeps a missing or broken indexed application reference and its other files intact", async () => {
    const beforeIndex = await readFile(indexPath());
    const beforeB = await readFile(applicationPath(b));
    await rm(applicationPath(a));
    await expect(new DataStore(root).initialize()).rejects.toThrow("Bewerbungsdatei fehlt");
    expect(await readFile(indexPath())).toEqual(beforeIndex);
    expect(await readFile(applicationPath(b))).toEqual(beforeB);
    await writeFile(applicationPath(a), "{ beschädigt");
    await expect(new DataStore(root).initialize()).rejects.toThrow("beschädigt");
    expect(await readFile(applicationPath(a), "utf8")).toBe("{ beschädigt");
    expect(await readFile(indexPath())).toEqual(beforeIndex);
  });

  it("rejects path traversal and leaves an unregistered file unimported", async () => {
    const extra = { ...a, id: crypto.randomUUID(), company: { ...a.company, name: "Unbekannt GmbH" } };
    const extraPath = path.join(path.dirname(applicationPath(a)), "Extra", "bewerbung.json");
    await (await import("node:fs/promises")).mkdir(path.dirname(extraPath));
    await writeFile(extraPath, JSON.stringify(extra));
    const opened = new DataStore(root);
    await opened.initialize();
    expect(opened.getWorkspace().applications).toHaveLength(2);
    expect(opened.getStorageWarnings()).toHaveLength(1);
    const index = JSON.parse(await readFile(indexPath(), "utf8"));
    index.applications[0].path = "data/Bewerbungen/../../outside/bewerbung.json";
    await writeFile(indexPath(), JSON.stringify(index));
    await expect(new DataStore(root).initialize()).rejects.toThrow("Ungültiger Dateipfad");
    expect(await readFile(extraPath, "utf8")).toBe(JSON.stringify(extra));
  });

  it("repairs a uniquely moved file by ID and rejects duplicate IDs", async () => {
    const oldDirectory = path.dirname(applicationPath(a));
    const newDirectory = `${oldDirectory}_Verschoben`;
    await rename(oldDirectory, newDirectory);
    const movedPath = path.join(newDirectory, "bewerbung.json");
    await writeFile(movedPath, JSON.stringify({ ...a, folderName: `${a.folderName}_Verschoben`, notes: "Verschobene Datei" }, null, 2));
    const reopened = new DataStore(root);
    await reopened.initialize();
    expect(reopened.getApplication(a.id).notes).toBe("Verschobene Datei");
    expect(JSON.parse(await readFile(indexPath(), "utf8")).applications.find((item: { id: string }) => item.id === a.id).path)
      .toBe(`data/Bewerbungen/${a.folderName}/bewerbung.json`);
    await copyFile(applicationPath(reopened.getApplication(a.id)), applicationPath(b));
    await expect(new DataStore(root).initialize()).rejects.toThrow();
  });
});
