import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { resolveTemplateCvDesign } from "../../../../shared/cvDesign";
import { resumeSpacingCss } from "../../../../shared/resumeSpacing";
import { setResumePhotoVisible } from "../../../../shared/resumePhoto";
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
  it("draws no inner padding of its own, so a chosen Innenabstand is an inset and never a pull", () => {
    expect(resolveTemplateCvDesign("elegant").spacing.innerPaddingMm).toBe(0);
    for (const innerPaddingMm of [0, 2, 13, 16]) {
      const result = renderCv("elegant", maximalProfile(), withSpacing({ spacing: { innerPaddingMm } }));
      for (const [surface, list] of Object.entries(scopes(result)))
        for (const scope of list) expect(styleValue(scope, "--resume-inner-text-inset"), `${surface} ${innerPaddingMm}`).toBe(`${innerPaddingMm}mm`);
    }
  });

  it("never pulls the first section of a column onto the header or the photo above it", () => {
    for (const cvOverrides of [reported, { spacing: { pageMarginMm: 6 } }, { spacing: { pageMarginMm: 6, innerPaddingMm: 0 } }]) {
      const result = renderCv("elegant", maximalProfile(), withSpacing(cvOverrides));
      for (const [surface, list] of Object.entries(scopes(result))) {
        const first = list[0];
        const main = first.querySelector("main") ?? first;
        const aside = first.querySelector("aside")!;
        for (const [column, root] of [["main", main], ["sidebar", aside]] as const) {
          const section = root.querySelector("[data-resume-spacing-edge-start]");
          expect(section, `${surface} ${column}: first section`).not.toBeNull();
          // A header (main) or the photo (sidebar) stands above it: the section keeps its place below. Without a
          // photo the sidebar section is the top of its column and may follow a smaller margin.
          const above = column === "main" || Boolean(root.querySelector("img, figure"));
          expect(section!.hasAttribute("data-resume-spacing-after-content"), `${surface} ${column}`).toBe(above);
        }
      }
    }
    // With a photo the first sidebar section stands below it.
    const photo = setResumePhotoVisible(maximalProfile({ photoPath: "data:image/png;base64,AA==" }), true);
    const pdf = parseHTML(buildDocumentHtml(harnessApplication("elegant", { cvOverrides: reported } as never), photo, "lebenslauf")).document;
    const aside = pdf.querySelector(".cv-sheet aside")!;
    expect(aside.querySelector("img")).not.toBeNull();
    expect(aside.querySelector("[data-resume-spacing-edge-start]")?.hasAttribute("data-resume-spacing-after-content")).toBe(true);
    expect(resumeSpacingCss).toContain("[data-resume-spacing-edge-start][data-resume-spacing-after-content] > :first-child{margin-block-start:0mm!important}");
    expect(resumeSpacingCss).toContain("[data-resume-spacing-edge-end][data-resume-spacing-before-content] > :last-child{margin-block-end:0mm!important}");
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
