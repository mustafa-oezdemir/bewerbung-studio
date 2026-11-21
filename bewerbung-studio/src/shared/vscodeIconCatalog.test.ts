import { describe, expect, it } from "vitest";
import { getDeckblattTechnologyIconMarkup, getStrengthIconMarkup, getThemedTechnologyIconMarkup, resolveTechnologyIcon } from "./technologyBrand";
import { availableVscodeIcons, getVscodeIconEntry, getVscodeIconMarkup, vscodeIcons } from "./vscodeIconCatalog";

describe("vscode-icons catalog", () => {
  it("retains every wiki name and separates file and folder identities", () => {
    expect(vscodeIcons.filter((entry) => entry.kind === "file" && !entry.retired)).toHaveLength(1095);
    expect(vscodeIcons.filter((entry) => entry.kind === "folder" && !entry.retired)).toHaveLength(211);
    expect(new Set(vscodeIcons.map((entry) => entry.id)).size).toBe(vscodeIcons.length);
    expect(getVscodeIconEntry("vscode:file:config")?.name).toBe("config");
    expect(getVscodeIconEntry("vscode:folder:config")?.name).toBe("config");
    expect(availableVscodeIcons).toHaveLength(133);
    for (const id of ["vscode:file:apib2", "vscode:file:scss2", "vscode:folder:nyc"])
      expect(getVscodeIconEntry(id)).toMatchObject({ id, available: false });
  });

  it("retains a retired ID and keeps the previous fallback for its unbundled artwork", () => {
    const id = "vscode:file:svglint";
    expect(getVscodeIconEntry(id)).toMatchObject({ id, retired: true, available: false });
    expect(getVscodeIconEntry("vscode:file:simple_icons")?.retired).toBeFalsy();
    expect(getVscodeIconMarkup(id)).toBeUndefined();
    expect(resolveTechnologyIcon("JSON", id)).toEqual(resolveTechnologyIcon("JSON"));
  });

  it("uses exact file theme variants and updated folder variants with local reusable geometry", () => {
    expect(getVscodeIconMarkup("vscode:file:json", "dark")).toContain('fill="#f5de19"');
    expect(getVscodeIconMarkup("vscode:file:json", "light")).toContain('fill="#fbc02d"');
    expect(getVscodeIconEntry("vscode:file:js")?.assets.light).toBe("file_type_light_js.svg");
    const id = "vscode:folder:component";
    for (const [opened, file] of [[false, "folder_type_component"], [true, "folder_type_component_opened"]] as const) {
      const svg = getVscodeIconMarkup(id, "light", opened);
      expect(svg).toContain('viewBox="0 0 32 32"');
      expect(svg).toContain("<use ");
      expect(svg).toContain(`href="#vscode-folder-component-${file}-svg-original-a"`);
      expect(svg).toContain(`id="vscode-folder-component-${file}-svg-original-a"`);
    }
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
