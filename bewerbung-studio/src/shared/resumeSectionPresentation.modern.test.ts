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
import { getTemplateSectionCapabilities } from "../features/resume-sections/resume-sections";
import { getManagerSections } from "../features/resume-sections/resume-manager";
import { profileSchema } from "./schema";

const modern = "modern";

const page = (surface: "preview" | "pdf") => {
  const tag = surface === "pdf" ? "h3" : "h2";
  const { document } = parseHTML(`<html><body>
    <section class="cv-sheet" data-template="${modern}"><div class="page-content">
      <aside><section data-managed-section="certifications"><${tag}>Zertifikate</${tag}><ul><li>IBM</li></ul></section></aside>
      <main><section data-managed-section="languages"><${tag}>Sprachen</${tag}><div>Deutsch</div></section></main>
    </div></section></body></html>`);
  const root = document.querySelector(".cv-sheet")!;
  const node = (id: string) => root.querySelector(`[data-managed-section="${id}"]`)!;
  return { root, node, main: root.querySelector("main")!, sidebar: root.querySelector("aside")! };
};

describe("section presentation of Modern", () => {
  it("follows its column and prints the date of the application", () => {
    expect(isZoneFlowTemplate(modern)).toBe(true);
    expect(usesApplicationClosingDate(modern)).toBe(true);
  });

  it("draws no icon and one heading, in the muted grey of the template, for both columns", () => {
    for (const id of ["summary", "strengths", "experience", "education", "knowledge", "certifications", "languages", "special:abc"]) {
      const main = resolveSectionPresentation(modern, id, "main")!;
      const sidebar = resolveSectionPresentation(modern, id, "sidebar")!;
      expect(main.icon, id).toBeNull();
      expect(sidebar.icon, id).toBeNull();
      expect(sidebar.heading, id).toEqual(main.heading);
      expect(main.heading.color).toBe("var(--modern-muted)");
      expect(main.heading.textTransform).toBe("uppercase");
    }
  });

  it("rebuilds a heading without an icon, on both surfaces", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const { root, node, main, sidebar } = page(surface);
      const sections = ["languages", "certifications"].map((id) => ({ id, nodes: [node(id)] }));
      applyResumeSectionPresentation(root, modern, { main, sidebar, sections });
      expect(node("certifications").getAttribute("data-cv-zone")).toBe("sidebar");
      expect(node("languages").getAttribute("data-cv-zone")).toBe("main");
      for (const id of ["languages", "certifications"]) {
        expect(node(id).querySelector(".cv-heading__icon"), `${surface} ${id}`).toBeNull();
        expect(node(id).querySelector(".cv-heading > .cv-heading__label")?.textContent, `${surface} ${id}`).toBe(id === "languages" ? "Sprachen" : "Zertifikate");
      }
    }
  });

  it("keeps the spacing of the template: a block section without gap of its own, the rule of the heading and list type of its lists", () => {
    const css = resumeSectionPresentationCss.split("\n").filter((line) => line.includes(".modern-resume-page")).join("\n");
    // The preview section is a flex column (gap 4mm); the PDF one is a block, so margins collapse there.
    expect(css).toContain('[data-cv-zone]{display:block;gap:0}');
    expect(css).toContain("border-bottom:.35mm solid");
    expect(css).toContain("list-style:none");
  });

  it("rebuilds only the certificates as one list and starts the sidebar at the header", () => {
    expect(isPlainListSection(modern, "certifications")).toBe(true);
    expect(isPlainListSection(modern, "languages")).toBe(false);
    expect(hasSidebarHero(modern)).toBe(false);
    const metrics = sectionListMetrics(modern, "sidebar")!;
    expect(metrics.headingMm).toBeCloseTo(7.64, 2);
    expect(metrics.inheritBody).toBe(true);
  });

  it("lists the sidebar sections of its right column where the output draws them", () => {
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", languages: ["Deutsch"], certifications: ["IBM"], updatedAt: new Date().toISOString() });
    const zoneOf = (id: string) => getManagerSections(profile, modern).find((entry) => entry.id === id)?.zone;
    for (const id of ["strengths", "languages", "knowledge", "certifications"]) expect(zoneOf(id), id).toBe("sidebar");
    for (const id of ["summary", "experience", "education"]) expect(zoneOf(id), id).toBe("main");
    expect(getTemplateSectionCapabilities(modern).allowedZonesBySection.certifications).toEqual(["main", "sidebar"]);
  });
});
