import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import {
  applyResumeSectionPresentation,
  hasSidebarHero,
  isPlainListSection,
  isZoneFlowTemplate,
  resolveSectionPresentation,
  resumeSectionPresentationCss,
  sectionIconSvg,
  sectionIcons,
  sectionListMetrics,
  sectionSemanticType,
  usesApplicationClosingDate,
  zoneFlowTemplates,
  type SectionIconKey,
} from "./resumeSectionPresentation";

const templateId = "pehlione_white_blue";

const page = (surface: "preview" | "pdf") => {
  const tag = surface === "pdf" ? "h3" : "h2";
  const { document } = parseHTML(`<html><body>
    <section class="cv-sheet" data-template="${templateId}"><div class="page-content">
      <aside><section data-managed-section="languages"><${tag}>Sprachen</${tag}><ul><li>Deutsch</li></ul></section></aside>
      <main>
        <section data-managed-section="certifications"><${tag}>Zertifikate</${tag}><ul><li>IBM</li></ul></section>
        <section data-managed-section="special:abc"><${tag}>Hobbys</${tag}><p>Lesen</p></section>
      </main>
    </div></section></body></html>`);
  const root = document.querySelector(".cv-sheet")!;
  const node = (id: string) => root.querySelector(`[data-managed-section="${id}"]`)!;
  return { root, node, main: root.querySelector("main")!, sidebar: root.querySelector("aside")! };
};

