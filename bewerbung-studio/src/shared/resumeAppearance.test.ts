import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { defaultDocumentDesign } from "./documentDesign";
import { applyGeneralResumeAppearance } from "./resumeAppearance";

const fixture = () => {
  const { document } = parseHTML('<div class="cv-sheet"><main><section data-managed-section="experience"><h2><span>Berufserfahrung</span></h2><p>Inhalt</p></section><img class="zweispaltig-pdf-photo"></main><aside><section data-managed-section="certifications"><h3>Zertifikate</h3><ul><li>Eintrag</li></ul></section></aside></div>');
  return { page: document.querySelector(".cv-sheet")!, main: document.querySelector("main")!, sidebar: document.querySelector("aside")! };
};

describe("shared resume appearance", () => {
  it("preserves native Zweispaltig styling when no override exists", () => {
    const { page, main, sidebar } = fixture();
    applyGeneralResumeAppearance(page, "zweispaltig", defaultDocumentDesign, main, sidebar);
    expect(main.getAttribute("style")).toBeNull();
    expect(sidebar.getAttribute("style")).toBeNull();
    expect(page.querySelector("h2")?.getAttribute("style")).toBeNull();
  });

  it("projects saved column colors and decoration on the shared preview/PDF structure", () => {
    const { page, main, sidebar } = fixture();
    applyGeneralResumeAppearance(page, "zweispaltig", { ...defaultDocumentDesign, resumeAppearance: {
      mainBackgroundColor: "#fafafa", sidebarBackgroundColor: "#112233", sidebarTextColor: "#ffffff",
      sectionDividerVisible: false, photoDecorationColor: "#556677",
    } }, main, sidebar);
    expect((main as HTMLElement).style.background).toBe("#fafafa");
    expect((sidebar as HTMLElement).style.background).toBe("#112233");
    expect((sidebar as HTMLElement).style.color).toBe("#ffffff");
    expect((sidebar.querySelector("li") as HTMLElement).style.color).toBe("#ffffff");
    expect((page.querySelector("h2") as HTMLElement).style.borderBottomWidth).toBe("0");
    expect((page.querySelector("img") as HTMLElement).style.borderColor).toBe("#556677");
  });
  it("uses sidebar text for certificate entries in Pehlione without replacing its theme", () => {
    const { page, main, sidebar } = fixture();
    applyGeneralResumeAppearance(page, "pehlione_white_blue", { ...defaultDocumentDesign, resumeAppearance: {
      sidebarTextColor: "#ffffff", sidebarBackgroundColor: "#334455",
    } }, main, sidebar);
    expect((sidebar.querySelector("li") as HTMLElement).style.color).toBe("#ffffff");
    expect((sidebar as HTMLElement).style.background).toBe("");
  });
  it("applies section line position, alignment and safe spacing to every managed heading", () => {
    const { page, main, sidebar } = fixture();
    applyGeneralResumeAppearance(page, "zweispaltig", { ...defaultDocumentDesign, resumeAppearance: {
      sectionDividerPosition: "both", sectionDividerWidthMm: 0.6,
      sectionHeadingAlignment: "center", sectionHeadingMarginBeforeMm: 2,
      sectionHeadingMarginAfterMm: 3,
    } }, main, sidebar);
    const heading = page.querySelector("h2") as HTMLElement;
    expect(heading.style.borderTopWidth).toBe("0.6mm");
    expect(heading.style.borderBottomWidth).toBe("0.6mm");
    expect(heading.style.textAlign).toBe("center");
    expect(heading.style.marginTop).toBe("2mm");
    expect(heading.style.marginBottom).toBe("3mm");
  });
});
