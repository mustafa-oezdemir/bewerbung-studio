import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cvDesignTokensSchema, nativeResumeDesignSchema } from "./cvDesignSchema";
import { getNativeResumeDesign, getTemplateDocumentDesignDefaults, resolveTemplateCvDesign, resolveTemplateResumeAppearance } from "./cvDesign";
import { nativeResumeDesigns } from "./cvTemplateTokens";
import { pehlioneWhiteBlueDefaults, pehlioneWhiteDefaults } from "./cvTemplateDefaults/pehlione.defaults";
import { getPehlioneNativeVariables, pehlioneAppearanceCss } from "./pehlioneAppearance";
import { fontSizeToPt, lineHeightLevelToValue } from "./documentDesign";
import { resolveSectionPresentation, zoneFlowTemplates } from "./resumeSectionPresentation";
import { getTemplate, templates } from "./templates";

const legacyTemplateIds = ["classic-professional", "modern-sidebar", "minimal-clean", "technical-developer", "executive-dark", "creative-accent"];

/** Measured on the rendered PDF at standard density; a change here is a change of a template's look. */
const nativeValues: Record<string, Record<string, number>> = {
  pehlione_white_blue: { body: 9.2, line: 1.2, name: 29, section: 13, entry: 9, sectionGap: 6, entryGap: 4, titleGap: 3, margin: 7 },
  pehlione_white: { body: 9.2, line: 1.2, name: 29, section: 13, entry: 10.4, sectionGap: 6, entryGap: 4, titleGap: 3, margin: 7 },
  zweispaltig: { body: 10, line: 1.32, name: 24, section: 14, entry: 11.5, sectionGap: 6.5, entryGap: 3.5, titleGap: 2.5, margin: 25 },
  zeitgenoessisch: { body: 10.5, line: 1.26, name: 25, section: 12.5, entry: 11.5, sectionGap: 7, entryGap: 5, titleGap: 3, margin: 20 },
  kreativ: { body: 10.5, line: 1.26, name: 23, section: 14, entry: 11, sectionGap: 4.5, entryGap: 2.5, titleGap: 3.5, margin: 20 },
  "ivy-league": { body: 8.4, line: 1.05, name: 17.5, section: 13.5, entry: 9.7, sectionGap: 4.5, entryGap: 4.5, titleGap: 2.5, margin: 11 },
  stilvoll: { body: 10.5, line: 1.25, name: 23, section: 11, entry: 11.5, sectionGap: 6, entryGap: 4, titleGap: 3, margin: 20 },
  kompakt: { body: 10.3, line: 1.2, name: 21, section: 11, entry: 11.3, sectionGap: 3.5, entryGap: 3.2, titleGap: 3, margin: 25 },
  einspaltig: { body: 9.6, line: 1.1, name: 24, section: 13.5, entry: 11.5, sectionGap: 5, entryGap: 4.5, titleGap: 2, margin: 15 },
  // DIN-oriented project standard (2026-10-07): 11 pt / 1.2, 14 pt titles, 25 mm left margin (right 20 mm in resolveKlassischGeometry).
  klassisch: { body: 11, line: 1.2, name: 24, section: 14, entry: 14, sectionGap: 6, entryGap: 4, titleGap: 2.5, margin: 25 },
  gepflegt: { body: 11, line: 1.3, name: 24, section: 14, entry: 12, sectionGap: 6.5, entryGap: 4, titleGap: 3.6, margin: 10 },
  elegant: { body: 10.5, line: 1.2, name: 22, section: 13, entry: 11, sectionGap: 4.5, entryGap: 2, titleGap: 3.2, margin: 10 },

  modern: { body: 9.2, line: 1.2, name: 24, section: 9.2, entry: 11, sectionGap: 7, entryGap: 4.5, titleGap: 3.2, margin: 15 },
  tabellarisch: { body: 9.2, line: 1.1, name: 25, section: 15, entry: 12, sectionGap: 6.3, entryGap: 4.4, titleGap: 3.5, margin: 15 },
};