describe("section presentation", () => {
  it("names the templates whose sections follow their column", () => {
    expect(zoneFlowTemplates).toEqual([templateId, "pehlione_white", "zweispaltig", "zeitgenoessisch", "kreativ", "ivy-league", "stilvoll", "kompakt"]);
    for (const joined of zoneFlowTemplates) {
      expect(isZoneFlowTemplate(joined)).toBe(true);
      expect(usesApplicationClosingDate(joined)).toBe(true);
    }
    for (const other of ["modern", "elegant", "klassisch", undefined]) {
      expect(isZoneFlowTemplate(other)).toBe(false);
      expect(usesApplicationClosingDate(other)).toBe(false);
      expect(resolveSectionPresentation(other ?? "", "languages", "sidebar")).toBeUndefined();
    }
  });

  it("gives every semantic section type one icon, whatever the surface", () => {
    const expected: Array<[string, string | undefined, SectionIconKey]> = [
      ["summary", undefined, "profile"],
      ["strengths", undefined, "competencies"],
      ["experience", undefined, "experience"],
      ["education", undefined, "education"],
      ["knowledge", undefined, "technical"],
      ["certifications", undefined, "certificates"],
      ["languages", undefined, "languages"],
      ["projects", undefined, "project"],
      ["special:63cea8a5", undefined, "generic"],
      ["group:41bd", "free-list", "generic"],
      ["group:41bd", "core-competencies", "competencies"],
      ["group:41bd", "technical-focus", "technical"],
      ["group:41bd", "training", "certificates"],
      ["group:41bd", "project-highlight", "project"],
    ];
    for (const [id, group, icon] of expected) {
      for (const zone of ["main", "sidebar"] as const) {
        const presentation = resolveSectionPresentation(templateId, id, zone, group)!;
        expect(presentation.icon, `${id}/${group} in ${zone}`).toBe(icon);
        expect(sectionSemanticType(id, group)).toBe(presentation.sectionType);
      }
    }
    for (const key of Object.keys(sectionIcons) as SectionIconKey[]) {
      expect(sectionIcons[key]).toMatch(/^<(path|circle|rect)/);
      expect(sectionIconSvg(key)).toContain(sectionIcons[key]);
    }
  });

  it("resolves the heading of a column from its own tokens", () => {
    const main = resolveSectionPresentation(templateId, "certifications", "main")!;
    const sidebar = resolveSectionPresentation(templateId, "certifications", "sidebar")!;
    expect(main.heading.fontSizePt.standard).toBe(13);
    expect(sidebar.heading.fontSizePt.standard).toBe(9.7);
    expect(main.heading.color).toContain("--pehlione-section-color");
    expect(sidebar.heading.color).toContain("--pehlione-sidebar-text");
    expect(main.heading.dividerColor).toContain("--pehlione-primary");
    expect(sidebar.heading.dividerColor).toContain("#b8d2f4");
    // The icon box keeps its own contrast in both columns.
    expect(main.heading.iconColor).toBe("#fff");
    expect(sidebar.heading.iconColor).toBe("#fff");
    expect(sidebar.list.fontSizePt.standard).toBeLessThan(main.list.fontSizePt.standard);
    expect(sectionListMetrics(templateId, "sidebar")!.headingMm).toBe(11);
    expect(sectionListMetrics(templateId, "main")!.headingMm).toBe(12);
  });

  it("draws the heading of the column the section stands in, on both surfaces", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const { root, node, main, sidebar } = page(surface);
      const sections = () => ["languages", "certifications", "special:abc"].map((id) => ({ id, nodes: [node(id)] }));
      applyResumeSectionPresentation(root, templateId, { main, sidebar, sections: sections() });
      const tag = surface === "pdf" ? "h3" : "h2";

      const languages = node("languages");
      expect(languages.getAttribute("data-cv-zone")).toBe("sidebar");
      expect(languages.querySelector(`${tag}.cv-heading > i.cv-heading__icon svg`)).not.toBeNull();
      expect(languages.querySelector(`${tag}.cv-heading > b.cv-heading__label`)?.textContent).toBe("Sprachen");
      expect(languages.querySelector("[data-cv-icon]")?.getAttribute("data-cv-icon")).toBe("languages");
      expect(node("certifications").getAttribute("data-cv-zone")).toBe("main");
      expect(node("special:abc").querySelector("[data-cv-icon]")?.getAttribute("data-cv-icon")).toBe("generic");

      // The same certificates section moves into the sidebar: it is drawn again as a sidebar section.
      sidebar.appendChild(node("certifications"));
      applyResumeSectionPresentation(root, templateId, { main, sidebar, sections: sections() });
      const moved = node("certifications");
      expect(moved.getAttribute("data-cv-zone")).toBe("sidebar");
      expect(moved.querySelectorAll(`${tag}.cv-heading`)).toHaveLength(1);
      expect(moved.querySelector("[data-cv-icon]")?.getAttribute("data-cv-icon")).toBe("certificates");
      expect(moved.querySelector("ul li")?.textContent).toBe("IBM");
    }
  });

  it("uses the very same icon markup in the preview and in the PDF", () => {
    const markup = (surface: "preview" | "pdf") => {
      const { root, node, main, sidebar } = page(surface);
      applyResumeSectionPresentation(root, templateId, { main, sidebar, sections: [{ id: "languages", nodes: [node("languages")] }] });
      // linkedom writes an empty element as `<path ... />`.
      return node("languages").querySelector(".cv-heading__icon")!.innerHTML.replaceAll(" />", "/>");
    };
    expect(markup("preview")).toBe(markup("pdf"));
    expect(markup("pdf")).toBe(sectionIconSvg("languages"));
  });

  it("leaves the headings of other templates untouched", () => {
    const { root, node, main, sidebar } = page("pdf");
    const before = root.innerHTML;
    applyResumeSectionPresentation(root, "modern", { main, sidebar, sections: [{ id: "languages", nodes: [node("languages")] }] });
    expect(root.innerHTML).toBe(before);
  });

  it("generates one stylesheet for both surfaces and both columns", () => {
    const css = resumeSectionPresentationCss;
    expect(css).toContain(`:is(.pehlione-resume,.cv-sheet)[data-template="${templateId}"] .cv-heading{`);
    expect(css).toContain('[data-cv-zone="main"]>.cv-heading{');
    expect(css).toContain('[data-cv-zone="sidebar"]>.cv-heading{');
    expect(css).toContain("font-size:13pt");
    expect(css).toContain("font-size:9.7pt");
    // Compact density and hidden dividers reach both hosts.
    expect(css).toContain(`.pehlione-resume[data-template="${templateId}"][data-density="compact"]`);
    expect(css).toContain(`.cv-sheet[data-template="${templateId}"] .pehlione-pdf[data-density="compact"]`);
    expect(css).toContain('[data-section-divider="hidden"] .cv-heading__label{border-bottom:0}');
    // The last section keeps the closing at its own distance.
    expect(css).toContain(":has(+ :is(.pehlione-closing,.pehlione-pdf-closing,[data-resume-closing])){margin-bottom:0}");
  });
});

