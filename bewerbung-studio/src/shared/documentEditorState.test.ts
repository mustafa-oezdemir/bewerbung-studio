import { describe, expect, it, vi } from "vitest";
import { applicationSchema, documentDesignOverridesSchema, profileSchema } from "./schema";
import { createDocumentDesignDraft, selectDocumentTemplate, resetDocumentDesign, updateCvDesignField, persistDocumentDraft } from "./documentEditorState";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { getTemplate, templates } from "./templates";

const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Firma", company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "modern", accentColor: "#123456", secondaryColor: "#abcdef", documents: {}, profileId: profile.id, statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

describe("document editor persistence", () => {
  it.each(templates)("starts $name with its own defaults rather than the previous draft", (template) => {
    const original = {
      ...createDocumentDesignDraft(application), templateId: "classic-professional",
      settings: { ...application.designSettings, textColor: "#123456", paddingLevel: 10 as const, cvOverrides: { colors: { paragraph: "#aabbcc" } } },
    };
    const next = selectDocumentTemplate(original, template.id);
    expect(next.settings).toEqual(getTemplateDocumentDesignDefaults(template.id));
    expect(next.accentColor).toBe(template.accent);
    expect(next.secondaryColor).toBe(template.secondary);
  });

  it("persists only changed values for inactive templates", () => {
    const base = resetDocumentDesign(createDocumentDesignDraft(application));
    const changed = updateCvDesignField(base, "colors", "paragraph", "#aabbcc");
    const next = selectDocumentTemplate(changed, "kompakt");
    expect(next.templateDesigns.modern).toEqual({ settings: { cvOverrides: { colors: { paragraph: "#aabbcc" } } } });
    expect(documentDesignOverridesSchema.parse({})).toEqual({});
    expect(selectDocumentTemplate(base, "kompakt").templateDesigns).toEqual({});
  });

  it("keeps metadata layout per template and restores native defaults on reset", () => {
    const base = createDocumentDesignDraft(application);
    const changed = { ...base, settings: { ...base.settings, metadataLayout: "side-by-side" as const, metadataOrder: "dates-first" as const } };
    const other = selectDocumentTemplate(changed, "kompakt");
    expect(other.settings.metadataLayout).toBeUndefined();
    expect(other.templateDesigns.modern.settings).toMatchObject({ metadataLayout: "side-by-side", metadataOrder: "dates-first" });
    const restored = selectDocumentTemplate(other, "modern");
    const saved = applicationSchema.parse({ ...application, designSettings: restored.settings, templateDesigns: restored.templateDesigns });
    expect(saved.designSettings.metadataLayout).toBe("side-by-side");
    expect(saved.designSettings.metadataOrder).toBe("dates-first");
    expect(resetDocumentDesign(createDocumentDesignDraft(saved)).settings.metadataLayout).toBeUndefined();
  });

  it("resets colors and semantic overrides without resetting other templates", () => {
    let current = resetDocumentDesign(createDocumentDesignDraft(application));
    current = updateCvDesignField(current, "spacing", "entryGapMm", 8);
    current = selectDocumentTemplate(current, "kompakt");
    current = updateCvDesignField(current, "colors", "entryHeading", "#aabbcc");
    current = { ...current, accentColor: "#112233", secondaryColor: "#445566" };
    const reset = resetDocumentDesign(current);
    expect(reset.accentColor).toBe(getTemplate("kompakt").accent);
    expect(reset.secondaryColor).toBe(getTemplate("kompakt").secondary);
    expect(reset.settings).toEqual(getTemplateDocumentDesignDefaults("kompakt"));
    expect(reset.settings).not.toHaveProperty("cvOverrides");
    expect(selectDocumentTemplate(reset, "modern").settings.cvOverrides).toEqual({ spacing: { entryGapMm: 8 } });
    expect(current.settings.cvOverrides).toEqual({ colors: { entryHeading: "#aabbcc" } });
  });

  it("resets one semantic field while retaining other overrides", () => {
    let current = createDocumentDesignDraft(application);
    current = updateCvDesignField(current, "colors", "paragraph", "#aabbcc");
    current = updateCvDesignField(current, "spacing", "entryGapMm", 8);
    current = updateCvDesignField(current, "colors", "paragraph", undefined);
    expect(current.settings.cvOverrides).toEqual({ spacing: { entryGapMm: 8 } });
    current = updateCvDesignField(current, "spacing", "entryGapMm", undefined);
    expect(current.settings).not.toHaveProperty("cvOverrides");
  });

  it("loads historical full snapshots and the Einfach alias without losing their settings", () => {
    const legacy = applicationSchema.parse({ ...application, templateDesigns: { einfach: { accentColor: "#123456", secondaryColor: "#654321", settings: { ...application.designSettings, paddingLevel: 9 } } } });
    const current = selectDocumentTemplate(createDocumentDesignDraft(legacy), "einspaltig");
    expect(current.accentColor).toBe("#123456");
    expect(current.settings.paddingLevel).toBe(9);
    expect(current.templateDesigns.einfach).toBeUndefined();
    expect(selectDocumentTemplate({ ...current, templateId: "einfach" }, "einspaltig").settings).toEqual(current.settings);
  });

  it("restores saved design settings when switching templates, including after serialization", () => {
    const original = { ...createDocumentDesignDraft(application), settings: { ...application.designSettings, strengthsColumns: 2 as const, knowledgeColumns: 1 as const, marginLevel: 8 as const, headingColor: "#654321" } };
    expect(selectDocumentTemplate(original, "modern")).toBe(original);
    const other = selectDocumentTemplate(original, "klassisch");
    expect(other.settings.strengthsColumns).toBe("auto");
    expect(other.settings.knowledgeColumns).toBe("auto");
    const saved = applicationSchema.parse(JSON.parse(JSON.stringify({ ...application, templateId: other.templateId, accentColor: other.accentColor, secondaryColor: other.secondaryColor, designSettings: other.settings, templateDesigns: other.templateDesigns })));
    const restored = selectDocumentTemplate(createDocumentDesignDraft(saved), "modern");
    expect(restored.settings).toEqual(original.settings);
    expect(restored.accentColor).toBe("#123456");
    expect(restored.secondaryColor).toBe("#abcdef");
    expect(restored.templateDesigns.modern).toBeUndefined();
    expect(original.templateDesigns).toEqual({});
  });

  it("saves the current profile draft before the application", async () => {
    const calls: string[] = [];
    const changed = { ...profile, summary: "Neuer Profiltext" };
    const saveProfile = vi.fn(async () => { calls.push("profile"); });
    const saveApplication = vi.fn(async () => { calls.push("application"); });
    await persistDocumentDraft(application, changed, saveProfile, saveApplication);
    expect(saveProfile).toHaveBeenCalledWith(changed);
    expect(calls).toEqual(["profile", "application"]);
  });

  it("does not save a different profile or continue after a failed profile save", async () => {
    const saveProfile = vi.fn(async () => { throw new Error("Speichern fehlgeschlagen"); });
    const saveApplication = vi.fn(async () => {});
    await persistDocumentDraft(application, { ...profile, id: crypto.randomUUID() }, saveProfile, saveApplication);
    expect(saveProfile).not.toHaveBeenCalled();
    saveApplication.mockClear();
    await expect(persistDocumentDraft(application, profile, saveProfile, saveApplication)).rejects.toThrow("Speichern fehlgeschlagen");
    expect(saveApplication).not.toHaveBeenCalled();
  });
});
