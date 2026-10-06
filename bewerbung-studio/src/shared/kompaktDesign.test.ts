import { describe, expect, it } from "vitest";
import { getKompaktDesignVariables, kompaktResolvedCss, resolveKompaktGeometry } from "./kompaktDesign";
import { resolveTemplateCvDesign } from "./cvDesign";

const design = (pageMarginMm?: number, columnGapMm?: number) => {
  const native = resolveTemplateCvDesign("kompakt");
  return { ...native, spacing: { ...native.spacing, ...(pageMarginMm !== undefined ? { pageMarginMm } : {}), ...(columnGapMm !== undefined ? { columnGapMm } : {}) } };
};

describe("Kompakt page geometry (Seitenränder is horizontal)", () => {
  it("keeps the native DIN geometry by default", () => {
    const geometry = resolveKompaktGeometry(25, 8);
    expect(geometry).toMatchObject({ left: 25, right: 20, top: 12, bottom: 15, columnGap: 8, contentWidth: 165 });
    expect(geometry.mainWidth / geometry.sideWidth).toBeCloseTo(97 / 60, 5);
    expect(geometry.mainWidth + geometry.columnGap + geometry.sideWidth).toBeCloseTo(geometry.contentWidth, 5);
  });

  it("moves only the left and right edges, never top, bottom or the column gap", () => {
    for (const margin of [10, 20, 30]) {
      const geometry = resolveKompaktGeometry(margin, 8);
      expect(geometry.left).toBe(margin);
      expect(geometry.right).toBe(margin - 5);
      expect(geometry.top).toBe(12);
      expect(geometry.bottom).toBe(15);
      expect(geometry.columnGap).toBe(8);
      expect(geometry.left + geometry.mainWidth + geometry.columnGap + geometry.sideWidth + geometry.right).toBeCloseTo(210, 5);
    }
    const wide = resolveKompaktGeometry(30, 8);
    const narrow = resolveKompaktGeometry(15, 8);
    expect(wide.mainWidth).toBeLessThan(narrow.mainWidth);
    expect(wide.sideWidth).toBeLessThan(narrow.sideWidth);
  });

  it("writes the same geometry into the variables both surfaces read", () => {
    const changed = getKompaktDesignVariables(design(20, 8), undefined);
    expect(changed).toMatchObject({
      "--kompakt-margin-left": "20mm", "--kompakt-margin-right": "15mm",
      "--kompakt-margin-top": "12mm", "--kompakt-margin-bottom": "15mm", "--kompakt-column-gap": "8mm",
    });
    const native = getKompaktDesignVariables(design(), undefined);
    expect(native["--kompakt-margin-top"]).toBe("12mm");
    expect(native["--kompakt-margin-bottom"]).toBe("15mm");
  });

  it("puts header, photo, columns and footer on the same horizontal bounds; the header top stays fixed", () => {
    expect(kompaktResolvedCss).toContain("padding:var(--kompakt-margin-top) var(--kompakt-margin-right) 0 var(--kompakt-margin-left)");
    expect(kompaktResolvedCss).toContain("top:calc(var(--kompakt-margin-top) - 3mm);right:var(--kompakt-margin-right)");
    expect(kompaktResolvedCss).toMatch(/grid-template-columns:minmax\(0,97fr\) minmax\(0,60fr\);column-gap:var\(--kompakt-column-gap\);padding-left:var\(--kompakt-margin-left\);padding-right:var\(--kompakt-margin-right\)/);
    expect(kompaktResolvedCss).toMatch(/managed-pdf-footer\{left:var\(--kompakt-margin-left\);right:var\(--kompakt-margin-right\)/);
  });
});
