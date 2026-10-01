import { describe, expect, it } from "vitest";
import { appSettingsSchema, applicationSchema, defaultSettings, workspaceSchema } from "./schema";
import {
  createDocumentDesignDraft, editCvDesignField, editResumeAppearanceField, resetResumeDesign, selectDocumentTemplate,
  updateCvDesignField, type DesignEditState,
} from "./documentEditorState";
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } from "./cvDesign";
import { resolveResumeDesignView } from "./resumeDesignSystem";
import { applyResumeSpacingPreset, getResumeSpacingPreset, getResumeSpacingPresetValues } from "./resumeSpacing";
import { templates } from "./templates";

const now = new Date().toISOString();
const application = applicationSchema.parse({
  schemaVersion: 1, id: crypto.randomUUID(), folderName: "Design", company: { name: "Firma", city: "Berlin" }, contact: {},
  job: { title: "Entwicklung" }, status: "Entwurf", templateId: "klassisch", accentColor: "#2B2F32", secondaryColor: "#00AFC5",
  documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});
// A document starts from its template's own document settings, as every Bewerbung created in the app does.
const start = (templateId = "klassisch"): DesignEditState => ({
  draft: createDocumentDesignDraft({ ...application, templateId, designSettings: getTemplateDocumentDesignDefaults(templateId) }), global: undefined,
});
const gap = (state: DesignEditState, templateId = state.draft.templateId) =>
  resolveResumeDesignView(templateId, state.draft.templateId === templateId ? state.draft.settings : { ...state.draft.settings }, state.global).effective.tokens.spacing.sectionGapMm;

