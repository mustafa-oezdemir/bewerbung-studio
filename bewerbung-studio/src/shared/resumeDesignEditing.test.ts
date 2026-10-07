import { describe, expect, it } from "vitest";
import { appSettingsSchema, applicationSchema, defaultSettings, workspaceSchema } from "./schema";
import {
  createDocumentDesignDraft, editCvDesignField, editResumeAppearanceField, resetResumeDesign, selectDocumentTemplate,
  updateCvDesignField, type DesignEditState, type DesignScope,
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

  it("keeps a document override when a shared value changes", () => {
    let state = editCvDesignField(start(), "document", "spacing", "sectionGapMm", 5);
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { sectionGapMm: 5 } });
    state = editCvDesignField(state, "global", "spacing", "sectionGapMm", 6);
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { sectionGapMm: 5 } });
    expect(gap(state)).toBe(5);
    expect(resolveResumeDesignView("klassisch", state.draft.settings, state.global).sourceOfToken("spacing", "sectionGapMm")).toBe("document");
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

  it("keeps explicit legacy choices in template snapshots when a global value matches", () => {
    let state = editCvDesignField(start("klassisch"), "document", "spacing", "sectionGapMm", 5);
    state = editResumeAppearanceField(state, "document", "sectionHeadingAlignment", "right");
    state = editCvDesignField(state, "global", "spacing", "sectionGapMm", 5);
    state = editResumeAppearanceField(state, "global", "sectionHeadingAlignment", "right");
    state = { ...state, draft: selectDocumentTemplate(state.draft, "kompakt", state.global) };
    expect(state.draft.templateDesigns.klassisch.settings.cvOverrides).toEqual({ spacing: { sectionGapMm: 5 } });
    expect(state.draft.templateDesigns.klassisch.settings.resumeAppearance).toEqual({ sectionHeadingAlignment: "right" });
    state = resetResumeDesign(state, "global");
    state = { ...state, draft: selectDocumentTemplate(state.draft, "klassisch", state.global) };
    const view = resolveResumeDesignView("klassisch", state.draft.settings, state.global);
    expect(view.effective.tokens.spacing.sectionGapMm).toBe(5);
    expect(view.effective.appearance.sectionHeadingAlignment).toBe("right");
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

  it("removes the shared layer while preserving old document overrides", () => {
    let state = editCvDesignField(start(), "global", "spacing", "sectionGapMm", 6);
    state = editCvDesignField(state, "document", "typography", "bodySizePt", 10);
    state = editResumeAppearanceField(state, "global", "sectionHeadingAlignment", "center");
    state = editResumeAppearanceField(state, "document", "sidebarTextColor", "#ffffff");
    const reset = resetResumeDesign(state, "global");
    expect(reset.global).toBeUndefined();
    expect(reset.draft.settings.cvOverrides).toEqual({ typography: { bodySizePt: 10 } });
    expect(reset.draft.settings.resumeAppearance).toEqual({ sidebarTextColor: "#ffffff" });
    const restored = resetResumeDesign(reset, "document");
    for (const { id } of templates)
      expect(resolveResumeDesignView(id, selectDocumentTemplate(restored.draft, id).settings, restored.global).effective.tokens, id).toEqual(resolveTemplateCvDesign(id));
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

/** "Seitenränder" and "Innenabstand" are two settings: each has its own override, source, reset and saved record. */
describe("Seitenränder and Innenabstand", () => {
  type Key = "pageMarginMm" | "innerPaddingMm";
  const view = (state: DesignEditState) => resolveResumeDesignView(state.draft.templateId, state.draft.settings, state.global);
  const effective = (state: DesignEditState) => view(state).effective.tokens.spacing;
  const sourceOf = (state: DesignEditState, key: Key) => view(state).sourceOfToken("spacing", key);
  const stored = (state: DesignEditState, scope: DesignScope) =>
    scope === "global" ? state.global?.cvOverrides?.spacing : state.draft.settings.cvOverrides?.spacing;
  const set = (state: DesignEditState, scope: DesignScope, key: Key, value: number | undefined) =>
    editCvDesignField(state, scope, "spacing", key, value);
  const templateMargin = (templateId: string) => resolveTemplateCvDesign(templateId).spacing.pageMarginMm;

  it.each(["document", "global"] as const)("keeps Innenabstand while Seitenränder changes (%s scope)", (scope) => {
    const other: DesignScope = scope === "global" ? "document" : "global";
    let state = set(start(), scope, "innerPaddingMm", 2.5);
    for (const value of [10, 16, 12.5]) {
      state = set(state, scope, "pageMarginMm", value);
      expect(effective(state), String(value)).toMatchObject({ pageMarginMm: value, innerPaddingMm: 2.5 });
      expect(sourceOf(state, "pageMarginMm")).toBe(scope);
      expect(sourceOf(state, "innerPaddingMm")).toBe(scope);
      expect(stored(state, scope)).toEqual({ pageMarginMm: value, innerPaddingMm: 2.5 });
      expect(stored(state, other)).toBeUndefined();
    }
    // Resetting the margin removes the margin only.
    state = set(state, scope, "pageMarginMm", undefined);
    expect(stored(state, scope)).toEqual({ innerPaddingMm: 2.5 });
    expect(effective(state)).toMatchObject({ pageMarginMm: templateMargin("klassisch"), innerPaddingMm: 2.5 });
    expect(sourceOf(state, "pageMarginMm")).toBe("template");
    expect(sourceOf(state, "innerPaddingMm")).toBe(scope);
  });

  it.each(["document", "global"] as const)("keeps Seitenränder while Innenabstand changes (%s scope)", (scope) => {
    const other: DesignScope = scope === "global" ? "document" : "global";
    let state = set(start(), scope, "pageMarginMm", 16);
    for (const value of [2.5, 2, 5]) {
      state = set(state, scope, "innerPaddingMm", value);
      expect(effective(state), String(value)).toMatchObject({ pageMarginMm: 16, innerPaddingMm: value });
      expect(sourceOf(state, "pageMarginMm")).toBe(scope);
      expect(sourceOf(state, "innerPaddingMm")).toBe(scope);
      expect(stored(state, scope)).toEqual({ pageMarginMm: 16, innerPaddingMm: value });
      expect(stored(state, other)).toBeUndefined();
    }
    state = set(state, scope, "innerPaddingMm", undefined);
    expect(stored(state, scope)).toEqual({ pageMarginMm: 16 });
    expect(effective(state)).toMatchObject({ pageMarginMm: 16, innerPaddingMm: resolveTemplateCvDesign("klassisch").spacing.innerPaddingMm });
    expect(sourceOf(state, "innerPaddingMm")).toBe("template");
  });

  it("follows the reported sequence: margin 10 and padding 2,5, margin 16 and padding 2,5, then padding 2", () => {
    let state = set(set(start("klassisch"), "document", "pageMarginMm", 10), "document", "innerPaddingMm", 2.5);
    expect(effective(state)).toMatchObject({ pageMarginMm: 10, innerPaddingMm: 2.5 });
    state = set(state, "document", "pageMarginMm", 16);
    expect(effective(state)).toMatchObject({ pageMarginMm: 16, innerPaddingMm: 2.5 });
    state = set(state, "document", "innerPaddingMm", 2);
    expect(effective(state)).toMatchObject({ pageMarginMm: 16, innerPaddingMm: 2 });
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { pageMarginMm: 16, innerPaddingMm: 2 } });
    expect(state.global).toBeUndefined();
  });

  it.each(templates)("changes one of the two without touching the other in $name", ({ id }) => {
    const native = resolveTemplateCvDesign(id).spacing;
    const both = set(set(start(id), "document", "pageMarginMm", 20), "document", "innerPaddingMm", 3);
    expect(effective(both)).toMatchObject({ pageMarginMm: 20, innerPaddingMm: 3 });
    const withoutPadding = set(both, "document", "innerPaddingMm", undefined);
    expect(withoutPadding.draft.settings.cvOverrides).toEqual(native.pageMarginMm === 20 ? undefined : { spacing: { pageMarginMm: 20 } });
    expect(effective(withoutPadding)).toMatchObject({ pageMarginMm: 20, innerPaddingMm: native.innerPaddingMm });
    const withoutMargin = set(both, "document", "pageMarginMm", undefined);
    expect(withoutMargin.draft.settings.cvOverrides).toEqual({ spacing: { innerPaddingMm: 3 } });
    expect(effective(withoutMargin)).toMatchObject({ pageMarginMm: native.pageMarginMm, innerPaddingMm: 3 });
  });

  it("combines a shared margin with the document's own padding", () => {
    let state = set(start(), "global", "pageMarginMm", 16);
    state = set(state, "document", "innerPaddingMm", 2.5);
    expect(state.global).toEqual({ cvOverrides: { spacing: { pageMarginMm: 16 } } });
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { innerPaddingMm: 2.5 } });
    expect(effective(state)).toMatchObject({ pageMarginMm: 16, innerPaddingMm: 2.5 });
    expect(sourceOf(state, "pageMarginMm")).toBe("global");
    expect(sourceOf(state, "innerPaddingMm")).toBe("document");

    // The own padding changes: the shared layer is the very same object and the margin stays.
    const shared = state.global;
    state = set(state, "document", "innerPaddingMm", 2);
    expect(state.global).toBe(shared);
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { innerPaddingMm: 2 } });
    expect(effective(state)).toMatchObject({ pageMarginMm: 16, innerPaddingMm: 2 });

    // The shared margin changes: the document keeps its padding.
    state = set(state, "global", "pageMarginMm", 12);
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { innerPaddingMm: 2 } });
    expect(effective(state)).toMatchObject({ pageMarginMm: 12, innerPaddingMm: 2 });

    // Resetting the own padding returns to the template's padding and keeps the shared margin.
    state = set(state, "document", "innerPaddingMm", undefined);
    expect(state.draft.settings.cvOverrides).toBeUndefined();
    expect(state.global).toEqual({ cvOverrides: { spacing: { pageMarginMm: 12 } } });
    expect(effective(state)).toMatchObject({ pageMarginMm: 12, innerPaddingMm: resolveTemplateCvDesign("klassisch").spacing.innerPaddingMm });
    expect(sourceOf(state, "innerPaddingMm")).toBe("template");
    expect(sourceOf(state, "pageMarginMm")).toBe("global");
  });

  it("combines a shared padding with the document's own margin", () => {
    let state = set(start(), "global", "innerPaddingMm", 2.5);
    state = set(state, "document", "pageMarginMm", 10);
    expect(state.global).toEqual({ cvOverrides: { spacing: { innerPaddingMm: 2.5 } } });
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { pageMarginMm: 10 } });
    expect(effective(state)).toMatchObject({ pageMarginMm: 10, innerPaddingMm: 2.5 });
    expect(sourceOf(state, "pageMarginMm")).toBe("document");
    expect(sourceOf(state, "innerPaddingMm")).toBe("global");

    // The shared padding changes: the document keeps its margin.
    state = set(state, "global", "innerPaddingMm", 2);
    expect(state.draft.settings.cvOverrides).toEqual({ spacing: { pageMarginMm: 10 } });
    expect(effective(state)).toMatchObject({ pageMarginMm: 10, innerPaddingMm: 2 });

    // The own margin changes: the shared layer is the very same object.
    const shared = state.global;
    state = set(state, "document", "pageMarginMm", 16);
    expect(state.global).toBe(shared);
    expect(effective(state)).toMatchObject({ pageMarginMm: 16, innerPaddingMm: 2 });

    // Resetting the own margin returns to the template's margin, whatever the shared padding is.
    state = set(state, "document", "pageMarginMm", undefined);
    expect(state.draft.settings.cvOverrides).toBeUndefined();
    expect(effective(state)).toMatchObject({ pageMarginMm: templateMargin("klassisch"), innerPaddingMm: 2 });
    expect(sourceOf(state, "pageMarginMm")).toBe("template");
    expect(sourceOf(state, "innerPaddingMm")).toBe("global");
  });

  it("resets one field without touching the other, in both scopes", () => {
    let both = set(set(start(), "global", "pageMarginMm", 16), "global", "innerPaddingMm", 2.5);
    both = set(set(both, "document", "pageMarginMm", 10), "document", "innerPaddingMm", 2);
    expect(effective(both)).toMatchObject({ pageMarginMm: 10, innerPaddingMm: 2 });

    // Own padding: the shared padding shows again, the margin stays.
    const ownPadding = set(both, "document", "innerPaddingMm", undefined);
    expect(ownPadding.draft.settings.cvOverrides).toEqual({ spacing: { pageMarginMm: 10 } });
    expect(ownPadding.global).toEqual(both.global);
    expect(effective(ownPadding)).toMatchObject({ pageMarginMm: 10, innerPaddingMm: 2.5 });

    // Own margin: the shared margin shows again, the padding stays.
    const ownMargin = set(both, "document", "pageMarginMm", undefined);
    expect(ownMargin.draft.settings.cvOverrides).toEqual({ spacing: { innerPaddingMm: 2 } });
    expect(ownMargin.global).toEqual(both.global);
    expect(effective(ownMargin)).toMatchObject({ pageMarginMm: 16, innerPaddingMm: 2 });

    // Shared padding leaves the layer, while this document's own padding stays.
    const sharedPadding = set(both, "global", "innerPaddingMm", undefined);
    expect(sharedPadding.global).toEqual({ cvOverrides: { spacing: { pageMarginMm: 16 } } });
    expect(sharedPadding.draft.settings.cvOverrides).toEqual({ spacing: { pageMarginMm: 10, innerPaddingMm: 2 } });
    expect(effective(sharedPadding)).toMatchObject({ pageMarginMm: 10, innerPaddingMm: 2 });

    // Shared margin: the same the other way round.
    const sharedMargin = set(both, "global", "pageMarginMm", undefined);
    expect(sharedMargin.global).toEqual({ cvOverrides: { spacing: { innerPaddingMm: 2.5 } } });
    expect(sharedMargin.draft.settings.cvOverrides).toEqual({ spacing: { pageMarginMm: 10, innerPaddingMm: 2 } });
    expect(effective(sharedMargin)).toMatchObject({ pageMarginMm: 10, innerPaddingMm: 2 });
  });

  it("keeps the old slider level of the other field when one of them is edited", () => {
    const { draft } = start("klassisch");
    const state: DesignEditState = { draft: { ...draft, settings: { ...draft.settings, marginLevel: 7, paddingLevel: 3 } }, global: undefined };
    expect(effective(state)).toMatchObject({ pageMarginMm: 20, innerPaddingMm: 2.5 });
    const padded = set(state, "document", "innerPaddingMm", 2);
    expect(effective(padded)).toMatchObject({ pageMarginMm: 20, innerPaddingMm: 2 });
    expect(padded.draft.settings.cvOverrides).toEqual({ spacing: { innerPaddingMm: 2 } });
    expect(padded.draft.settings.marginLevel).toBe(7);
    const margined = set(state, "document", "pageMarginMm", 12);
    expect(effective(margined)).toMatchObject({ pageMarginMm: 12, innerPaddingMm: 2.5 });
    expect(margined.draft.settings.cvOverrides).toEqual({ spacing: { pageMarginMm: 12 } });
    expect(margined.draft.settings.paddingLevel).toBe(3);
  });

  it("preserves each template's native inner padding as a distinct spacing value", () => {
    for (const { id } of templates) expect(resolveTemplateCvDesign(id).spacing.innerPaddingMm, id).toBeGreaterThanOrEqual(0);
    const compact = applyResumeSpacingPreset(start("gepflegt").draft, "compact");
    expect(compact.settings.cvOverrides?.spacing?.innerPaddingMm).toBe(8);
    expect(compact.settings.cvOverrides?.spacing?.pageMarginMm).toBe(8);
  });
});
