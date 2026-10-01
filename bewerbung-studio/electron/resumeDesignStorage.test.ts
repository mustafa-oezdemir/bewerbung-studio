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

describe("the shared Lebenslauf design in the workspace", () => {
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

  it("keeps the layer across a restart and applies it to every application's PDF, without touching them", async () => {
    await store.createApplication(applicationInput("klassisch"));
    await store.createApplication(applicationInput("kompakt"));
    const before = store.getWorkspace().applications.map((application) => ({ application, html: store.getExportHtml(application.id, "lebenslauf") }));
    await store.saveSettings({ ...store.getWorkspace().settings, resumeDesign: layer });

    const restarted = new DataStore(root);
    await restarted.initialize();
    expect(restarted.getWorkspace().settings.resumeDesign).toEqual(layer);
    for (const { application, html } of before) {
      const shared = restarted.getExportHtml(application.id, "lebenslauf");
      expect(shared, application.templateId).toContain("--doc-section-gap:7mm");
      expect(shared, application.templateId).not.toBe(html);
      // The stored application is exactly what it was; only the output reads the workspace layer.
      expect(restarted.getWorkspace().applications.find((item) => item.id === application.id)).toEqual(application);
      const own = { ...application, designSettings: { ...application.designSettings, cvOverrides: layer.cvOverrides, resumeAppearance: layer.resumeAppearance } };
      expect(shared, application.templateId).toBe(restarted.getExportHtml(application.id, "lebenslauf", own));
    }
  });

  it("returns every PDF to its template's own design when the layer is removed, and only the Lebenslauf is affected", async () => {
    await store.createApplication(applicationInput("klassisch"));
    const id = store.getWorkspace().applications[0].id;
    const targets = ["lebenslauf", "anschreiben", "deckblatt"] as const;
    const plain = Object.fromEntries(targets.map((target) => [target, store.getExportHtml(id, target)]));
    await store.saveSettings({ ...store.getWorkspace().settings, resumeDesign: layer });
    expect(store.getExportHtml(id, "lebenslauf")).not.toBe(plain.lebenslauf);
    expect(store.getExportHtml(id, "anschreiben")).toBe(plain.anschreiben);
    expect(store.getExportHtml(id, "deckblatt")).toBe(plain.deckblatt);

    const { resumeDesign: _removed, ...settings } = store.getWorkspace().settings;
    await store.saveSettings(settings);
    expect(store.getWorkspace().settings.resumeDesign).toBeUndefined();
    for (const target of targets) expect(store.getExportHtml(id, target), target).toBe(plain[target]);
  });

  it("exports and re-imports the layer with the settings, and refuses an unsafe layer", async () => {
    await store.saveSettings({ ...store.getWorkspace().settings, resumeDesign: layer });
    const file = path.join(root, "settings-export.json");
    await store.writeSettings(file);
    const written = JSON.parse(await readFile(file, "utf8")) as { resumeDesign?: unknown };
    expect(written.resumeDesign).toEqual(layer);

    const invalid = path.join(root, "invalid-settings.json");
    await writeFile(invalid, JSON.stringify({ ...written, resumeDesign: { cvOverrides: { spacing: { sectionGapMm: 99 } } } }), "utf8");
    await expect(store.importSettings(invalid)).rejects.toThrow();
    expect(store.getWorkspace().settings.resumeDesign).toEqual(layer);
  });
});
