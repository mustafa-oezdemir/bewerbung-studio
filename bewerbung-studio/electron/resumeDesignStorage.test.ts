import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { profileSchema, type ApplicationInput } from "../src/shared/schema";
import { getTemplateDocumentDesignDefaults } from "../src/shared/cvDesign";
import type { ResumeDesignLayer } from "../src/shared/cvDesignSchema";
import { DataStore } from "./storage";

const layer: ResumeDesignLayer = {
  cvOverrides: { spacing: { sectionGapMm: 7 }, typography: { sectionHeadingSizePt: 13 } },
  resumeAppearance: { sectionHeadingAlignment: "center" },
};

const applicationInput = (templateId: string): ApplicationInput => ({
  company: { name: "Design AG", street: "", postalCode: "10115", city: "Berlin", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: { title: "Entwickler", reference: "", source: "", url: "", fullText: "", workModel: "Hybrid", contractType: "Unbefristet", salaryExpectation: "" },
  templateId,
  accentColor: "#123456",
  secondaryColor: "#234567",
  designSettings: getTemplateDocumentDesignDefaults(templateId),
  notes: "",
});

describe("global and document Lebenslauf design storage", () => {
  let root: string;
  let store: DataStore;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbungsmanager-design-"));
    store = new DataStore(root);
    await store.initialize();
    await store.saveProfile(profileSchema.parse({
      id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", city: "Berlin",
      email: "mina@example.com", updatedAt: "2026-10-01T09:00:00.000Z",
    }));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("starts without a shared layer and writes nothing into the applications", async () => {
    await store.createApplication(applicationInput("klassisch"));
    const workspace = store.getWorkspace();
    expect(workspace.settings.resumeDesign).toBeUndefined();
    expect(workspace.applications[0].designSettings.cvOverrides).toBeUndefined();
    expect(workspace.applications[0].designSettings.resumeAppearance).toBeUndefined();
  });

  it("saves a shared edit, reopens it and uses it for PDF without copying it into the Bewerbung", async () => {
    await store.createApplication(applicationInput("zweispaltig"));
    const id = store.getWorkspace().applications[0].id;
    await store.saveSettings({ ...store.getWorkspace().settings, resumeDesign: layer });
    expect(store.getWorkspace().settings.resumeDesign).toEqual(layer);
    expect(store.getWorkspace().applications[0].designSettings.cvOverrides).toBeUndefined();
    expect(store.getExportHtml(id, "lebenslauf")).toContain("--doc-section-gap:7mm");
    const reopened = new DataStore(root);
    await reopened.initialize();
    expect(reopened.getWorkspace().settings.resumeDesign).toEqual(layer);
    expect(reopened.getExportHtml(id, "lebenslauf")).toContain("--doc-section-gap:7mm");
  });

  const designOf = (id: string, current = store) => current.getWorkspace().applications.find((application) => application.id === id)!.designSettings;
  const withSectionGap = (id: string, sectionGapMm: number) => {
    const application = store.getWorkspace().applications.find((item) => item.id === id)!;
    return store.saveApplication({
      ...application,
      designSettings: { ...application.designSettings, cvOverrides: { ...application.designSettings.cvOverrides, spacing: { ...application.designSettings.cvOverrides?.spacing, sectionGapMm } } },
    });
  };

  it("keeps every Bewerbung's own Lebenslauf design: A, B and a later C never share a value", async () => {
    await store.createApplication(applicationInput("zeitgenoessisch"));
    const a = store.getWorkspace().applications[0].id;
    await withSectionGap(a, 5);
    await store.createApplication(applicationInput("zeitgenoessisch"));
    const b = store.getWorkspace().applications.find((application) => application.id !== a)!.id;
    // B starts from the template, not from A.
    expect(designOf(b).cvOverrides).toBeUndefined();
    await withSectionGap(b, 8);
    expect(designOf(a).cvOverrides?.spacing?.sectionGapMm).toBe(5);
    expect(designOf(b).cvOverrides?.spacing?.sectionGapMm).toBe(8);
    await store.createApplication(applicationInput("zeitgenoessisch"));
    const c = store.getWorkspace().applications.find((application) => ![a, b].includes(application.id))!.id;
    expect(designOf(c).cvOverrides).toBeUndefined();
    expect(designOf(c).resumeAppearance).toBeUndefined();
    // Each PDF follows its own Bewerbung; nothing is written into the workspace settings.
    expect(store.getExportHtml(a, "lebenslauf")).toContain("--doc-section-gap:5mm");
    expect(store.getExportHtml(b, "lebenslauf")).toContain("--doc-section-gap:8mm");
    expect(store.getExportHtml(c, "lebenslauf")).not.toContain("--doc-section-gap:");
    expect(store.getWorkspace().settings.resumeDesign).toBeUndefined();
  });

  it("keeps the shared layer on restart while preserving document precedence and applying it to new applications", async () => {
    await store.createApplication(applicationInput("klassisch"));
    await store.createApplication(applicationInput("kompakt"));
    const [first, second] = store.getWorkspace().applications.map((application) => application.id);
    // The second one already has a value of its own, which keeps precedence over the shared one.
    const own = store.getWorkspace().applications.find((item) => item.id === second)!;
    await store.saveApplication({ ...own, designSettings: { ...own.designSettings, cvOverrides: { spacing: { sectionGapMm: 9, entryGapMm: 4 } } } });
    // A workspace written by an older version: the layer sits in the settings.
    const file = (store as unknown as { workspacePath: string }).workspacePath;
    const raw = JSON.parse(await readFile(file, "utf8")) as { settings: Record<string, unknown> };
    await writeFile(file, JSON.stringify({ ...raw, settings: { ...raw.settings, resumeDesign: layer } }), "utf8");

    const restarted = new DataStore(root);
    await restarted.initialize();
    expect(restarted.getWorkspace().settings.resumeDesign).toEqual(layer);
    expect(designOf(first, restarted).cvOverrides).toBeUndefined();
    expect(designOf(first, restarted).resumeAppearance).toBeUndefined();
    expect(designOf(second, restarted).cvOverrides).toEqual({ spacing: { sectionGapMm: 9, entryGapMm: 4 } });
    // The look of before: the shared values below the own ones.
    expect(restarted.getExportHtml(first, "lebenslauf")).toContain("--doc-section-gap:7mm");
    expect(restarted.getExportHtml(second, "lebenslauf")).toContain("--doc-section-gap:9mm");
    // Running again changes nothing; a new Bewerbung inherits the shared layer at render time.
    const again = new DataStore(root);
    await again.initialize();
    expect(again.getWorkspace().applications).toEqual(restarted.getWorkspace().applications);
    await again.createApplication(applicationInput("klassisch"));
    const fresh = again.getWorkspace().applications.find((application) => ![first, second].includes(application.id))!;
    expect(fresh.designSettings.cvOverrides).toBeUndefined();
    expect(fresh.designSettings.resumeAppearance).toBeUndefined();
    expect(again.getExportHtml(fresh.id, "lebenslauf")).toContain("--doc-section-gap:7mm");
  });

  it("imports and exports the shared layer without changing applications, and rejects invalid settings", async () => {
    await store.createApplication(applicationInput("klassisch"));
    const id = store.getWorkspace().applications[0].id;
    const file = path.join(root, "old-settings.json");
    await writeFile(file, JSON.stringify({ ...store.getWorkspace().settings, resumeDesign: layer }), "utf8");
    await store.importSettings(file);
    expect(store.getWorkspace().settings.resumeDesign).toEqual(layer);
    expect(designOf(id).cvOverrides).toBeUndefined();
    expect(store.getExportHtml(id, "lebenslauf")).toContain("--doc-section-gap:7mm");
    await store.writeSettings(path.join(root, "settings-export.json"));
    const written = JSON.parse(await readFile(path.join(root, "settings-export.json"), "utf8")) as { resumeDesign?: unknown };
    expect(written.resumeDesign).toEqual(layer);

    const invalid = path.join(root, "invalid-settings.json");
    await writeFile(invalid, JSON.stringify({ ...store.getWorkspace().settings, resumeDesign: { cvOverrides: { spacing: { sectionGapMm: 99 } } } }), "utf8");
    await expect(store.importSettings(invalid)).rejects.toThrow();
    expect(designOf(id).cvOverrides).toBeUndefined();
    expect(store.getWorkspace().settings.resumeDesign).toEqual(layer);
  });
});
