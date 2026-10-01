import { describe, expect, it } from "vitest";
import { applicationSchema } from "./schema";
import { templates } from "./templates";
import { createDocumentDesignDraft, resetDocumentDesign, selectDocumentTemplate, updateCvDesignField } from "./documentEditorState";
import { cvDesignLimits } from "./cvDesignSchema";
import { resolveTemplateCvDesign } from "./cvDesign";
import { applyResumeSpacingPreset, getResumeSpacingPreset, getResumeSpacingPresetValues, resolveEffectiveResumeSpacing, resumeSpacingFields } from "./resumeSpacing";

const now = new Date().toISOString();
const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Spacing", company: { name: "Firma", city: "Berlin" },
  contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "modern", accentColor: "#123456", documents: {},
  statusHistory: [], createdAt: now, updatedAt: now });

describe("semantic resume spacing", () => {
  it.each(templates)("keeps $name native until a user chooses a spacing preset", ({ id }) => {
    const draft = selectDocumentTemplate(createDocumentDesignDraft(application), id);
    expect(getResumeSpacingPreset(id, draft.settings)).toBe("standard");
    expect(draft.settings.cvOverrides).toBeUndefined();
    for (const preset of ["compact", "large"] as const) {
      const changed = applyResumeSpacingPreset(draft, preset);
      expect(getResumeSpacingPreset(id, changed.settings)).toBe(preset);
      // The two gaps are separate settings; a template that draws them equally (Ivy League) scales them equally.
      const { sectionGapMm, entryGapMm } = resolveTemplateCvDesign(id).spacing;
      if (sectionGapMm !== entryGapMm)
        expect(changed.settings.cvOverrides?.spacing?.sectionGapMm).not.toBe(changed.settings.cvOverrides?.spacing?.entryGapMm);
      const values = getResumeSpacingPresetValues(id, preset);
      for (const { key } of resumeSpacingFields) {
        expect(values.spacing[key]).toBeGreaterThanOrEqual(cvDesignLimits[key][0]);
        expect(values.spacing[key]).toBeLessThanOrEqual(cvDesignLimits[key][1]);
      }
      expect(getResumeSpacingPreset(id, applyResumeSpacingPreset(changed, "standard").settings)).toBe("standard");
    }
  });

  it("stores entry spacing separately, survives template switches, and resets per template", () => {
    let draft = createDocumentDesignDraft(application);
    draft = updateCvDesignField(draft, "spacing", "entryGapMm", 7);
    expect(getResumeSpacingPreset("modern", draft.settings)).toBe("custom");
    expect(draft.settings.cvOverrides).toEqual({ spacing: { entryGapMm: 7 } });
    draft = selectDocumentTemplate(draft, "klassisch");
    expect(draft.settings.cvOverrides).toBeUndefined();
    draft = selectDocumentTemplate(draft, "modern");
    expect(draft.settings.cvOverrides).toEqual({ spacing: { entryGapMm: 7 } });
    expect(resetDocumentDesign(draft).settings.cvOverrides).toBeUndefined();
  });
  it("shows old slider values until a semantic override takes precedence", () => {
    const draft = createDocumentDesignDraft(application);
    const legacy = { ...draft.settings, marginLevel: 9 as const, sectionSpacingLevel: 8 as const };
    expect(resolveEffectiveResumeSpacing("modern", legacy).spacing.pageMarginMm).toBe(23);
    expect(resolveEffectiveResumeSpacing("modern", legacy).spacing.sectionGapMm).toBe(7.8);
    expect(resolveEffectiveResumeSpacing("modern", { ...legacy, cvOverrides: { spacing: { sectionGapMm: 4 } } }).spacing.sectionGapMm).toBe(4);
  });
});
