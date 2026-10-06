import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { resolveTemplateCvDesign } from "../../../../shared/cvDesign";
import { maximalProfile } from "../../__parityFixture";
import { harnessApplication, renderCv } from "../../__parityHarness";

/** The Lebenslauf-Design values with which the Elegant page drew its section titles over the header and photo. */
const reported = { typography: { bodySizePt: 9 }, spacing: { innerPaddingMm: 2, sectionGapMm: 6, columnGapMm: 5 } };
const withSpacing = (cvOverrides: Record<string, unknown>) => ({ overrides: { cvOverrides } as never });
const scopes = (result: ReturnType<typeof renderCv>) => ({
  preview: result.previewPages.map((page) => page.querySelector(".elegant-template") as Element),
  pdf: result.pdfPages.map((page) => page.querySelector(".page-content") as Element),
});
const styleValue = (element: Element, name: string) =>
  (element.getAttribute("style") ?? "").split(";").map((part) => part.split(":")).find(([key]) => key.trim() === name)?.[1]?.trim();

describe("Elegant with own Seitenränder / Innenabstand", () => {
  it("adds the chosen inner inset to the resolved physical column padding", () => {
    expect(resolveTemplateCvDesign("elegant").spacing.innerPaddingMm).toBe(0);
    for (const innerPaddingMm of [0, 2, 13, 16]) {
      const result = renderCv("elegant", maximalProfile(), withSpacing({ spacing: { innerPaddingMm } }));
      for (const [surface, list] of Object.entries(scopes(result)))
        for (const scope of list) {
          expect(styleValue(scope, "--elegant-main-left"), `${surface} ${innerPaddingMm}`).toBe(`${25 + innerPaddingMm}mm`);
          expect(styleValue(scope, "--elegant-sidebar-right"), `${surface} ${innerPaddingMm}`).toBe(`${20 + innerPaddingMm}mm`);
        }
    }
  });

  it("lets an explicit page margin move the column box without shifting section text twice", () => {
    for (const cvOverrides of [reported, { spacing: { pageMarginMm: 6 } }, { spacing: { pageMarginMm: 6, innerPaddingMm: 0 } }]) {
      const result = renderCv("elegant", maximalProfile(), withSpacing(cvOverrides));
      for (const [surface, list] of Object.entries(scopes(result))) {
        const first = list[0];
        expect(first.hasAttribute("data-resume-spacing-text"), surface).toBe(false);
        expect(first.querySelector("main"), surface).not.toBeNull();
        expect(first.querySelector("aside"), surface).not.toBeNull();
      }
    }
    const small = renderCv("elegant", maximalProfile(), withSpacing({ spacing: { pageMarginMm: 6 } }));
    for (const list of Object.values(scopes(small))) {
      expect(styleValue(list[0], "--elegant-main-left")).toBe("6mm");
      expect(styleValue(list[0], "--elegant-sidebar-right")).toBe("1mm");
    }
  });

  it("keeps the photo at its size however full the sidebar is, in the preview and the PDF", () => {
    const previewCss = readFileSync(resolve(__dirname, "elegant.css"), "utf8");
    expect(previewCss).toMatch(/\.elegant-sidebar__photo \{[^}]*flex-shrink: 0;/);
    const pdf = buildDocumentHtml(harnessApplication("elegant"), maximalProfile(), "lebenslauf");
    expect(pdf).toMatch(/\.elegant-pdf-photo\{[^}]*flex-shrink:0/);
  });

  it("shows the same sections on the same pages in preview and PDF with the reported settings", () => {
    const result = renderCv("elegant", maximalProfile(), withSpacing(reported));
    expect(result.previewSemantic.sections).toEqual(result.pdfSemantic.sections);
    expect(result.previewPages.length).toBe(result.pdfPages.length);
  });
});
