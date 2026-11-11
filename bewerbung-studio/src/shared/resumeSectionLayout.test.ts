import { describe, expect, it } from "vitest";
import { defaultDocumentDesign } from "./documentDesign";
import { documentDesignSchema } from "./schema";
import { resolveLanguageColumns, resolveSectionColumns } from "./resumeSectionLayout";
import { getTechnologyBrandIconMarkup, getThemedTechnologyIconMarkup } from "./technologyBrand";

const items = Array.from({ length: 12 }, () => ({ title: "Analytisch" }));
describe("CV section columns and icons", () => {
  it("defaults old design records to auto", () => {
    const { strengthsColumns, knowledgeColumns, languagesColumns, ...legacy } = defaultDocumentDesign;
    expect(documentDesignSchema.parse(legacy)).toMatchObject({ strengthsColumns: "auto", knowledgeColumns: "auto", languagesColumns: "auto" });
    expect(strengthsColumns).toBe("auto");
    expect(knowledgeColumns).toBe("auto");
    expect(languagesColumns).toBe("auto");
  });
  it.each([1, 2, 3, 4] as const)("honors manual %s columns even in a sidebar", (columns) => {
    expect(resolveSectionColumns(columns, "zweispaltig", "sidebar", items)).toBe(columns);
  });
  it("uses a wide grid in a single column and a stack in a narrow sidebar", () => {
    expect(resolveSectionColumns("auto", "klassisch", "main", items, defaultDocumentDesign, false)).toBe(3);
    expect(resolveSectionColumns("auto", "zweispaltig", "sidebar", items, defaultDocumentDesign, true)).toBe(1);
    expect(resolveSectionColumns("auto", "zweispaltig", "main", items, defaultDocumentDesign, true)).toBe(2);
  });
  it("sizes automatic item grids from the selected resume columns", () => {
    const single = { ...defaultDocumentDesign, resumePresentation: { layoutMode: "single" as const } };
    const narrow = { ...defaultDocumentDesign, resumePresentation: { layoutMode: "two-column" as const, sidebarWidthPercent: 40 as const } };
    const wide = { ...defaultDocumentDesign, resumePresentation: { layoutMode: "two-column" as const, sidebarWidthPercent: 20 as const } };
    expect(resolveSectionColumns("auto", "klassisch", "main", items, single, false)).toBe(3);
    expect(resolveSectionColumns("auto", "klassisch", "sidebar", items, narrow, false)).toBe(1);
    expect(resolveSectionColumns("auto", "klassisch", "main", items, narrow, false)).toBe(2);
    const mediumTitles = items.map(() => ({title: "Strukturierte Zusammenarbeit im Team"}));
    expect(resolveSectionColumns("auto", "klassisch", "main", mediumTitles, narrow, false)).toBe(1);
    expect(resolveSectionColumns("auto", "klassisch", "main", mediumTitles, wide, false)).toBe(2);
  });
  it("reduces columns for long text and large fonts, without creating empty columns", () => {
    expect(resolveSectionColumns("auto", "klassisch", "main", [{title: "Kurz"}], defaultDocumentDesign, false)).toBe(1);
    expect(resolveSectionColumns("auto", "klassisch", "main", items.map(() => ({title: "Strukturierte Problemlösungsfähigkeit im Entwicklungsteam", description: "Text ".repeat(30)})), { ...defaultDocumentDesign, fontSize: "large" }, false)).toBe(1);
  });
  it("uses the native sidebar ratio and semantic page margin for automatic strengths", () => {
    const mediumTitles = items.map(() => ({ title: "Strukturierte Zusammenarbeit im Team" }));
    const narrowMargin = { ...defaultDocumentDesign, marginLevel: 1 as const };
    expect(resolveSectionColumns("auto", "pehlione_white", "main", mediumTitles, narrowMargin, true)).toBe(2);
    const wideMargin = { ...narrowMargin, cvOverrides: { spacing: { pageMarginMm: 30 } } };
    expect(resolveSectionColumns("auto", "pehlione_white", "main", mediumTitles, wideMargin, true)).toBe(1);
  });
  it("gives automatic Sprachen three columns in the Hauptbereich and one in the Seitenspalte", () => {
    expect(resolveLanguageColumns("auto", "main")).toBe(3);
    expect(resolveLanguageColumns("auto", "sidebar")).toBe(1);
    // an application saved before the setting existed
    expect(resolveLanguageColumns(undefined, "main")).toBe(3);
    expect(resolveLanguageColumns(undefined, "sidebar")).toBe(1);
  });
  it.each([1, 2, 3, 4] as const)("keeps the %s Sprachen columns the user picked in either column", (columns) => {
    expect(resolveLanguageColumns(columns, "main")).toBe(columns);
    expect(resolveLanguageColumns(columns, "sidebar")).toBe(columns);
  });
  it("sets Sprachen as one text column in the ATS layout, whatever is chosen", () => {
    for (const mode of ["auto", 1, 2, 3, 4, undefined] as const)
      for (const zone of ["main", "sidebar"] as const) expect(resolveLanguageColumns(mode, zone, true)).toBe(1);
  });
  it("leaves the automatic Stärken and Kenntnisse grid on its width rule", () => {
    // two short items in a wide column stay two columns there; Sprachen alone is three
    const two = [{ title: "Analytisch" }, { title: "Teamfähig" }];
    expect(resolveSectionColumns("auto", "klassisch", "main", two, defaultDocumentDesign, false)).toBe(2);
    expect(resolveSectionColumns("auto", "zweispaltig", "main", items, defaultDocumentDesign, true)).toBe(2);
    expect(resolveLanguageColumns("auto", "main")).toBe(3);
  });
  it.each([["GoLang", "Go"], ["JS", "JavaScript"], ["ts", "TypeScript"], ["Spring Boot", "Spring"], ["GITHUB", "GitHub"]])("resolves %s aliases", (alias, canonical) => {
    expect(getTechnologyBrandIconMarkup(alias)).toBe(getTechnologyBrandIconMarkup(canonical));
  });
  it("keeps manual icons above automatic matching and renders a safe fallback", () => {
    expect(getThemedTechnologyIconMarkup("Java", "symbol:check")).toContain('data-strength-symbol="symbol:check"');
    expect(getThemedTechnologyIconMarkup("Unknown technology")).toContain("<svg");
    expect(getThemedTechnologyIconMarkup('<script>')).not.toContain("<script>");
    expect(getThemedTechnologyIconMarkup("Go")).not.toContain("#00add8");
    expect(getThemedTechnologyIconMarkup("Go")).toContain("currentColor");
  });
});
