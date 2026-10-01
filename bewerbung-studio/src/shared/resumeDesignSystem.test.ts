import { describe, expect, it } from "vitest";
import { applicationSchema } from "./schema";
import { resolveCvDocument } from "./resolveCvDocument";
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign, resolveTemplateResumeAppearance } from "./cvDesign";
import { cvDesignOverridesSchema, resumeDesignLayerSchema, type ResumeDesignLayer } from "./cvDesignSchema";
import {
  applyGlobalResumeDesign, compactResumeAppearance, compactResumeDesignLayer, mergeCvDesignOverrides, mergeResumeAppearance,
  resolveEffectiveDesignTokens, resolveResumeAppearance, resolveResumeDesignView,
} from "./resumeDesignSystem";
import { templates } from "./templates";

const settingsOf = (id: string) => getTemplateDocumentDesignDefaults(id);
const sharedLayer: ResumeDesignLayer = {
  cvOverrides: { spacing: { sectionGapMm: 7 }, typography: { sectionHeadingSizePt: 13, lineHeight: 1.3 }, colors: { accent: "#123456" } },
  resumeAppearance: { sectionHeadingAlignment: "center" },
};

describe("Lebenslauf design layers", () => {
  it("merges later layers over earlier ones, field by field, and drops empty groups", () => {
    expect(mergeCvDesignOverrides({ spacing: { sectionGapMm: 5, entryGapMm: 3 } }, undefined, { spacing: { sectionGapMm: 6 }, colors: {} }))
      .toEqual({ spacing: { sectionGapMm: 6, entryGapMm: 3 } });
    expect(mergeCvDesignOverrides({ colors: { accent: "#111111" } }, { colors: { accent: undefined } })).toEqual({ colors: { accent: "#111111" } });
    expect(mergeCvDesignOverrides(undefined, {})).toEqual({});
  });

  it("treats the divider decision as one pair across layers", () => {
    expect(mergeResumeAppearance({ sectionDividerVisible: false }, { sectionDividerPosition: "top" })).toEqual({ sectionDividerPosition: "top" });
    expect(mergeResumeAppearance({ sectionDividerPosition: "top", sectionDividerWidthMm: 1 }, { sectionDividerVisible: false }))
      .toEqual({ sectionDividerVisible: false, sectionDividerWidthMm: 1 });
  });

  it("returns the very same settings object while no shared layer exists", () => {
    const settings = settingsOf("klassisch");
    expect(applyGlobalResumeDesign(settings, undefined)).toBe(settings);
    expect(applyGlobalResumeDesign(settings, {})).toBe(settings);
    expect(applyGlobalResumeDesign(settings, { cvOverrides: {} })).toBe(settings);
  });

  it("puts the shared layer below the document's own overrides and never changes the input", () => {
    const settings = { ...settingsOf("klassisch"), cvOverrides: { spacing: { sectionGapMm: 4 } }, resumeAppearance: { sectionHeadingAlignment: "right" as const } };
    const frozen = JSON.stringify(settings);
    const merged = applyGlobalResumeDesign(settings, sharedLayer);
    expect(merged.cvOverrides).toEqual({ spacing: { sectionGapMm: 4 }, typography: { sectionHeadingSizePt: 13, lineHeight: 1.3 }, colors: { accent: "#123456" } });
    expect(merged.resumeAppearance).toEqual({ sectionHeadingAlignment: "right" });
    expect(JSON.stringify(settings)).toBe(frozen);
  });

  it("validates the shared layer with the sparse schemas and stores no defaults", () => {
    expect(resumeDesignLayerSchema.parse({})).toEqual({});
    expect(resumeDesignLayerSchema.parse(JSON.parse(JSON.stringify(sharedLayer)))).toEqual(sharedLayer);
    expect(() => cvDesignOverridesSchema.parse({ spacing: { sectionGapMm: 99 } })).toThrow();
    expect(compactResumeDesignLayer({ cvOverrides: { spacing: {}, colors: { accent: undefined } }, resumeAppearance: {} })).toBeUndefined();
  });

  describe.each(templates)("for $name", ({ id }) => {
    const native = resolveTemplateCvDesign(id);

    it("shows the template's own value while no layer holds one", () => {
      const view = resolveResumeDesignView(id, settingsOf(id));
      expect(view.effective.tokens).toEqual(native);
      expect(view.inherited.tokens).toEqual(native);
      expect(view.effective.appearance).toEqual(resolveResumeAppearance(id));
      expect(view.sourceOfToken("spacing", "sectionGapMm")).toBe("template");
      expect(view.hasGlobalOverrides).toBe(false);
      expect(view.hasDocumentOverrides).toBe(false);
    });

    it("applies the shared values to the template and keeps the other values native", () => {
      const view = resolveResumeDesignView(id, settingsOf(id), sharedLayer);
      expect(view.effective.tokens.spacing.sectionGapMm).toBe(7);
      expect(view.effective.tokens.typography.sectionHeadingSizePt).toBe(13);
      expect(view.effective.tokens.typography.lineHeight).toBe(1.3);
      expect(view.effective.appearance.sectionHeadingAlignment).toBe("center");
      expect(view.native.tokens).toEqual(native);
      expect(view.effective.tokens.spacing.entryGapMm).toBe(native.spacing.entryGapMm);
      expect(view.effective.tokens.typography.bodySizePt).toBe(native.typography.bodySizePt);
      expect(view.sourceOfToken("spacing", "sectionGapMm")).toBe("global");
      expect(view.sourceOfToken("spacing", "entryGapMm")).toBe("template");
      expect(view.sourceOfAppearance("sectionHeadingAlignment")).toBe("global");
    });

    it("lets the document override a shared value, and returns to it when the override is gone", () => {
      const own = { ...settingsOf(id), cvOverrides: { spacing: { sectionGapMm: 3 } } };
      const view = resolveResumeDesignView(id, own, sharedLayer);
      expect(view.effective.tokens.spacing.sectionGapMm).toBe(3);
      expect(view.inherited.tokens.spacing.sectionGapMm).toBe(7);
      expect(view.sourceOfToken("spacing", "sectionGapMm")).toBe("document");
    });

    it("goes back to the template's own design when the shared layer is removed", () => {
      expect(resolveResumeDesignView(id, settingsOf(id), undefined).effective.tokens).toEqual(native);
      expect(resolveCvDocument({ profile: undefined, templateId: id, settings: settingsOf(id) }).design).toEqual(native);
    });

    it("gives the shared layer to the single CV projection used by preview, PDF and the page planner", () => {
      const resolved = resolveCvDocument({ profile: undefined, templateId: id, settings: settingsOf(id), globalDesign: sharedLayer });
      expect(resolved.design.spacing.sectionGapMm).toBe(7);
      expect(resolved.settings.cvOverrides?.spacing?.sectionGapMm).toBe(7);
      expect(resolved.settings.resumeAppearance?.sectionHeadingAlignment).toBe("center");
      expect(resolveCvDocument({ profile: undefined, templateId: id, settings: settingsOf(id) }).settings).toEqual(settingsOf(id));
    });
  });

  it("shows saved legacy slider and font values until a semantic value names the same field", () => {
    const legacy = { ...settingsOf("modern"), marginLevel: 9 as const, lineHeightLevel: 9 as const, fontId: "roboto" as const, fontSize: "large" as const };
    const view = resolveResumeDesignView("modern", legacy);
    expect(view.effective.tokens.spacing.pageMarginMm).toBe(23);
    expect(view.effective.tokens.typography.lineHeight).toBe(1.44);
    expect(view.effective.tokens.typography.fontId).toBe("roboto");
    expect(view.effective.tokens.typography.bodySizePt).toBeCloseTo(9.2 + 10 - 9.2, 5);
    expect(view.sourceOfToken("spacing", "pageMarginMm")).toBe("document");
    // A shared value outranks a legacy level, and the document's own semantic value outranks both.
    expect(resolveResumeDesignView("modern", legacy, { cvOverrides: { spacing: { pageMarginMm: 12 } } }).effective.tokens.spacing.pageMarginMm).toBe(12);
    expect(resolveEffectiveDesignTokens("modern", { ...legacy, cvOverrides: { spacing: { pageMarginMm: 9 } } }).spacing.pageMarginMm).toBe(9);
  });

  it("keeps the old appearance field for the space below a title as the same setting as the title gap", () => {
    const settings = { ...settingsOf("klassisch"), resumeAppearance: { sectionHeadingMarginAfterMm: 5 } };
    const view = resolveResumeDesignView("klassisch", settings, { cvOverrides: { spacing: { sectionTitleGapMm: 4 } } });
    expect(view.effective.tokens.spacing.sectionTitleGapMm).toBe(5);
    expect(view.sourceOfToken("spacing", "sectionTitleGapMm")).toBe("document");
    const explicit = resolveResumeDesignView("klassisch", { ...settings, cvOverrides: { spacing: { sectionTitleGapMm: 6 } } });
    expect(explicit.effective.tokens.spacing.sectionTitleGapMm).toBe(6);
  });

  describe("appearance", () => {
    it("resolves the real alignment of the template for the value 'Vorlage'", () => {
      for (const { id } of templates) {
        expect(resolveResumeAppearance(id).sectionHeadingAlignment, id).toBe(id === "ivy-league" ? "center" : "left");
        expect(resolveResumeAppearance(id, { sectionHeadingAlignment: undefined }).sectionHeadingAlignment, id).toBe(resolveResumeAppearance(id).sectionHeadingAlignment);
      }
      expect(resolveResumeAppearance("klassisch", { sectionHeadingAlignment: "right" }).sectionHeadingAlignment).toBe("right");
    });

    it("derives the line from one decision: a template without a rule gets the default width when one is turned on", () => {
      const native = resolveResumeAppearance("klassisch");
      expect(native.sectionDividerVisible).toBe(false);
      expect(native.sectionDividerWidthMm).toBe(0);
      const on = resolveResumeAppearance("klassisch", { sectionDividerPosition: "bottom" });
      expect(on).toMatchObject({ sectionDividerVisible: true, sectionDividerPosition: "bottom", sectionDividerWidthMm: 0.3 });
      expect(resolveResumeAppearance("einspaltig", { sectionDividerVisible: false }).sectionDividerPosition).toBe("none");
      expect(resolveResumeAppearance("einspaltig", { sectionDividerWidthMm: 0.8 }).sectionDividerWidthMm).toBe(0.8);
    });

    it("stores only what differs from the template (and the shared layer)", () => {
      const inherited = resolveResumeAppearance("zweispaltig");
      const native = resolveTemplateResumeAppearance("zweispaltig");
      expect(compactResumeAppearance({
        mainBackgroundColor: native.mainBackgroundColor.toLowerCase(), sectionDividerPosition: native.sectionDividerPosition,
        sectionDividerWidthMm: native.sectionDividerWidthMm, sidebarTextColor: "#ffffff", photoLayout: "template", headerLayout: "left",
      }, inherited)).toEqual({ sidebarTextColor: "#ffffff" });
      const shared = resolveResumeAppearance("zweispaltig", { sectionHeadingAlignment: "center" });
      expect(compactResumeAppearance({ sectionHeadingAlignment: "center" }, shared)).toEqual({});
      expect(compactResumeAppearance({ sectionHeadingAlignment: "left" }, shared)).toEqual({ sectionHeadingAlignment: "left" });
    });
  });

  it("is sparse by construction: a document without changes never inherits a stored copy of a template value", () => {
    const application = applicationSchema.parse({
      schemaVersion: 1, id: crypto.randomUUID(), folderName: "X", company: { name: "X", city: "Berlin" }, contact: {}, job: { title: "Y" },
      status: "Entwurf", templateId: "klassisch", accentColor: "#123456", documents: {}, statusHistory: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    const view = resolveResumeDesignView("klassisch", application.designSettings, sharedLayer);
    expect(view.effective.tokens.spacing.sectionGapMm).toBe(7);
    expect(application.designSettings.cvOverrides).toBeUndefined();
    expect(application.designSettings.resumeAppearance).toBeUndefined();
  });
});