describe("editing the Lebenslauf design", () => {
  it("stores a shared edit once, sparsely, and shows it in every template", () => {
    const state = editCvDesignField(start(), "global", "spacing", "sectionGapMm", 6);
    expect(state.global).toEqual({ cvOverrides: { spacing: { sectionGapMm: 6 } } });
    expect(state.draft.settings.cvOverrides).toBeUndefined();
    for (const { id } of templates) {
      const draft = selectDocumentTemplate(state.draft, id, state.global);
      expect(resolveResumeDesignView(id, draft.settings, state.global).effective.tokens.spacing.sectionGapMm, id).toBe(6);
      // Nothing about the template itself was written into the document.
      expect(draft.settings.cvOverrides, id).toBeUndefined();
    }
  });

  it("keeps the shared value when the template changes and again when it changes back", () => {
    let state = editCvDesignField(start("klassisch"), "global", "spacing", "sectionGapMm", 6);
    state = { ...state, draft: selectDocumentTemplate(state.draft, "kompakt", state.global) };
    expect(gap(state)).toBe(6);
    state = { ...state, draft: selectDocumentTemplate(state.draft, "klassisch", state.global) };
    expect(gap(state)).toBe(6);
    expect(state.global).toEqual({ cvOverrides: { spacing: { sectionGapMm: 6 } } });
  });

  it("lets a shared edit replace the value the document had overridden itself", () => {
    let state = editCvDesignField(start(), "document", "spacing", "sectionGapMm", 5);
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { sectionGapMm: 5 } });
    state = editCvDesignField(state, "global", "spacing", "sectionGapMm", 6);
    expect(state.draft.settings.cvOverrides).toBeUndefined();
    expect(gap(state)).toBe(6);
  });

  it("stores a document edit only when it differs from what the document would inherit", () => {
    const native = resolveTemplateCvDesign("klassisch").spacing.sectionGapMm;
    let state = editCvDesignField(start(), "document", "spacing", "sectionGapMm", native);
    expect(state.draft.settings.cvOverrides).toBeUndefined();
    state = editCvDesignField(start(), "global", "spacing", "sectionGapMm", 6);
    // Restating the shared value is no override; stating the template's value is, because it differs from the shared one.
    expect(editCvDesignField(state, "document", "spacing", "sectionGapMm", 6).draft.settings.cvOverrides).toBeUndefined();
    const pinned = editCvDesignField(state, "document", "spacing", "sectionGapMm", native);
    expect(pinned.draft.settings.cvOverrides).toEqual({ spacing: { sectionGapMm: native } });
    expect(gap(pinned)).toBe(native);
  });

  it("keeps such a pinned value in the snapshot of a template the document leaves", () => {
    const native = resolveTemplateCvDesign("klassisch").spacing.sectionGapMm;
    let state = editCvDesignField(start(), "global", "spacing", "sectionGapMm", 6);
    state = editCvDesignField(state, "document", "spacing", "sectionGapMm", native);
    state = { ...state, draft: selectDocumentTemplate(state.draft, "kompakt", state.global) };
    expect(state.draft.templateDesigns.klassisch.settings.cvOverrides).toEqual({ spacing: { sectionGapMm: native } });
    state = { ...state, draft: selectDocumentTemplate(state.draft, "klassisch", state.global) };
    expect(gap(state)).toBe(native);
  });

  it("restores the template's own value on a field reset, in both scopes", () => {
    let state = editCvDesignField(start(), "global", "typography", "sectionHeadingSizePt", 13);
    expect(resolveResumeDesignView("klassisch", state.draft.settings, state.global).effective.tokens.typography.sectionHeadingSizePt).toBe(13);
    state = editCvDesignField(state, "global", "typography", "sectionHeadingSizePt", undefined);
    expect(state.global).toBeUndefined();
    expect(resolveResumeDesignView("klassisch", state.draft.settings, state.global).effective.tokens.typography.sectionHeadingSizePt)
      .toBe(resolveTemplateCvDesign("klassisch").typography.sectionHeadingSizePt);
    const own = editCvDesignField(start(), "document", "typography", "sectionHeadingSizePt", 12);
    expect(editCvDesignField(own, "document", "typography", "sectionHeadingSizePt", undefined).draft.settings.cvOverrides).toBeUndefined();
  });

  it("removes the shared layer and the document's overrides with 'Vorlagenwerte wiederherstellen'", () => {
    let state = editCvDesignField(start(), "global", "spacing", "sectionGapMm", 6);
    state = editCvDesignField(state, "document", "typography", "bodySizePt", 10);
    state = editResumeAppearanceField(state, "global", "sectionHeadingAlignment", "center");
    state = editResumeAppearanceField(state, "document", "sidebarTextColor", "#ffffff");
    const reset = resetResumeDesign(state, "global");
    expect(reset.global).toBeUndefined();
    expect(reset.draft.settings.cvOverrides).toBeUndefined();
    expect(reset.draft.settings.resumeAppearance).toBeUndefined();
    for (const { id } of templates)
      expect(resolveResumeDesignView(id, selectDocumentTemplate(reset.draft, id).settings, reset.global).effective.tokens, id).toEqual(resolveTemplateCvDesign(id));
    // In the document scope the shared layer stays.
    const own = resetResumeDesign(state, "document");
    expect(own.global).toEqual(state.global);
    expect(own.draft.settings.cvOverrides).toBeUndefined();
  });

  it("does not write other documents' overrides or legacy records when the shared layer changes", () => {
    const other = { ...application.designSettings, cvOverrides: { spacing: { sectionGapMm: 5 } } };
    const state = editCvDesignField(start(), "global", "spacing", "sectionGapMm", 6);
    expect(other.cvOverrides).toEqual({ spacing: { sectionGapMm: 5 } });
    // The other document still wins with its own value; the shared one reaches whatever it did not override.
    expect(resolveResumeDesignView("klassisch", other, state.global).effective.tokens.spacing.sectionGapMm).toBe(5);
    expect(resolveResumeDesignView("klassisch", other, state.global).effective.tokens.spacing.entryGapMm)
      .toBe(resolveTemplateCvDesign("klassisch").spacing.entryGapMm);
  });

  it("edits appearance in both scopes with the divider as one decision", () => {
    let state = editResumeAppearanceField(start("zweispaltig"), "global", "sectionDividerVisible", false);
    expect(state.global).toEqual({ resumeAppearance: { sectionDividerVisible: false } });
    state = editResumeAppearanceField(state, "global", "sectionDividerPosition", "top");
    expect(state.global).toEqual({ resumeAppearance: { sectionDividerPosition: "top" } });
    state = editResumeAppearanceField(state, "document", "sectionHeadingAlignment", "right");
    expect(state.draft.settings.resumeAppearance).toEqual({ sectionHeadingAlignment: "right" });
    const view = resolveResumeDesignView("zweispaltig", state.draft.settings, state.global);
    expect(view.effective.appearance).toMatchObject({ sectionDividerPosition: "top", sectionHeadingAlignment: "right" });
    expect(view.native.appearance.sectionDividerPosition).toBe("bottom");
    // Setting the template's own value removes an override instead of storing a copy.
    expect(editResumeAppearanceField(state, "document", "sectionHeadingAlignment", "left").draft.settings.resumeAppearance).toBeUndefined();
  });

  it("scales the spacing presets from the template and the shared layer, never from a generic value", () => {
    const shared = editCvDesignField(start("kompakt"), "global", "spacing", "entryGapMm", 5);
    const compact = applyResumeSpacingPreset(shared.draft, "compact", shared.global);
    const expected = getResumeSpacingPresetValues("kompakt", "compact", resolveTemplateCvDesign("kompakt"));
    expect(compact.settings.cvOverrides?.spacing?.sectionGapMm).toBe(expected.spacing.sectionGapMm);
    expect(compact.settings.cvOverrides?.spacing?.entryGapMm).toBe(4);
    expect(getResumeSpacingPreset("kompakt", compact.settings, shared.global)).toBe("compact");
    expect(applyResumeSpacingPreset(compact, "standard", shared.global).settings.cvOverrides).toBeUndefined();
  });

  describe("persistence", () => {
    it("reads workspaces saved before the shared layer existed and saves the layer sparsely", () => {
      expect(appSettingsSchema.parse(defaultSettings).resumeDesign).toBeUndefined();
      const layer = { cvOverrides: { spacing: { sectionGapMm: 6 } }, resumeAppearance: { sectionHeadingAlignment: "center" as const } };
      const saved = appSettingsSchema.parse(JSON.parse(JSON.stringify({ ...defaultSettings, resumeDesign: layer })));
      expect(saved.resumeDesign).toEqual(layer);
      expect(workspaceSchema.parse({
        schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [], settings: saved, updatedAt: now,
      }).settings.resumeDesign).toEqual(layer);
      expect(() => appSettingsSchema.parse({ ...defaultSettings, resumeDesign: { cvOverrides: { spacing: { sectionGapMm: 99 } } } })).toThrow();
    });

    it("loads old per-template designs and legacy overrides with an unchanged look", () => {
      const legacy = applicationSchema.parse({
        ...JSON.parse(JSON.stringify(application)), templateId: "modern",
        designSettings: { ...application.designSettings, cvOverrides: { spacing: { sectionGapMm: 5 } }, resumeAppearance: { sectionDividerVisible: false, sectionHeadingMarginAfterMm: 4 }, marginLevel: 7 },
        templateDesigns: { klassisch: { settings: { cvOverrides: { typography: { bodySizePt: 9 } } } } },
      });
      const view = resolveResumeDesignView("modern", legacy.designSettings);
      expect(view.effective.tokens.spacing).toMatchObject({ sectionGapMm: 5, pageMarginMm: 20, sectionTitleGapMm: 4 });
      expect(view.effective.appearance.sectionDividerPosition).toBe("none");
      const switched = selectDocumentTemplate(createDocumentDesignDraft(legacy), "klassisch");
      expect(resolveResumeDesignView("klassisch", switched.settings).effective.tokens.typography.bodySizePt).toBe(9);
      // Editing a field leaves the other legacy values alone.
      const edited = updateCvDesignField(createDocumentDesignDraft(legacy), "spacing", "entryGapMm", 6);
      expect(edited.settings.cvOverrides).toEqual({ spacing: { sectionGapMm: 5, entryGapMm: 6 } });
      expect(edited.settings.marginLevel).toBe(7);
    });
  });
});
