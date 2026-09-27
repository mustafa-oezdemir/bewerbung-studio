import { describe, expect, it, vi } from "vitest";
import { applicationSchema, profileSchema } from "./schema";
import { createDocumentDesignDraft, selectDocumentTemplate, persistDocumentDraft } from "./documentEditorState";

const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Firma", company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "modern", accentColor: "#123456", secondaryColor: "#abcdef", documents: {}, profileId: profile.id, statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

describe("document editor persistence", () => {
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