describe("native Lebenslauf designs", () => {
  it("defines a complete, valid design for every selectable template", () => {
    expect(templates.map((template) => template.id).sort()).toEqual(Object.keys(nativeResumeDesigns).sort());
    for (const { id } of templates) {
      expect(nativeResumeDesignSchema.safeParse(getNativeResumeDesign(id)).success, id).toBe(true);
      expect(cvDesignTokensSchema.safeParse(resolveTemplateCvDesign(id)).success, id).toBe(true);
    }
  });

  it("hands out fresh copies so a caller can never change a template", () => {
    const design = getNativeResumeDesign("klassisch");
    design.tokens.spacing.sectionGapMm = 15;
    design.appearance.sectionHeadingAlignment = "right";
    expect(getNativeResumeDesign("klassisch").tokens.spacing.sectionGapMm).toBe(6);
    expect(resolveTemplateResumeAppearance("klassisch").sectionHeadingAlignment).toBe("left");
  });

  it.each(templates)("resolves the measured values of $name, not a generic default", ({ id }) => {
    const { typography, spacing } = resolveTemplateCvDesign(id);
    const expected = nativeValues[id];
    expect({
      body: typography.bodySizePt, line: typography.lineHeight, name: typography.headingSizePt, section: typography.sectionHeadingSizePt,
      entry: typography.entryHeadingSizePt, sectionGap: spacing.sectionGapMm, entryGap: spacing.entryGapMm,
      titleGap: spacing.sectionTitleGapMm, margin: spacing.pageMarginMm,
    }).toEqual(expected);
  });

  it("does not repeat one generic number set across the templates", () => {
    const signature = (id: string) => {
      const { typography, spacing } = resolveTemplateCvDesign(id);
      return JSON.stringify([typography.bodySizePt, typography.lineHeight, typography.headingSizePt, spacing.sectionGapMm, spacing.pageMarginMm]);
    };
    expect(new Set(templates.map(({ id }) => signature(id))).size).toBeGreaterThanOrEqual(templates.length - 1);
    // The former generic defaults must not survive as anyone's design.
    for (const { id } of templates) {
      const { typography, spacing } = resolveTemplateCvDesign(id);
      expect(`${typography.lineHeight}/${spacing.columnGapMm}/${spacing.innerPaddingMm}`, id).not.toBe("1.2/10/3.5");
    }
  });

  it("knows each template's real section title: capitals, alignment and weight", () => {
    for (const { id } of templates) {
      const { typography } = resolveTemplateCvDesign(id);
      expect(typography.sectionHeadingUppercase, id).toBe(id !== "ivy-league");
    }
    expect(resolveTemplateResumeAppearance("ivy-league").sectionHeadingAlignment).toBe("center");
    expect(resolveTemplateResumeAppearance("klassisch").sectionHeadingAlignment).toBe("left");
    expect(resolveTemplateCvDesign("ivy-league").typography.headingFontId).toBe("georgia");
    expect(resolveTemplateCvDesign("zeitgenoessisch").typography.headingWeight).toBe(350);
  });

  it("reads the section title style from the same numbers the heading renderer draws", () => {
    for (const id of zoneFlowTemplates) {
      const heading = resolveSectionPresentation(id, "experience", "main")?.heading;
      if (!heading) throw new Error(`${id} has no section presentation`);
      const native = getNativeResumeDesign(id);
      expect(heading.fontSizePt.standard, id).toBe(native.tokens.typography.sectionHeadingSizePt);
      expect(heading.fontWeight, id).toBe(native.tokens.typography.sectionHeadingWeight);
      expect(heading.textTransform === "uppercase", id).toBe(native.tokens.typography.sectionHeadingUppercase);
      expect(heading.marginBottom.standard, id).toBe(native.tokens.spacing.sectionTitleGapMm);
      expect(heading.textAlign ?? "left", id).toBe(native.appearance.sectionHeadingAlignment);
    }
  });

  it("stays in step with the document-level font size and line height that most stylesheets still read", () => {
    // Gepflegt sets its own sizes; Einspaltig adds a fixed offset to the document values in its stylesheet; Klassisch reads its
    // resolved design (getKlassischDesignVariables), not the document-level sliders.
    for (const { id } of templates.filter(({ id: templateId }) => !["gepflegt", "zeitgenoessisch", "elegant", "kreativ", "stilvoll", "kompakt", "klassisch"].includes(templateId))) {
      const settings = getTemplateDocumentDesignDefaults(id);
      const { typography } = resolveTemplateCvDesign(id);
      expect(typography.bodySizePt, id).toBeCloseTo(fontSizeToPt[settings.fontSize] + (id === "einspaltig" ? 1.2 : 0), 5);
      if (id !== "einspaltig") expect(typography.lineHeight, id).toBe(lineHeightLevelToValue[settings.lineHeightLevel]);
    }
    const zeit = resolveTemplateCvDesign("zeitgenoessisch").typography;
    expect(zeit.bodySizePt).toBe(10.5);
    expect(zeit.lineHeight).toBe(1.26);
    const kreativ = resolveTemplateCvDesign("kreativ").typography;
    expect(kreativ.bodySizePt).toBe(10.5);
    expect(kreativ.lineHeight).toBe(1.26);
    const stilvoll = resolveTemplateCvDesign("stilvoll").typography;
    expect(stilvoll.bodySizePt).toBe(10.5);
    expect(stilvoll.lineHeight).toBe(1.25);
  });

  it("derives the retired generic renderer's design from its document settings", () => {
    for (const id of legacyTemplateIds) {
      const design = getNativeResumeDesign(id);
      expect(nativeResumeDesignSchema.safeParse(design).success, id).toBe(true);
      const level = getTemplate(id).designDefaults?.lineHeightLevel;
      if (level) expect(design.tokens.typography.lineHeight, id).toBe(lineHeightLevelToValue[level]);
    }
  });

  it("keeps Pehlione's palette in its typed module and the stylesheets in step with it", () => {
    const stylesheets = ["pehlione.css", "pehlione-white.css", "pehlione-blocks.css"]
      .map((name) => readFileSync(`src/components/resume/templates/pehlione/${name}`, "utf8")).join("\n").toLowerCase()
      + readFileSync("electron/documents.ts", "utf8").toLowerCase();
    for (const defaults of [pehlioneWhiteBlueDefaults, pehlioneWhiteDefaults]) {
      for (const key of ["primary", "text", "surface", "photoDecoration"] as const)
        expect(stylesheets, `${key} ${defaults.colors[key]}`).toContain(defaults.colors[key].toLowerCase());
    }
    expect(nativeResumeDesigns.pehlione_white_blue.tokens.colors.accent).toBe(pehlioneWhiteBlueDefaults.colors.primary);
    expect(nativeResumeDesigns.pehlione_white.appearance.photoDecorationColor).toBe(pehlioneWhiteDefaults.colors.photoDecoration);
  });

  it("feeds Pehlione's native typography and spacing into both stylesheet surfaces", () => {
    const previewCss = readFileSync("src/components/resume/templates/pehlione/pehlione.css", "utf8");
    const pdfCss = readFileSync("electron/documents.ts", "utf8");
    for (const id of ["pehlione_white_blue", "pehlione_white"] as const) {
      const native = getNativeResumeDesign(id);
      const variables = getPehlioneNativeVariables(id);
      expect(variables["--pehlione-native-heading-size"]).toBe(`${native.tokens.typography.headingSizePt}pt`);
      expect(variables["--pehlione-native-entry-heading-size"]).toBe(`${native.tokens.typography.entryHeadingSizePt}pt`);
      expect(variables["--pehlione-native-section-gap"]).toBe(`${native.tokens.spacing.sectionGapMm}mm`);
      expect(pehlioneAppearanceCss).toContain(`--pehlione-native-entry-heading-size:${native.tokens.typography.entryHeadingSizePt}pt`);
    }
    for (const css of [previewCss, pdfCss]) {
      expect(css).toContain("font-size:var(--pehlione-native-heading-size)");
      expect(css).toContain("font-size:var(--pehlione-native-entry-heading-size)");
      expect(css).toContain("var(--pehlione-native-section-gap)");
    }
  });
});
