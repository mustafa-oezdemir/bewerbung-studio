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

const stilvoll = "stilvoll";

const page = (surface: "preview" | "pdf") => {
  const tag = surface === "pdf" ? "h3" : "h2";
  const { document } = parseHTML(`<html><body>
    <section class="cv-sheet" data-template="${stilvoll}"><div class="page-content">
      <aside><section data-managed-section="certifications"><${tag}>Zertifikate</${tag}><ul><li>IBM</li></ul></section></aside>
      <main><section data-managed-section="languages"><${tag}>Sprachen</${tag}><div>Deutsch</div></section></main>
    </div></section></body></html>`);
  const root = document.querySelector(".cv-sheet")!;
  const node = (id: string) => root.querySelector(`[data-managed-section="${id}"]`)!;
  return { root, node, main: root.querySelector("main")!, sidebar: root.querySelector("aside")! };
};

describe("section presentation of Stilvoll", () => {
  it("follows its column and prints the date of the application", () => {
    expect(isZoneFlowTemplate(stilvoll)).toBe(true);
    expect(usesApplicationClosingDate(stilvoll)).toBe(true);
  });

  it("draws no icon and one light heading, in the muted grey of the template, for both columns", () => {
    for (const id of ["summary", "strengths", "experience", "education", "knowledge", "certifications", "languages", "special:abc"]) {
      const main = resolveSectionPresentation(stilvoll, id, "main")!;
      const sidebar = resolveSectionPresentation(stilvoll, id, "sidebar")!;
      expect(main.icon, id).toBeNull();
      expect(sidebar.icon, id).toBeNull();
      expect(sidebar.heading, id).toEqual(main.heading);
      // The preview names the colours `--stilvoll-muted` / `--stilvoll-divider`, the PDF `--managed-muted` / `--managed-divider`.
      expect(main.heading.color).toBe("var(--stilvoll-muted,var(--managed-muted))");
      expect(main.heading.fontWeight).toBe(400);
    }
  });

  it("rebuilds a heading without an icon, on both surfaces", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const { root, node, main, sidebar } = page(surface);
      const sections = ["languages", "certifications"].map((id) => ({ id, nodes: [node(id)] }));
      applyResumeSectionPresentation(root, stilvoll, { main, sidebar, sections });
      expect(node("certifications").getAttribute("data-cv-zone")).toBe("sidebar");
      expect(node("languages").getAttribute("data-cv-zone")).toBe("main");
      for (const id of ["languages", "certifications"]) {
        expect(node(id).querySelector(".cv-heading__icon"), `${surface} ${id}`).toBeNull();
        expect(node(id).querySelector(".cv-heading > .cv-heading__label")?.textContent, `${surface} ${id}`).toBe(id === "languages" ? "Sprachen" : "Zertifikate");
      }
    }
  });

  it("keeps the spacing of the template: the gap of each surface, the thin rule and the body size of its lists", () => {
    const css = resumeSectionPresentationCss.split("\n").filter((line) => line.includes(".stilvoll-template")).join("\n");
    expect(css).toContain('[data-cv-zone="main"]{margin:0 0 var(--managed-section-gap,var(--stilvoll-section-gap))}');
    expect(css).toContain("border-bottom:.3mm solid");
    expect(css).toContain("font-size:inherit;line-height:inherit;list-style:disc");
    // Its language names and strength titles keep the colours of the template.
    expect(css).not.toContain('[data-cv-zone="sidebar"] :is(h4,h5,strong,p,li,small){color:inherit}');
  });

  it("rebuilds only the certificates as one list and starts the sidebar at the header", () => {
    expect(isPlainListSection(stilvoll, "certifications")).toBe(true);
    expect(isPlainListSection(stilvoll, "languages")).toBe(false);
    expect(hasSidebarHero(stilvoll)).toBe(false);
    const metrics = sectionListMetrics(stilvoll, "sidebar")!;
    expect(metrics.headingMm).toBeCloseTo(9.2, 2);
    expect(metrics.inheritBody).toBe(true);
  });

  it("lists the sidebar sections of its left column where the output draws them", () => {
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", languages: ["Deutsch"], certifications: ["IBM"], updatedAt: new Date().toISOString() });
    const zoneOf = (id: string) => getManagerSections(profile, stilvoll).find((entry) => entry.id === id)?.zone;
    for (const id of ["summary", "strengths", "languages", "knowledge", "certifications"]) expect(zoneOf(id), id).toBe("sidebar");
    for (const id of ["experience", "education"]) expect(zoneOf(id), id).toBe("main");
    expect(getTemplateSectionCapabilities(stilvoll).allowedZonesBySection.certifications).toEqual(["main", "sidebar"]);
  });
});
