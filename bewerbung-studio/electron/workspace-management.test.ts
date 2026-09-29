import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceManager } from "./workspace-management";
import { defaultSettings, profileSchema } from "../src/shared/schema";

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
  await writeFile(path.join(directory, "workspace.json"), JSON.stringify({
    schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
    settings: defaultSettings, updatedAt: new Date().toISOString(),
  }));
};

describe("workspace management", () => {
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
