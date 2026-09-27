import { describe, expect, it } from "vitest";
import { defaultDocumentDesign } from "./documentDesign";
import { documentDesignSchema } from "./schema";
import { resolveSectionColumns } from "./resumeSectionLayout";
import { getTechnologyBrandIconMarkup, getThemedTechnologyIconMarkup } from "./technologyBrand";

const items = Array.from({ length: 12 }, () => ({ title: "Analytisch" }));
describe("CV section columns and icons", () => {
  it("defaults old design records to auto", () => {
    const { strengthsColumns, knowledgeColumns, ...legacy } = defaultDocumentDesign;
    expect(documentDesignSchema.parse(legacy)).toMatchObject({ strengthsColumns: "auto", knowledgeColumns: "auto" });
    expect(strengthsColumns).toBe("auto");
    expect(knowledgeColumns).toBe("auto");
  });
  it.each([1, 2, 3, 4] as const)("honors manual %s columns even in a sidebar", (columns) => {
    expect(resolveSectionColumns(columns, "zweispaltig", "sidebar", items)).toBe(columns);
  });
  it("uses a wide grid in a single column and a stack in a narrow sidebar", () => {
    expect(resolveSectionColumns("auto", "klassisch", "main", items, defaultDocumentDesign, false)).toBe(3);
    expect(resolveSectionColumns("auto", "zweispaltig", "sidebar", items, defaultDocumentDesign, true)).toBe(1);
    expect(resolveSectionColumns("auto", "zweispaltig", "main", items, defaultDocumentDesign, true)).toBe(2);
  });
  it("reduces columns for long text and large fonts, without creating empty columns", () => {
    expect(resolveSectionColumns("auto", "klassisch", "main", [{title: "Kurz"}], defaultDocumentDesign, false)).toBe(1);
    expect(resolveSectionColumns("auto", "klassisch", "main", items.map(() => ({title: "Strukturierte Problemlösungsfähigkeit im Entwicklungsteam", description: "Text ".repeat(30)})), { ...defaultDocumentDesign, fontSize: "large" }, false)).toBe(1);
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
