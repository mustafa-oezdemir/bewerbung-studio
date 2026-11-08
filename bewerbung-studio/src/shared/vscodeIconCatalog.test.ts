import { describe, expect, it } from "vitest";
import { getDeckblattTechnologyIconMarkup, getStrengthIconMarkup, getThemedTechnologyIconMarkup, resolveTechnologyIcon } from "./technologyBrand";
import { availableVscodeIcons, getVscodeIconEntry, getVscodeIconMarkup, vscodeIcons } from "./vscodeIconCatalog";

describe("vscode-icons catalog", () => {
  it("retains every wiki name and separates file and folder identities", () => {
    expect(vscodeIcons.filter((entry) => entry.kind === "file")).toHaveLength(1088);
    expect(vscodeIcons.filter((entry) => entry.kind === "folder")).toHaveLength(210);
    expect(new Set(vscodeIcons.map((entry) => entry.id)).size).toBe(vscodeIcons.length);
    expect(getVscodeIconEntry("vscode:file:config")?.name).toBe("config");
    expect(getVscodeIconEntry("vscode:folder:config")?.name).toBe("config");
    expect(availableVscodeIcons).toHaveLength(85);
  });

  it("has a local, safe original SVG for every approved entry and variant", () => {
    for (const entry of availableVscodeIcons) {
      for (const background of ["light", "dark"] as const) {
        const markup = getVscodeIconMarkup(entry.id, background);
        expect(markup, entry.id).toContain("<svg");
        expect(markup, entry.id).toContain("viewBox=");
        expect(markup, entry.id).not.toMatch(/<script|<foreignObject|\bon[a-z]+=|(?:href|src)="(?:https?:|javascript:)/i);
        if (entry.kind === "folder") expect(getVscodeIconMarkup(entry.id, background, true), entry.id).toContain("<svg");
      }
    }
    expect(getVscodeIconMarkup("vscode:file:nonexistent")).toBeUndefined();
    expect(getVscodeIconMarkup("vscode:file:java")).toBeUndefined();
  });

  it("uses original artwork on the Deckblatt and CV paint on the Lebenslauf", () => {
    const id = "vscode:folder:api";
    const original = getDeckblattTechnologyIconMarkup("API", id);
    const themed = getThemedTechnologyIconMarkup("API", id);
    expect(original).toBe(getVscodeIconMarkup(id));
    expect(original).toContain('fill="#a0bf55"');
    expect(original).toContain('fill="#fff"');
    expect(themed).toContain("currentColor");
    expect(themed).toContain("color-mix(");
    expect(themed).toContain('fill="#fff"');
    expect(themed).not.toContain("#a0bf55");
    expect(getVscodeIconMarkup("vscode:folder:api", "dark", true)).not.toBe(original);
    expect(resolveTechnologyIcon("Anything", id).source).toBe("manual");
  });
});

describe("vscode-icons in Stärken", () => {
  it("keeps source paints by default and takes the theme with a chosen colour", () => {
    const id = "vscode:folder:api";
    expect(getStrengthIconMarkup("API", id, "original")).toContain('fill="#a0bf55"');
    expect(getStrengthIconMarkup("API", id, "themed")).toBe(getThemedTechnologyIconMarkup("API", id));
  });
});
