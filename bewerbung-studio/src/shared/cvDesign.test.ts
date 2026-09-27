import { describe, expect, it } from "vitest";
import { templates } from "./templates";
import { cvDesignLimits, cvDesignOverridesSchema, cvDesignTokensSchema, type CvDesignOverrides } from "./cvDesignSchema";
import { compactCvDesignOverrides, getCvDesignVariables, getTemplateDocumentDesignDefaults, resolveCvDesign, resolveTemplateCvDesign } from "./cvDesign";
import { cvTemplateTokens } from "./cvTemplateTokens";
import { modernTemplateDefaults } from "./cvTemplateDefaults/modern.defaults";

describe("shared CV design foundation", () => {
  it.each(templates)("resolves independent, valid defaults for $name", (template) => {
    expect(cvTemplateTokens[template.id]).toBeDefined();
    const defaults = resolveTemplateCvDesign(template.id);
    expect(cvDesignTokensSchema.safeParse(defaults).success).toBe(true);
    expect(resolveCvDesign(template.id)).toEqual(defaults);
    expect(resolveCvDesign(template.id, {})).toEqual(defaults);
    defaults.colors.heading = "#abcdef";
    defaults.spacing.sectionGapMm = 15;
    expect(resolveTemplateCvDesign(template.id)).not.toEqual(defaults);
  });

  it("reuses the exact existing constants and retains distinct template palettes", () => {
    expect(resolveCvDesign("modern").colors.heading).toBe(modernTemplateDefaults.colors.heading);
    expect(resolveCvDesign("kompakt").colors.accent).toBe("#FF6200");
    expect(resolveCvDesign("klassisch").colors.accent).toBe("#00AFC5");
    expect(resolveCvDesign("einfach")).toEqual(resolveCvDesign("einspaltig"));
    expect(cvDesignTokensSchema.safeParse(resolveCvDesign("classic-professional")).success).toBe(true);
  });

  it.each(Object.keys(resolveCvDesign("modern").colors))("overrides only color %s", (key) => {
    const defaults = resolveCvDesign("modern");
    const changed = resolveCvDesign("modern", { colors: { [key]: "#123456" } });
    expect(changed).toEqual({ ...defaults, colors: { ...defaults.colors, [key]: "#123456" } });
  });

  it("keeps typography and spacing independent and converts physical units once", () => {
    const changed = resolveCvDesign("modern", {
      typography: { bodySizePt: 10.5, headingFontId: "georgia", lineHeight: 1.5 },
      spacing: { pageMarginMm: 20, innerPaddingMm: 4, sectionGapMm: 7, entryGapMm: 3 },
    });
    expect(getCvDesignVariables(changed)).toMatchObject({
      "--doc-body-size": "10.5pt", "--doc-line-height": "1.5",
      "--doc-margin": "20mm", "--doc-padding": "4mm",
      "--doc-section-gap": "7mm", "--doc-entry-gap": "3mm",
    });
    expect(getCvDesignVariables(changed)["--doc-heading-font"]).toContain("Georgia");
    expect(changed.colors).toEqual(resolveCvDesign("modern").colors);
  });

  it("stores only changed fields, including after serialization and explicit undefined", () => {
    const defaults = resolveCvDesign("modern");
    const overrides = compactCvDesignOverrides("modern", {
      colors: { heading: defaults.colors.heading.toLowerCase(), accent: "#123456", text: undefined },
      typography: { bodySizePt: defaults.typography.bodySizePt }, spacing: {},
    });
    expect(overrides).toEqual({ colors: { accent: "#123456" } });
    expect(resolveCvDesign("modern", JSON.parse(JSON.stringify(overrides)))).toEqual(resolveCvDesign("modern", overrides));
    expect(resolveCvDesign("modern", { colors: { text: undefined } })).toEqual(defaults);
    expect(compactCvDesignOverrides("modern", defaults)).toEqual({});
  });

  it.each(Object.entries(cvDesignLimits))("rejects unsafe values for %s", (key, [minimum, maximum]) => {
    const group = key.endsWith("Mm") ? "spacing" : "typography";
    for (const value of [minimum - 0.1, maximum + 0.1, Infinity, NaN]) {
      expect(cvDesignOverridesSchema.safeParse({ [group]: { [key]: value } }).success).toBe(false);
    }
  });

  it("rejects invalid colors and fonts without inserting implicit overrides", () => {
    expect(cvDesignOverridesSchema.parse({})).toEqual({});
    expect(() => resolveCvDesign("modern", { colors: { text: "red;display:none" } })).toThrow();
    expect(cvDesignOverridesSchema.safeParse({ typography: { fontId: "unknown-font" } }).success).toBe(false);
    const settings = getTemplateDocumentDesignDefaults("modern");
    settings.textColor = "#abcdef";
    expect(getTemplateDocumentDesignDefaults("modern").textColor).not.toBe("#abcdef");
  });

  it("preserves caller-owned override values", () => {
    const overrides: CvDesignOverrides = { colors: { accent: "#123456" } };
    resolveCvDesign("modern", overrides);
    expect(overrides).toEqual({ colors: { accent: "#123456" } });
  });
});
