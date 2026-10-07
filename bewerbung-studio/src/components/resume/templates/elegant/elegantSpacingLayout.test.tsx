import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { resolveTemplateCvDesign } from "../../../../shared/cvDesign";
import { maximalProfile, minimalProfile } from "../../__parityFixture";
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
  it("uses 10 mm at both outer edges and keeps long contacts on a single full-width row", () => {
    const result = renderCv("elegant", maximalProfile());
    const [preview] = scopes(result).preview;
    const [pdf] = scopes(result).pdf;
    expect(styleValue(preview, "--elegant-main-left")).toBe("10mm");
    expect(styleValue(preview, "--elegant-sidebar-right")).toBe("10mm");
    expect(styleValue(pdf, "--elegant-main-left")).toBe("10mm");
    expect(styleValue(pdf, "--elegant-sidebar-right")).toBe("10mm");
    expect(resolveTemplateCvDesign("elegant").spacing.columnGapMm).toBe(8);
    expect(styleValue(preview, "--elegant-main-right")).toBe("8mm");
    expect(styleValue(preview, "--elegant-sidebar-left")).toBe("8mm");
    expect(styleValue(pdf, "--elegant-main-right")).toBe("8mm");
    expect(styleValue(pdf, "--elegant-sidebar-left")).toBe("8mm");
    expect(preview.querySelectorAll(".elegant-header__contacts > *").length).toBeGreaterThan(2);
    expect(preview.querySelectorAll(".elegant-header__contact--wide").length).toBeGreaterThan(0);
    expect(pdf.querySelectorAll(".elegant-pdf-contact-wide").length).toBeGreaterThan(0);
    const previewCss = readFileSync(resolve(__dirname, "elegant.css"), "utf8");
    expect(previewCss).toMatch(/\.elegant-header__contacts \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it("brings both columns close to the color boundary at zero Spaltenabstand without touching it", () => {
    const result = renderCv("elegant", maximalProfile(), withSpacing({ spacing: { columnGapMm: 0 } }));
    for (const list of Object.values(scopes(result))) {
      expect(styleValue(list[0], "--elegant-main-right")).toBe("4mm");
      expect(styleValue(list[0], "--elegant-sidebar-left")).toBe("4mm");
      expect(styleValue(list[0], "--elegant-main-left")).toBe("10mm");
      expect(styleValue(list[0], "--elegant-sidebar-right")).toBe("10mm");
    }
  });

  it("adds the chosen inner inset to the resolved physical column padding", () => {
    expect(resolveTemplateCvDesign("elegant").spacing.innerPaddingMm).toBe(0);
    for (const innerPaddingMm of [0, 2, 13, 16]) {
      const result = renderCv("elegant", maximalProfile(), withSpacing({ spacing: { innerPaddingMm } }));
      for (const [surface, list] of Object.entries(scopes(result)))
        for (const scope of list) {
          expect(styleValue(scope, "--elegant-main-left"), `${surface} ${innerPaddingMm}`).toBe(`${10 + innerPaddingMm}mm`);
          expect(styleValue(scope, "--elegant-sidebar-right"), `${surface} ${innerPaddingMm}`).toBe(`${10 + innerPaddingMm}mm`);
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
      expect(styleValue(list[0], "--elegant-sidebar-right")).toBe("6mm");
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

  it("changes only horizontal edges when Seitenränder changes", () => {
    const variants = [6, 10, 16].map((pageMarginMm) => renderCv("elegant", maximalProfile(), withSpacing({ spacing: { pageMarginMm } })));
    for (const surface of ["preview", "pdf"] as const) {
      const styles = variants.map((result) => {
        const first = scopes(result)[surface][0];
        return Object.fromEntries((first.getAttribute("style") ?? "").split(";").map((part) => part.split(":"))) as Record<string, string>;
      });
      expect(styles.map((style) => style["--elegant-main-left"])).toEqual(["6mm", "10mm", "16mm"]);
      expect(styles.map((style) => style["--elegant-sidebar-right"])).toEqual(["6mm", "10mm", "16mm"]);
      for (const edge of ["--elegant-main-top", "--elegant-main-bottom", "--elegant-sidebar-top", "--elegant-sidebar-bottom"])
        expect(new Set(styles.map((style) => style[edge])).size, `${surface} ${edge}`).toBe(1);
    }
  });

  it("keeps saved main/sidebar section order in both renderers", () => {
    const profile = maximalProfile({ resumeManagerLayouts: { elegant: [
      { id: "experience", zone: "main" }, { id: "summary", zone: "main" },
      { id: "education", zone: "main" }, { id: "languages", zone: "sidebar" },
      { id: "strengths", zone: "sidebar" }, { id: "knowledge", zone: "sidebar" },
    ] } });
    const result = renderCv("elegant", profile);
    for (const pages of Object.values(scopes(result))) {
      const first = pages[0];
      expect(Array.from(first.querySelectorAll("main > [data-managed-section]")).map((node) => node.getAttribute("data-managed-section")))
        .toEqual(["experience", "summary", "education"]);
      expect(Array.from(first.querySelectorAll("aside > [data-managed-section]")).map((node) => node.getAttribute("data-managed-section")))
        .toEqual(["languages", "strengths", "knowledge", "certifications"]);
    }
  });

  it("continues a long experience at its next bullet without loss", () => {
    const base = minimalProfile();
    const bullets = Array.from({ length: 28 }, (_, index) => `Fiktive Prozessanalyse ${index} mit dokumentierter Abstimmung und technischer Auswertung.`);
    const profile = { ...base, experiences: [{ ...base.experiences[0], tasks: bullets }] };
    const result = renderCv("elegant", profile);
    const ranges = result.resolved.pagePlan.flatMap((page) => page.items.filter((item) => item.kind === "experience")
      .map((item) => item.bullets));
    expect(ranges.length).toBeGreaterThan(1);
    expect(ranges[0]).toMatchObject({ from: 0, total: bullets.length });
    expect(ranges[0]!.to).toBeGreaterThan(0);
    expect(ranges[0]!.to).toBeLessThan(bullets.length);
    expect(ranges[1]!.from).toBe(ranges[0]!.to);
    expect(ranges.at(-1)!.to).toBe(bullets.length);
    expect(result.previewPages.length).toBe(result.pdfPages.length);
  });
});
