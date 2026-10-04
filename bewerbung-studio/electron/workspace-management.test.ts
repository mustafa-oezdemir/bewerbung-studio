import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceManager, resolveWorkspaceRootFromFile } from "./workspace-management";
import { defaultSettings, profileSchema } from "../src/shared/schema";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { DataStore } from "./storage";

const roots: string[] = [];
const temporary = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bm-workspace-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const writeWorkspace = async (root: string) => {
  const directory = path.join(root, "data", "Setting", "Settings");
  await mkdir(directory, { recursive: true });
  await mkdir(path.join(root, "data", "Bewerbungen"), { recursive: true });
  await writeFile(path.join(directory, "workspace.json"), JSON.stringify({
    schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
    settings: defaultSettings, updatedAt: new Date().toISOString(),
  }));
};

describe("workspace management", () => {
  it("resolves standard and legacy workspace files from their copied root", async () => {
    const root = await temporary();
    expect(resolveWorkspaceRootFromFile(path.join(root, "data", "Setting", "Settings", "workspace.json"))).toBe(root);
    expect(resolveWorkspaceRootFromFile(path.join(root, "data", "Settings", "workspace.json"))).toBe(root);
    expect(resolveWorkspaceRootFromFile(path.join(root, "workspace.json"))).toBeNull();
    if (process.platform === "win32") {
      expect(resolveWorkspaceRootFromFile("E:\\BM\\data\\Setting\\Settings\\workspace.json")).toBe("E:\\BM");
    }
  });

  it("opens a legacy data/Settings workspace without writing an empty canonical workspace", async () => {
    const base = await temporary();
    const root = path.join(base, "legacy-root");
    const legacy = path.join(root, "data", "Settings", "workspace.json");
    await mkdir(path.dirname(legacy), { recursive: true });
    await mkdir(path.join(root, "data", "Bewerbungen"), { recursive: true });
    await writeFile(legacy, JSON.stringify({
      schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
      settings: defaultSettings, updatedAt: new Date().toISOString(),
    }));
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "old"));
    await manager.prepareExistingWorkspace(legacy);
    await manager.activate(root);
    const store = new DataStore(root);
    await store.initialize();
    expect(await manager.status()).toEqual({ state: "ready", root });
    const canonical = path.join(root, "data", "Setting", "Settings", "workspace.json");
    expect((await stat(canonical)).isFile()).toBe(true);
    expect(JSON.parse(await readFile(canonical, "utf8")).settings.language).toBe("de");
  });

  it("validates a copied data set, backs up the current root and persists the selected root", async () => {
    const base = await temporary();
    const config = path.join(base, "config");
    const manager = new WorkspaceManager(config, {}, path.join(base, "legacy"));
    const source = await manager.setup(path.join(base, "source"));
    await writeWorkspace(source);
    const target = path.join(base, "external-drive", "BM");
    await writeWorkspace(target);
    const document = path.join(target, "data", "Bewerbungen", "Example", "letter.docx");
    await mkdir(path.dirname(document), { recursive: true });
    await writeFile(document, "binary content");
    const selected = path.join(target, "data", "Setting", "Settings", "workspace.json");
    expect(await manager.inspectWorkspaceFile(selected)).toMatchObject({ root: target, recoveryAvailable: false, warnings: [] });
    await manager.prepareExistingWorkspace(selected, source);
    await manager.activate(target);
    expect(await new WorkspaceManager(config, {}, path.join(base, "legacy")).status()).toEqual({ state: "ready", root: target });
    expect(await readFile(document, "utf8")).toBe("binary content");
    const backups = path.join(source, "data", "Setting", "Backups");
    expect((await stat(backups)).isDirectory()).toBe(true);
  });

  it("keeps application profile links, embedded media and documents after copying to another root", async () => {
    const base = await temporary();
    const source = path.join(base, "source");
    const sourceStore = new DataStore(source);
    await sourceStore.initialize();
    const profile = profileSchema.parse({
      id: crypto.randomUUID(), isDefault: true, firstName: "Ada", lastName: "Beispiel",
      photoPath: "data:image/png;base64,AAAA", signaturePath: "data:image/png;base64,BBBB",
      updatedAt: new Date().toISOString(),
    });
    await sourceStore.saveProfile(profile);
    const created = await sourceStore.createApplication({
      company: { name: "Firma", street: "", postalCode: "", city: "Berlin", country: "Deutschland", website: "" },
      contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
      job: { title: "Entwicklung", reference: "", source: "", url: "", fullText: "", workModel: "Hybrid", contractType: "Unbefristet", salaryExpectation: "" },
      templateId: "classic-professional", accentColor: "#155e58", secondaryColor: "#244766",
      designSettings: defaultDocumentDesign, profileId: profile.id, notes: "",
    });
    const application = created.applications[0];
    const relativeDocument = path.join("data", "Bewerbungen", application.folderName, "Anschreiben", "letter.docx");
    await mkdir(path.dirname(path.join(source, relativeDocument)), { recursive: true });
    await writeFile(path.join(source, relativeDocument), "portable document");
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    await manager.activate(source);
    const target = path.join(base, "different-drive", "BM");
    await manager.changeRoot(source, target, "copy", false);
    expect(await manager.status()).toEqual({ state: "ready", root: source });
    const selected = path.join(target, "data", "Setting", "Settings", "workspace.json");
    await manager.prepareExistingWorkspace(selected, source);
    await manager.activate(target);
    const targetStore = new DataStore(target);
    await targetStore.initialize();
    const opened = targetStore.getWorkspace();
    expect(opened.applications[0].profileId).toBe(profile.id);
    expect(opened.profiles[0].photoPath).toBe(profile.photoPath);
    expect(opened.profiles[0].signaturePath).toBe(profile.signaturePath);
    expect(await readFile(path.join(target, relativeDocument), "utf8")).toBe("portable document");
  });

  it("rejects invalid JSON and a standalone JSON without changing bootstrap", async () => {
    const base = await temporary();
    const config = path.join(base, "config");
    const manager = new WorkspaceManager(config, {}, path.join(base, "legacy"));
    const source = await manager.setup(path.join(base, "source"));
    await writeWorkspace(source);
    const before = await readFile(manager.bootstrapPath, "utf8");
    const target = path.join(base, "target");
    await writeWorkspace(target);
    const selected = path.join(target, "data", "Setting", "Settings", "workspace.json");
    await writeFile(selected, "{broken");
    await expect(manager.prepareExistingWorkspace(selected, source)).rejects.toThrow("ungültig oder beschädigt");
    const desktop = path.join(base, "Desktop", "workspace.json");
    await mkdir(path.dirname(desktop));
    await writeFile(desktop, await readFile(path.join(source, "data", "Setting", "Settings", "workspace.json")));
    await expect(manager.inspectWorkspaceFile(desktop)).rejects.toThrow("zugehörige Bewerbungsordner");
    const partial = path.join(base, "partial", "data", "Setting", "Settings", "workspace.json");
    await mkdir(path.dirname(partial), { recursive: true });
    await writeFile(partial, await readFile(path.join(source, "data", "Setting", "Settings", "workspace.json")));
    await expect(manager.inspectWorkspaceFile(partial)).rejects.toThrow("zugehörige Bewerbungsordner");
    expect(await readFile(manager.bootstrapPath, "utf8")).toBe(before);
  });

  it("offers a valid .bak for explicit recovery and preserves the damaged file", async () => {
    const base = await temporary();
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    const root = path.join(base, "target");
    await writeWorkspace(root);
    const file = path.join(root, "data", "Setting", "Settings", "workspace.json");
    await writeFile(`${file}.bak`, await readFile(file));
    await writeFile(file, "{broken");
    expect((await manager.inspectWorkspaceFile(file)).recoveryAvailable).toBe(true);
    await expect(manager.prepareExistingWorkspace(file)).rejects.toThrow("Sicherung");
    expect((await manager.restoreWorkspaceBackup(file)).recoveryAvailable).toBe(false);
    expect((await readFile(file, "utf8")).startsWith("{")).toBe(true);
  });

  it("rejects an application folder that escapes the copied workspace", async () => {
    const base = await temporary();
    const root = path.join(base, "target");
    const store = new DataStore(root);
    await store.initialize();
    const created = await store.createApplication({
      company: { name: "Firma", street: "", postalCode: "", city: "Berlin", country: "Deutschland", website: "" },
      contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
      job: { title: "Entwicklung", reference: "", source: "", url: "", fullText: "", workModel: "Hybrid", contractType: "Unbefristet", salaryExpectation: "" },
      templateId: "classic-professional", accentColor: "#155e58", secondaryColor: "#244766",
      designSettings: defaultDocumentDesign, notes: "",
    });
    const file = path.join(root, "data", "Setting", "Settings", "workspace.json");
    created.applications[0].folderName = "../outside";
    await writeFile(file, JSON.stringify(created));
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    await expect(manager.inspectWorkspaceFile(file)).rejects.toThrow("Ungültiger Bewerbungsordner");
  });

  it("detects a live lock and releases its own lock", async () => {
    const base = await temporary();
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    const root = path.join(base, "target");
    await mkdir(root);
    const lock = path.join(root, ".workspace.lock");
    await writeFile(lock, JSON.stringify({ hostname: "another-computer", pid: 123, openedAt: new Date().toISOString(), appVersion: "1" }));
    expect(await manager.lockConflict(root)).toBe(true);
    await expect(manager.acquireLock(root, "1")).rejects.toThrow("bereits");
    await manager.acquireLock(root, "1", true);
    expect(await manager.lockConflict(root)).toBe(false);
    await manager.releaseLock(root);
    await expect(stat(lock)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("keeps an existing legacy workspace and honors the development override", async () => {
    const base = await temporary();
    const legacy = path.join(base, "legacy");
    await writeWorkspace(legacy);
    const manager = new WorkspaceManager(path.join(base, "config"), {}, legacy);
    expect(await manager.status()).toEqual({ state: "ready", root: legacy });
    const override = path.join(base, "override");
    expect(await new WorkspaceManager(path.join(base, "config"), { BEWERBUNG_ROOT_PATH: override }, legacy).status())
      .toEqual({ state: "ready", root: override });
  });

  it("starts a new installation in Dokumente/BewerbungsManager without asking", async () => {
    const base = await temporary();
    const userData = path.join(base, "config");
    const documents = path.join(base, "Documents");
    const manager = new WorkspaceManager(userData, {}, path.join(base, "legacy"));
    expect(await manager.status()).toEqual({ state: "setup" });
    const root = await manager.setupDefault(documents);
    expect(root).toBe(path.join(documents, "BewerbungsManager"));
    expect((await stat(path.join(root!, "data", "Setting", "Settings"))).isDirectory()).toBe(true);
    await writeWorkspace(root!);
    // The next start opens it directly.
    expect(await new WorkspaceManager(userData, {}, path.join(base, "legacy")).status()).toEqual({ state: "ready", root });
  });

  it("opens a data set already in Dokumente/BewerbungsManager as it is", async () => {
    const base = await temporary();
    const documents = path.join(base, "Documents");
    const root = path.join(documents, "BewerbungsManager");
    await writeWorkspace(root);
    const before = await readFile(path.join(root, "data", "Setting", "Settings", "workspace.json"), "utf8");
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    expect(await manager.setupDefault(documents)).toBe(root);
    expect(await readFile(path.join(root, "data", "Setting", "Settings", "workspace.json"), "utf8")).toBe(before);
  });

  it("sets up a selected root and reuses it after restart", async () => {
    const base = await temporary();
    const userData = path.join(base, "config");
    const root = path.join(base, "Bewerbungen");
    const manager = new WorkspaceManager(userData, {}, path.join(base, "legacy"));
    expect(await manager.status()).toEqual({ state: "setup" });
    expect(await manager.setup(root)).toBe(root);
    await writeWorkspace(root);
    expect(await new WorkspaceManager(userData, {}, path.join(base, "legacy")).status()).toEqual({ state: "ready", root });
    expect(JSON.parse(await readFile(path.join(userData, "bootstrap.json"), "utf8")).workspaceRootPath).toBe(root);
    expect((await stat(path.join(root, "data", "Setting", "Settings"))).isDirectory()).toBe(true);
  });

  it("repairs a bootstrap that accidentally points to data/Bewerbungen", async () => {
    const base = await temporary();
    const userData = path.join(base, "config");
    const root = path.join(base, "workspace");
    await writeWorkspace(root);
    await mkdir(userData, { recursive: true });
    await writeFile(
      path.join(userData, "bootstrap.json"),
      JSON.stringify({
        workspaceRootPath: path.join(root, "data", "Bewerbungen"),
        setupCompleted: true,
      }),
    );

    const manager = new WorkspaceManager(userData, {}, path.join(base, "legacy"));

    expect(await manager.status()).toEqual({ state: "ready", root });
    expect(
      JSON.parse(await readFile(path.join(userData, "bootstrap.json"), "utf8"))
        .workspaceRootPath,
    ).toBe(root);
  });

  it("repairs a bootstrap that accidentally points to the managed data folder", async () => {
    const base = await temporary();
    const userData = path.join(base, "config");
    const root = path.join(base, "workspace");
    await writeWorkspace(root);
    await mkdir(userData, { recursive: true });
    await writeFile(
      path.join(userData, "bootstrap.json"),
      JSON.stringify({
        workspaceRootPath: path.join(root, "data"),
        setupCompleted: true,
      }),
    );

    const manager = new WorkspaceManager(userData, {}, path.join(base, "legacy"));

    expect(await manager.status()).toEqual({ state: "ready", root });
  });

  it("keeps profiles when switching to a new empty workspace", async () => {
    const base = await temporary();
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    const source = await manager.setup(path.join(base, "source"));
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mustafa",
      lastName: "Özdemir",
      updatedAt: new Date().toISOString(),
    });
    const sourceWorkspace = {
      schemaVersion: 1 as const,
      applications: [],
      profiles: [profile],
      events: [],
      attachments: [],
      todos: [],
      customCvDesigns: [],
      settings: defaultSettings,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(
      path.join(source, "data", "Setting", "Settings", "workspace.json"),
      JSON.stringify(sourceWorkspace),
    );
    const target = path.join(base, "target");

    await manager.changeRoot(source, target, "new");

    const targetWorkspace = JSON.parse(
      await readFile(path.join(target, "data", "Setting", "Settings", "workspace.json"), "utf8"),
    );
    expect(targetWorkspace.applications).toEqual([]);
    expect(targetWorkspace.profiles).toEqual([profile]);
  });

  it("reports a missing configured folder instead of silently creating it", async () => {
    const base = await temporary();
    const userData = path.join(base, "config");
    const root = path.join(base, "Bewerbungen");
    const manager = new WorkspaceManager(userData, {}, path.join(base, "legacy"));
    await manager.setup(root);
    await rm(root, { recursive: true });
    expect(await manager.status()).toEqual({ state: "missing", root });
  });

  it("does not silently create an empty workspace when its data file disappeared", async () => {
    const base = await temporary();
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    const root = await manager.setup(path.join(base, "Bewerbungen"));
    expect(await manager.status()).toMatchObject({ state: "error", root });
  });

  it("backs up JSON and binary documents with a verified manifest", async () => {
    const base = await temporary();
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    const root = await manager.setup(path.join(base, "Bewerbungen"));
    await writeWorkspace(root);
    const document = path.join(root, "data", "Bewerbungen", "Beispiel_2026-09-29", "Lebenslauf", "Beispiel.docx");
    await mkdir(path.dirname(document), { recursive: true });
    await writeFile(document, Buffer.from([0, 1, 2, 255]));
    const backup = await manager.fullBackup(root, 1, 2, ["resumeSections"]);
    expect(await readFile(path.join(backup, "data", "Bewerbungen", "Beispiel_2026-09-29", "Lebenslauf", "Beispiel.docx"))).toEqual(Buffer.from([0, 1, 2, 255]));
    const manifest = JSON.parse(await readFile(path.join(backup, "migration-manifest.json"), "utf8"));
    expect(manifest.oldSchemaVersion).toBe(1);
    expect(manifest.newSchemaVersion).toBe(2);
    expect(manifest.files.some((file: { path: string }) => file.path.includes("Beispiel.docx"))).toBe(true);
  });

  it("keeps the original bootstrap path if transfer cannot start", async () => {
    const base = await temporary();
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    const source = await manager.setup(path.join(base, "source"));
    await writeWorkspace(source);
    const target = path.join(base, "target");
    await mkdir(target);
    await writeFile(path.join(target, "existing.txt"), "keep");
    await expect(manager.changeRoot(source, target, "copy")).rejects.toThrow("leer sein");
    expect(await manager.status()).toEqual({ state: "ready", root: source });
    expect(await readFile(path.join(target, "existing.txt"), "utf8")).toBe("keep");
  });

  it("copies a workspace and changes the bootstrap only after verification", async () => {
    const base = await temporary();
    const manager = new WorkspaceManager(path.join(base, "config"), {}, path.join(base, "legacy"));
    const source = await manager.setup(path.join(base, "source"));
    await writeWorkspace(source);
    const relativeDocument = path.join("data", "Bewerbungen", "Firma_2026-09-29", "Anschreiben", "letter.docx");
    await mkdir(path.dirname(path.join(source, relativeDocument)), { recursive: true });
    await writeFile(path.join(source, relativeDocument), "document");
    const target = path.join(base, "target");
    expect(await manager.changeRoot(source, target, "copy")).toBe(target);
    expect(await manager.status()).toEqual({ state: "ready", root: target });
    expect(await readFile(path.join(target, relativeDocument), "utf8")).toBe("document");
    expect(await readFile(path.join(source, relativeDocument), "utf8")).toBe("document");
  });
});
