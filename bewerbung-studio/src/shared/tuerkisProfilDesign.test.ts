import { describe, expect, it } from "vitest";
import { getTuerkisDesignVariables, resolveTuerkisGeometry } from "./tuerkisProfilDesign";
import { resolveTemplateCvDesign } from "./cvDesign";
import { resolveEffectiveDesignTokens } from "./resumeDesignSystem";
import { defaultDocumentDesign } from "./documentDesign";

describe("Türkis Profil DIN page", () => {
  it("keeps the DIN margins (25 / 20 mm sides, 25 mm top, 20 mm bottom) without a choice", () => {
    const page = resolveTuerkisGeometry();
    expect([page.left, page.right, page.top, page.bottom]).toEqual([25, 20, 25, 20]);
    expect(page.contentWidth).toBe(165);
    expect(page.contentBottom).toBe(277);
    // 40 % of the text width beside the 8 mm column gap
    expect(page.sideWidth).toBeCloseTo(62.8, 5);
    expect(page.mainWidth).toBeCloseTo(94.2, 5);
    expect(page.mainLeft).toBeCloseTo(95.8, 5);
  });

  it("moves only the side edges with Seitenränder: top and bottom stay", () => {
    for (const margin of [10, 18, 30]) {
      const page = resolveTuerkisGeometry(margin);
      expect([page.left, page.right, page.top, page.bottom]).toEqual([margin, margin, 25, 20]);
      expect(page.contentWidth).toBe(210 - 2 * margin);
    }
  });

  it("sets 11 pt text at 1.25 and 14 pt section titles, and draws them from the design on both surfaces", () => {
    const design = resolveTemplateCvDesign("tuerkis-profil");
    expect(design.typography.bodySizePt).toBe(11);
    expect(design.typography.lineHeight).toBe(1.25);
    expect(design.typography.sectionHeadingSizePt).toBe(14);
    const variables = getTuerkisDesignVariables(design);
    expect(variables["--doc-body-size"]).toBe("11pt");
    expect(variables["--tuerkis-section-title-size"]).toBe("14pt");
    expect([variables["--tuerkis-margin-left"], variables["--tuerkis-margin-right"], variables["--tuerkis-margin-top"], variables["--tuerkis-margin-bottom"]])
      .toEqual(["25mm", "20mm", "25mm", "20mm"]);
  });

  it("ignores the document-wide size sliders a new Bewerbung carries (wizard defaults)", () => {
    const tokens = resolveEffectiveDesignTokens("tuerkis-profil", { ...defaultDocumentDesign, marginLevel: 5, fontSize: "medium", lineHeightLevel: 5, sectionSpacingLevel: 5 });
    expect(tokens.typography.bodySizePt).toBe(11);
    expect(tokens.typography.lineHeight).toBe(1.25);
    expect(resolveTuerkisGeometry(tokens.spacing.pageMarginMm)).toMatchObject({ left: 25, right: 20 });
  });
});