describe("section presentation of Pehlione White", () => {
  const white = "pehlione_white";

  it("draws a bare accent icon in the sidebar and a boxed icon in the main column, from the same registry", () => {
    for (const id of ["certifications", "languages", "strengths", "knowledge", "summary", "special:abc"]) {
      const main = resolveSectionPresentation(white, id, "main")!;
      const sidebar = resolveSectionPresentation(white, id, "sidebar")!;
      expect(sidebar.icon, id).toBe(main.icon);
      expect(sidebar.icon, id).not.toBeNull();
      expect(main.heading.iconBackground).toContain("--pehlione-primary");
      expect(sidebar.heading.iconBackground).toBe("transparent");
      expect(main.heading.iconColor).toBe("#fff");
      expect(sidebar.heading.iconColor).toContain("--pehlione-primary");
      // The sidebar of the white template writes its titles in the accent colour, not in the sidebar text colour.
      expect(sidebar.heading.color).toContain("--pehlione-primary");
      expect(main.heading.color).toContain("--pehlione-section-color");
    }
  });

  it("gives the sidebar icon its own geometry without touching White Blue", () => {
    const css = resumeSectionPresentationCss;
    const scoped = (template: string) => css.split("\n").filter((line) => line.includes(`[data-template="${template}"] [data-cv-zone="sidebar"]>.cv-heading .cv-heading__icon`));
    expect(scoped(white).join("\n")).toContain("width:8mm;height:8mm;border-radius:0mm");
    expect(scoped(white).join("\n")).toContain("width:7mm;height:7mm");
    expect(scoped(templateId)).toHaveLength(0);
  });

  it("marks the sidebar icon as bare so it follows the title colour, and the main icon as boxed", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const { root, node, main, sidebar } = page(surface);
      const sections = ["languages", "certifications"].map((id) => ({ id, nodes: [node(id)] }));
      applyResumeSectionPresentation(root, white, { main, sidebar, sections });
      expect(node("languages").querySelector("[data-cv-icon]")?.getAttribute("data-cv-icon-style")).toBe("bare");
      expect(node("certifications").querySelector("[data-cv-icon]")?.getAttribute("data-cv-icon-style")).toBe("boxed");
      sidebar.appendChild(node("certifications"));
      applyResumeSectionPresentation(root, white, { main, sidebar, sections });
      expect(node("certifications").querySelector("[data-cv-icon]")?.getAttribute("data-cv-icon-style")).toBe("bare");
    }
  });

  it("sizes plain list sections of the white sidebar from its own icon column", () => {
    expect(sectionListMetrics(white, "sidebar")!.headingMm).toBe(10);
    expect(sectionListMetrics(white, "main")!.headingMm).toBe(12);
  });
});

describe("section presentation of Zweispaltig", () => {
  const zweispaltig = "zweispaltig";

  it("draws no icon and one heading for both columns", () => {
    for (const id of ["summary", "strengths", "experience", "education", "knowledge", "certifications", "languages", "special:abc"]) {
      const main = resolveSectionPresentation(zweispaltig, id, "main")!;
      const sidebar = resolveSectionPresentation(zweispaltig, id, "sidebar")!;
      expect(main.icon, id).toBeNull();
      expect(sidebar.icon, id).toBeNull();
      expect(sidebar.heading, id).toEqual(main.heading);
      expect(main.heading.color).toBe("var(--zweispaltig-heading)");
    }
  });

  it("rebuilds a heading without an icon, on both surfaces", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const { root, node, main, sidebar } = page(surface);
      applyResumeSectionPresentation(root, zweispaltig, { main, sidebar, sections: [{ id: "languages", nodes: [node("languages")] }, { id: "certifications", nodes: [node("certifications")] }] });
      for (const id of ["languages", "certifications"]) {
        expect(node(id).querySelector(".cv-heading__icon"), `${surface} ${id}`).toBeNull();
        expect(node(id).querySelector(".cv-heading > .cv-heading__label")?.textContent, `${surface} ${id}`).toBe(id === "languages" ? "Sprachen" : "Zertifikate");
      }
    }
  });

  it("keeps the spacing of the template: its own top margin, the divider and the body size of its lists", () => {
    const rules = resumeSectionPresentationCss.split("\n").filter((line) => line.includes(".zweispaltig-template"));
    const css = rules.join("\n");
    expect(css).toContain(':is(.zweispaltig-template,.cv-sheet[data-template="zweispaltig"]) [data-cv-zone="main"]{margin:var(--zweispaltig-section-gap) 0 0}');
    expect(css).toContain('[data-cv-zone="sidebar"]{margin:var(--zweispaltig-section-gap) 0 0}');
    expect(css).toContain("border-bottom:.65mm solid");
    expect(css).toContain("font-size:inherit;line-height:inherit;list-style:disc");
    expect(css).toContain("li::marker{color:var(--zweispaltig-primary)}");
    // The density steers the gap through the variable of the template, not through a rule of its own.
    expect(css).not.toContain('[data-density="compact"] [data-cv-zone="main"]{margin');
  });

  it("names which plain sections are rebuilt as one list and where the sidebar starts", () => {
    expect(isPlainListSection(zweispaltig, "certifications")).toBe(true);
    // Sprachen keeps its own level dots.
    expect(isPlainListSection(zweispaltig, "languages")).toBe(false);
    expect(isPlainListSection(templateId, "languages")).toBe(true);
    expect(isPlainListSection("modern", "certifications")).toBe(false);
    expect(hasSidebarHero(zweispaltig)).toBe(false);
    expect(hasSidebarHero(templateId)).toBe(true);
  });

  it("sizes plain lists from the heading of the template and the body of the page", () => {
    const metrics = sectionListMetrics(zweispaltig, "sidebar")!;
    expect(metrics.headingMm).toBeCloseTo(9.03, 2);
    expect(metrics.inheritBody).toBe(true);
    expect(sectionListMetrics(zweispaltig, "main")).toEqual(metrics);
    expect(sectionListMetrics(templateId, "sidebar")!.inheritBody).toBe(false);
  });
});
