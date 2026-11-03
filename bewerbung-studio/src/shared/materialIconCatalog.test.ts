import { describe, expect, it } from "vitest";
import comparison from "./iconComparison.generated.json";
import { getMaterialIconEntry, getMaterialIconMarkup, materialIcons } from "./materialIconCatalog";
import { renderLocalSvg } from "./localSvgRender";
import { getDeckblattTechnologyIconMarkup, getThemedTechnologyIconMarkup, resolveTechnologyIcon } from "./technologyBrand";

describe("Material Icon Theme catalog", () => {
  it("keeps every source name and resolves every selectable ID to a local SVG", () => {
    expect(materialIcons).toHaveLength(859);
    expect(new Set(materialIcons.map((entry) => entry.id)).size).toBe(materialIcons.length);
    for (const entry of materialIcons) {
      expect(getMaterialIconEntry(entry.id)).toBe(entry);
      expect(getMaterialIconMarkup(entry.id)).toContain("<svg");
      expect(getMaterialIconMarkup(entry.id)).toContain("viewBox=");
      expect(getMaterialIconMarkup(entry.id, "dark", "themed")).toContain("<svg");
    }
    expect(getMaterialIconMarkup("material:file:missing")).toBeUndefined();
  });

  it("selects Material for shared technology and keeps a saved alternative", () => {
    expect(resolveTechnologyIcon("Java").markup).toContain('data-brand="material:file:java"');
    expect(resolveTechnologyIcon("Docker").markup).toContain('data-brand="material:file:docker"');
    expect(resolveTechnologyIcon("API").markup).toContain('data-brand="material:folder:folder-api"');
    expect(resolveTechnologyIcon("Java", "vscode:file:config").markup).toContain('data-brand="vscode:file:config"');
    expect(resolveTechnologyIcon("Java", "symbol:check").markup).toContain('data-strength-symbol="symbol:check"');
    expect(resolveTechnologyIcon("Java", "material:file:python").markup).toContain('data-brand="material:file:python"');
  });

  it("keeps source paints in Deckblatt and uses CV paint without sharing gradient IDs", () => {
    const original = getDeckblattTechnologyIconMarkup("Kotlin");
    const themed = getThemedTechnologyIconMarkup("Kotlin");
    expect(original).toContain('data-brand="material:file:kotlin"');
    expect(original).toContain("#7c4dff");
    expect(themed).toContain("currentColor");
    expect(themed).not.toContain("#7c4dff");
    expect(original).toContain("-original-");
    expect(themed).toContain("-themed-");
    expect(original).not.toBe(themed);
  });

  it("rejects unsafe SVGs and preserves transparent geometry and internal references", () => {
    expect(() => renderLocalSvg('<svg><script>alert(1)</script></svg>', "material:file:x", "x.svg", "original")).toThrow();
    expect(() => renderLocalSvg('<svg><image href="https://example.com/a.svg"/></svg>', "material:file:x", "x.svg", "original")).toThrow();
    expect(() => renderLocalSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]><svg/>', "material:file:x", "x.svg", "original")).toThrow();
    expect(() => renderLocalSvg('<svg><path fill="url(../other.svg#g)"/></svg>', "material:file:x", "x.svg", "original")).toThrow();
    const source = '<svg viewBox="0 0 32 32"><defs><linearGradient id="g"><stop stop-color="#2288cc"/></linearGradient></defs><path fill="url(#g)" d="M0 0h32v32H0z"/><path fill="none" stroke="#2288cc" d="M2 2h2"/></svg>';
    const themed = renderLocalSvg(source, "material:file:x", "x.svg", "themed");
    expect(themed).toContain('fill="none"');
    expect(themed).toContain("currentColor");
    expect(themed).toContain('fill="url(#material-file-x-x-svg-themed-g)"');
  });

  it("records common, source-only, available alternative and unresolved counts", () => {
    expect(comparison.counts).toMatchObject({ material: 859, vscode: 1298, common: 423, materialOnly: 440, vscodeOnly: 875, selectableVscodeAlternatives: 42, unresolved: 1213 });
  });
});
