import { describe, expect, it } from "vitest";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { stilvollDefaults } from "./cvTemplateDefaults/stilvoll.defaults";
import { getPaginationGeometry } from "./resumePaginationGeometry";
import { estimateStilvollHeaderTop } from "./resumeHeaderGeometry";
import { resolveEffectiveDesignTokens } from "./resumeDesignSystem";
import { makeEducationFlowProfile } from "./__educationFlowFixture";
import { getStilvollDesignVariables, stilvollLetterCss, stilvollResolvedCss } from "./stilvollDesign";

describe("resolved Stilvoll design", () => {
  it("uses the DIN-safe native content box in both the planner and CSS variables", () => {
    const design = resolveEffectiveDesignTokens("stilvoll", getTemplateDocumentDesignDefaults("stilvoll"));
    const vars = getStilvollDesignVariables(design, undefined);
    const geometry = getPaginationGeometry("stilvoll");
    expect(stilvollDefaults.page).toMatchObject({ widthMm: 210, heightMm: 297, marginLeftMm: 25, marginRightMm: 20, marginBottomMm: 15 });
    expect(geometry.contentLeft).toBe(85);
    expect(geometry.contentRight).toBe(190);
    expect(geometry.text.sideW).toBe(50);
    expect(geometry.text.mainW).toBe(105);
    expect(vars).toMatchObject({ "--stilvoll-margin-left": "25mm", "--stilvoll-margin-right": "20mm",
      "--stilvoll-margin-bottom": "15mm", "--stilvoll-column-gap": "10mm", "--doc-body-size": "10.5pt", "--doc-line-height": "1.25" });
    expect(stilvollResolvedCss).toContain("padding-left:var(--stilvoll-margin-left)");
    expect(stilvollResolvedCss).toContain("padding-right:var(--stilvoll-margin-right)");
    expect(stilvollResolvedCss).toContain("font-size:var(--doc-body-size)");
  });

  it("honors a narrow explicit margin and derives the entire blue palette", () => {
    const settings = { ...getTemplateDocumentDesignDefaults("stilvoll"),
      cvOverrides: { spacing: { pageMarginMm: 10 }, colors: { accent: "#2457A6", entryHeading: "#173A6B" } } };
    const design = resolveEffectiveDesignTokens("stilvoll", settings);
    const vars = getStilvollDesignVariables(design, settings.cvOverrides.colors, "#2457A6", "#173A6B");
    expect(vars).toMatchObject({ "--stilvoll-primary": "#2457A6", "--stilvoll-primary-dark": "#173A6B",
      "--stilvoll-margin-left": "15mm", "--stilvoll-margin-right": "10mm", "--stilvoll-margin-bottom": "15mm" });
    for (const property of ["--stilvoll-text", "--stilvoll-muted", "--stilvoll-section-heading", "--stilvoll-divider",
      "--stilvoll-pattern", "--stilvoll-inactive", "--stilvoll-icon-surface"]) {
      expect(vars[property], property).toMatch(/^#[0-9A-F]{6}$/);
      expect(Object.values(stilvollDefaults.colors), property).not.toContain(vars[property]);
    }
    expect(stilvollResolvedCss).not.toContain("max(15mm");
    expect(stilvollLetterCss).toContain("--letter-subject-size");
    expect(stilvollLetterCss).toContain("--letter-body-size");
  });

  it("reserves more header space when the resolved name and title sizes grow", () => {
    const profile = { ...makeEducationFlowProfile(), firstName: "Mina-Sophia-Alexandra", title: "Industrieingenieurin für Produktionskoordination und Prozessplanung" };
    const top = (namePt: number, titlePt: number) =>
      estimateStilvollHeaderTop(profile, true, true, 10.5, 1.25, 0, namePt, titlePt);
    expect(top(31, 16)).toBeGreaterThan(top(23, 12));
  });
});
