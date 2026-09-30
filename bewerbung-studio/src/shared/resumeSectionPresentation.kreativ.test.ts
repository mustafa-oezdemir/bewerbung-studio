import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import {
  applyResumeSectionPresentation,
  hasSidebarHero,
  isPlainListSection,
  isZoneFlowTemplate,
  resolveSectionPresentation,
  resumeSectionPresentationCss,
  sectionListMetrics,
  usesApplicationClosingDate,
} from "./resumeSectionPresentation";

const kreativ = "kreativ";

const page = (surface: "preview" | "pdf") => {
  const tag = surface === "pdf" ? "h3" : "h2";
  const { document } = parseHTML(`<html><body>
    <section class="cv-sheet" data-template="${kreativ}"><div class="page-content">
      <main><section data-managed-section="languages"><${tag}>Sprachen</${tag}><div>Deutsch</div></section></main>
      <aside><section data-managed-section="certifications"><${tag}>Zertifikate</${tag}><ul><li>IBM</li></ul></section></aside>
    </div></section></body></html>`);
  const root = document.querySelector(".cv-sheet")!;
  const node = (id: string) => root.querySelector(`[data-managed-section="${id}"]`)!;
  return { root, node, main: root.querySelector("main")!, sidebar: root.querySelector("aside")! };
};

describe("section presentation of Kreativ", () => {
  it("follows its column and prints the date of the application", () => {
    expect(isZoneFlowTemplate(kreativ)).toBe(true);
    expect(usesApplicationClosingDate(kreativ)).toBe(true);
  });

  it("draws no icon and one heading, in the dark green of the template, for both columns", () => {
    for (const id of ["summary", "strengths", "experience", "education", "knowledge", "certifications", "languages", "special:abc"]) {
      const main = resolveSectionPresentation(kreativ, id, "main")!;
      const sidebar = resolveSectionPresentation(kreativ, id, "sidebar")!;
      expect(main.icon, id).toBeNull();
      expect(sidebar.icon, id).toBeNull();
      expect(sidebar.heading, id).toEqual(main.heading);
      // The preview names the colour `--kreativ-heading`, the PDF `--kreativ-dark`: both reach the same value.
      expect(main.heading.color).toBe("var(--kreativ-heading,var(--kreativ-dark))");
    }
  });

  it("rebuilds a heading without an icon, on both surfaces", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const { root, node, main, sidebar } = page(surface);
      const sections = ["languages", "certifications"].map((id) => ({ id, nodes: [node(id)] }));
      applyResumeSectionPresentation(root, kreativ, { main, sidebar, sections });
      expect(node("languages").getAttribute("data-cv-zone")).toBe("main");
      expect(node("certifications").getAttribute("data-cv-zone")).toBe("sidebar");
      for (const id of ["languages", "certifications"]) {
        expect(node(id).querySelector(".cv-heading__icon"), `${surface} ${id}`).toBeNull();
        expect(node(id).querySelector(".cv-heading > .cv-heading__label")?.textContent, `${surface} ${id}`).toBe(id === "languages" ? "Sprachen" : "Zertifikate");
      }
    }
  });

  it("keeps the spacing of the template: its own bottom margin, the divider and the body size of its lists", () => {
    const css = resumeSectionPresentationCss.split("\n").filter((line) => line.includes(".kreativ-template")).join("\n");
    expect(css).toContain(':is(.kreativ-template,.cv-sheet[data-template="kreativ"]) [data-cv-zone="main"]{margin:0 0 var(--kreativ-section-gap)}');
    expect(css).toContain('[data-cv-zone="sidebar"]{margin:0 0 var(--kreativ-section-gap)}');
    expect(css).toContain("border-bottom:.65mm solid");
    expect(css).toContain("font-size:inherit;line-height:inherit;list-style:disc");
    expect(css).toContain("li::marker{color:var(--kreativ-primary,var(--accent))}");
  });

  it("rebuilds only the certificates as one list, keeps the language dots and starts the sidebar at the header", () => {
    expect(isPlainListSection(kreativ, "certifications")).toBe(true);
    expect(isPlainListSection(kreativ, "languages")).toBe(false);
    expect(hasSidebarHero(kreativ)).toBe(false);
    const metrics = sectionListMetrics(kreativ, "sidebar")!;
    expect(metrics.headingMm).toBeCloseTo(10.23, 2);
    expect(metrics.inheritBody).toBe(true);
  });
});
