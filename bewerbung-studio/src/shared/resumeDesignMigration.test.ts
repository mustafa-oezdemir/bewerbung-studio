import { describe, expect, it } from "vitest";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import type { ResumeDesignLayer } from "./cvDesignSchema";
import { createDocumentDesignDraft, editCvDesignField, editResumeAppearanceField, resetResumeDesign, selectDocumentTemplate, type DesignEditState } from "./documentEditorState";
import { applyGlobalResumeDesign, resolveResumeDesignView } from "./resumeDesignSystem";
import { migrateGlobalResumeDesign } from "./resumeDesignMigration";
import { applicationSchema, defaultSettings, workspaceSchema, type Application } from "./schema";

const now = "2026-10-02T10:00:00.000Z";
const application = (templateId: string, designSettings: Record<string, unknown> = {}, templateDesigns: Record<string, unknown> = {}): Application =>
  applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Design", company: { name: "Firma", city: "Berlin" }, contact: {},
    job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567",
    designSettings: { ...getTemplateDocumentDesignDefaults(templateId), ...designSettings }, templateDesigns, documents: {},
    statusHistory: [], createdAt: now, updatedAt: now,
  });
const workspace = (applications: Application[], resumeDesign?: ResumeDesignLayer) =>
  workspaceSchema.parse({ schemaVersion: 1, updatedAt: now, profiles: [], events: [], attachments: [], applications, settings: { ...defaultSettings, ...(resumeDesign ? { resumeDesign } : {}) } });
const layer: ResumeDesignLayer = { cvOverrides: { spacing: { sectionGapMm: 6 } }, resumeAppearance: { sectionHeadingAlignment: "center" } };

describe("folding an older workspace-wide Lebenslauf design into the Bewerbungen", () => {
  it("keeps each look exactly: the shared values below, the own ones above", () => {
    const a = application("zeitgenoessisch");
    const b = application("zeitgenoessisch", { cvOverrides: { spacing: { entryGapMm: 3, sectionGapMm: 9 } } });
    const migrated = migrateGlobalResumeDesign(workspace([a, b], layer));
    expect(migrated.settings.resumeDesign).toBeUndefined();
    for (const [before, after] of [[a, migrated.applications[0]], [b, migrated.applications[1]]] as const)
      expect(after.designSettings).toEqual(applyGlobalResumeDesign(before.designSettings, layer));
    expect(migrated.applications[1].designSettings.cvOverrides?.spacing).toEqual({ sectionGapMm: 9, entryGapMm: 3 });
    // Afterwards they are independent: a change of A does not reach B.
    const changedA = editCvDesignField({ draft: createDocumentDesignDraft(migrated.applications[0]), global: undefined }, "document", "spacing", "sectionGapMm", 4);
    expect(changedA.draft.settings.cvOverrides?.spacing?.sectionGapMm).toBe(4);
    expect(migrated.applications[1].designSettings.cvOverrides?.spacing?.sectionGapMm).toBe(9);
  });

  it("folds the layer into the saved designs of the other templates of a Bewerbung, too", () => {
    const withSnapshot = application("klassisch", {}, { elegant: { settings: { cvOverrides: { spacing: { pageMarginMm: 17 } } } } });
    const migrated = migrateGlobalResumeDesign(workspace([withSnapshot], layer));
    expect(migrated.applications[0].templateDesigns.elegant.settings.cvOverrides?.spacing).toEqual({ sectionGapMm: 6, pageMarginMm: 17 });
  });

  it("is deterministic and idempotent, and leaves a workspace without a layer untouched", () => {
    const plain = workspace([application("klassisch")]);
    expect(migrateGlobalResumeDesign(plain)).toBe(plain);
    const once = migrateGlobalResumeDesign(workspace([application("klassisch")], layer));
    expect(migrateGlobalResumeDesign(once)).toBe(once);
    expect(migrateGlobalResumeDesign(workspace([], { cvOverrides: {} })).settings.resumeDesign).toBeUndefined();
  });
});

describe("the Lebenslauf design of one Bewerbung", () => {
  const draftOf = (templateId: string): DesignEditState => ({ draft: createDocumentDesignDraft(application(templateId)), global: undefined });

  it("starts from the template's own values: no override is written for a new Bewerbung", () => {
    const fresh = application("zeitgenoessisch");
    expect(fresh.designSettings.cvOverrides).toBeUndefined();
    expect(fresh.designSettings.resumeAppearance).toBeUndefined();
    const view = resolveResumeDesignView("zeitgenoessisch", fresh.designSettings);
    expect(view.effective.tokens).toEqual(view.native.tokens);
    expect(view.sourceOfToken("spacing", "sectionGapMm")).toBe("template");
  });

  it("keeps colours, typography, spacing and appearance of A away from B, and resets A alone", () => {
    let a = draftOf("zeitgenoessisch");
    a = editCvDesignField(a, "document", "colors", "accent", "#123456");
    a = editCvDesignField(a, "document", "typography", "fontId", "inter");
    a = editCvDesignField(a, "document", "spacing", "pageMarginMm", 14);
    a = editResumeAppearanceField(a, "document", "photoLayout", "square");
    a = editResumeAppearanceField(a, "document", "sidebarBackgroundColor", "#123456");
    const b = draftOf("zeitgenoessisch");
    expect(b.draft.settings.cvOverrides).toBeUndefined();
    expect(b.draft.settings.resumeAppearance).toBeUndefined();
    // Only the changed fields are stored.
    expect(a.draft.settings.cvOverrides).toEqual({ colors: { accent: "#123456" }, typography: { fontId: "inter" }, spacing: { pageMarginMm: 14 } });
    const reset = resetResumeDesign(a, "document");
    expect(reset.draft.settings.cvOverrides).toBeUndefined();
    expect(reset.draft.settings.resumeAppearance).toBeUndefined();
    expect(b.draft.settings.cvOverrides).toBeUndefined();
  });

  it("brings back this Bewerbung's own design of a template after a template switch, and starts a new template native", () => {
    let a = editCvDesignField(draftOf("zeitgenoessisch"), "document", "spacing", "sectionGapMm", 5);
    a = { ...a, draft: selectDocumentTemplate(a.draft, "elegant") };
    expect(a.draft.settings.cvOverrides).toBeUndefined();
    a = editCvDesignField(a, "document", "spacing", "pageMarginMm", 17);
    a = { ...a, draft: selectDocumentTemplate(a.draft, "zeitgenoessisch") };
    expect(a.draft.settings.cvOverrides?.spacing).toEqual({ sectionGapMm: 5 });
    expect(a.draft.templateDesigns.elegant?.settings.cvOverrides?.spacing).toEqual({ pageMarginMm: 17 });
    expect(draftOf("zeitgenoessisch").draft.templateDesigns).toEqual({});
  });
});
