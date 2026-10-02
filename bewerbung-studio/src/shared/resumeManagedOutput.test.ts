import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { profileSchema } from "./schema";
import { applyManagedResumeOutput, applyResumeDesignOverrides, applyResumeSectionHeadingColors } from "./resumeManagedOutput";
import { defaultDocumentDesign } from "./documentDesign";
import { resolveCvDesign } from "./cvDesign";
import { createKnowledgeCategory, createKnowledgeItem } from "../features/knowledge/knowledge.utils";

const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(),
  strengths: Array.from({ length: 10 }, (_, index) => ({ id: crypto.randomUUID(), title: `Stärke ${index + 1}`, description: index === 0 ? "<script>Text</script>" : "" })),
});
const page = '<section class="cv-sheet"><main><section><h2>Stärken</h2><p>Old content</p></section></main></section>';

describe("shared strengths output", () => {
  it.each(["pehlione_white", "pehlione_white_blue"] as const)("keeps %s contacts in the first sidebar and second-page header only", (templateId) => {
    const applicant = profileSchema.parse({ ...profile, email: "mina@example.com", phone: "+49 30 123456" });
    const sheet = (pageNumber: number) => `<section class="page cv-sheet" data-resume-page="${pageNumber}" data-template="${templateId}"><div class="page-content pehlione-pdf"><aside class="pehlione-pdf-sidebar"><section class="pehlione-contacts"><ul><li data-contact-kind="phone">+49 30 123456</li><li data-contact-kind="email">mina@example.com</li></ul></section></aside><main class="pehlione-pdf-main"><header class="pehlione-pdf-header"><h1>Mina Kaya</h1><h2>Entwicklerin</h2></header></main></div></section>`;
    const { document } = parseHTML(applyManagedResumeOutput(sheet(1) + sheet(2), applicant, templateId, 1, 2));
    const first = document.querySelector('[data-resume-page="1"]')!;
    const second = document.querySelector('[data-resume-page="2"]')!;
    expect(first.querySelectorAll(".pehlione-contacts li")).toHaveLength(2);
    expect(first.querySelector("header [data-resume-header-extra-contact]")).toBeNull();
    expect(second.querySelector("header")?.hasAttribute("data-pehlione-continuation-header")).toBe(true);
    expect(second.querySelector('header a[href="mailto:mina@example.com"]')).not.toBeNull();
    expect(second.querySelector('header a[href="tel:+4930123456"]')).not.toBeNull();
  });
  it.each(["preview", "pdf"] as const)("applies semantic typography and color overrides to %s", (surface) => {
    const markup = surface === "pdf"
      ? '<section class="cv-sheet"><div class="page-content klassisch-pdf"><header><h1>Mina Kaya</h1><h2>Entwicklerin</h2></header><section class="klassisch-pdf-section" data-managed-section="experience"><h3 class="klassisch-pdf-title">Berufserfahrung</h3><article class="klassisch-pdf-entry"><h3>Rolle</h3><h4>Firma</h4><p>Text</p><small>Meta</small><svg></svg><div class="project-card">Projekt</div></article></section></div></section>'
      : '<section><div class="klassisch-template"><header><h1>Mina Kaya</h1><h2>Entwicklerin</h2></header><section class="klassisch-section" data-managed-section="experience"><h2 class="klassisch-section__title">Berufserfahrung</h2><article class="klassisch-career"><h3>Rolle</h3><h4>Firma</h4><p>Text</p><small>Meta</small><svg></svg><div class="project-card">Projekt</div></article></section></div></section>';
    const { document } = parseHTML(markup);
    const root = document.querySelector("section")!;
    const settings = { ...defaultDocumentDesign, cvOverrides: { colors: { text: "#010101", background: "#fafafa", paragraph: "#112233", heading: "#223344", subheading: "#334466", sectionHeading: "#334455", entryHeading: "#445566", divider: "#556677", accent: "#667788", surface: "#778899", muted: "#8899aa", icon: "#99aabb" },
      typography: { headingSizePt: 30, headingWeight: 800, sectionHeadingWeight: 600, sectionHeadingUppercase: true } } };
    applyResumeDesignOverrides(root, "klassisch", surface, settings, resolveCvDesign("klassisch", settings.cvOverrides));
    expect(root.getAttribute("style")).toContain("#fafafa");
    expect(root.querySelector("header h1")?.getAttribute("style")).toContain("30pt");
    expect(root.querySelector("header h1")?.getAttribute("style")).toContain("800");
    expect(root.querySelector("header h1")?.getAttribute("style")).toContain("#223344");
    expect(root.querySelector("header h2")?.getAttribute("style")).toContain("#334466");
    const heading = root.querySelector('[data-managed-section] > h2,[data-managed-section] > h3');
    expect(heading?.getAttribute("style")).toContain("uppercase");
    expect(heading?.getAttribute("style")).toContain("600");
    expect(heading?.getAttribute("style")).toContain("#334455");
    expect(heading?.getAttribute("style")).toContain("#556677");
    expect(root.querySelector("article h3")?.getAttribute("style")).toContain("#445566");
    expect(root.querySelector("article p")?.getAttribute("style")).toContain("#112233");
    expect(root.querySelector("article small")?.getAttribute("style")).toContain("#8899aa");
    expect(root.querySelector("article svg")?.getAttribute("style")).toContain("#99aabb");
    expect(root.querySelector(".project-card")?.getAttribute("style")).toContain("#778899");
    expect((surface === "pdf" ? root.querySelector(".page-content") : root.firstElementChild)?.getAttribute("style")).toContain("--accent:#667788");
  });
  it.each(["pehlione-sidebar", "elegant-pdf-sidebar", "gepflegt-sidebar"])("colors sidebar section titles in %s independently from body text", (sidebarClass) => {
    const { document } = parseHTML(`<div><aside class="${sidebarClass}"><section><h3><svg></svg><span>Kernkompetenzen</span></h3><p>Text</p><article><h3>Eintrag</h3></article></section><section><h3><span><svg></svg></span>Sprachen</h3></section></aside><main><section><h3>Berufserfahrung</h3></section></main></div>`);
    const root = document.querySelector("div")!;
    applyResumeSectionHeadingColors(root, { ...defaultDocumentDesign, resumeAppearance: { sidebarTextColor: "#ff0000" } });
    const headings = root.querySelectorAll("aside > section > h3");
    expect(Array.from(headings).map(node => (node as HTMLElement).style.color)).toEqual(["#ff0000", "#ff0000"]);
    expect(root.querySelector("aside p")?.getAttribute("style")).toBeNull();
    expect(root.querySelector("aside article h3")?.getAttribute("style")).toBeNull();
    expect(root.querySelector("main h3")?.getAttribute("style")).toBeNull();
    applyResumeSectionHeadingColors(root, { ...defaultDocumentDesign, resumeAppearance: { sidebarTextColor: "#ff0000", sidebarSectionHeadingColor: "#112233" } });
    expect(Array.from(headings).map(node => (node as HTMLElement).style.color)).toEqual(["#112233", "#112233"]);
    expect(Array.from(root.querySelectorAll("aside > section > h3 svg")).map(node => (node as SVGElement).style.color)).toEqual(["#112233", "#112233"]);
    expect(Array.from(root.querySelectorAll("aside > section > h3 svg")).map(node => (node as SVGElement).style.stroke)).toEqual(["#112233", "#112233"]);
  });
  it.each(["left", "right"])("resolves built-in and custom section titles by semantic column with sidebar on the %s", (side) => {
    const { document } = parseHTML('<div><main><section data-managed-section="experience"><h3>Berufserfahrung</h3></section></main><aside><section data-managed-section="special:project"><h3>Projekt-Highlight</h3></section></aside></div>');
    const root = document.querySelector("div")!;
    const main = root.querySelector("main")!;
    const sidebar = root.querySelector("aside")!;
    if (side === "left") root.insertBefore(sidebar, main);
    const settings = { ...defaultDocumentDesign, cvOverrides: { colors: { sectionHeading: "#123456" } },
      resumeAppearance: { sidebarSectionHeadingColor: "#ff0000" } };
    applyResumeSectionHeadingColors(root, settings);
    expect(main.querySelector("h3")?.getAttribute("style")).toContain("#123456");
    expect(sidebar.querySelector("h3")?.getAttribute("style")).toContain("#ff0000");
    const custom = sidebar.querySelector("section")!;
    main.appendChild(custom);
    applyResumeSectionHeadingColors(root, settings);
    expect(custom.querySelector("h3")?.getAttribute("style")).toContain("#123456");
    sidebar.appendChild(custom);
    applyResumeSectionHeadingColors(root, settings);
    expect(custom.querySelector("h3")?.getAttribute("style")).toContain("#ff0000");
  });
  it("preserves native heading decoration and inserts custom sections before the closing", () => {
    const custom = profileSchema.parse({ ...profile, strengths: [], specialSections: [{ id: crypto.randomUUID(), title: "Eigener Abschnitt", kind: "custom", entries: [{ id: crypto.randomUUID(), title: "Inhalt" }] }] });
    const html = '<main class="pehlione-main"><section class="pehlione-main-section"><h2 class="pehlione-section-heading"><span><svg></svg></span><b>Berufserfahrung</b></h2><p>Erfahrung</p></section><footer>Abschluss</footer></main>';
    const { document } = parseHTML(applyManagedResumeOutput(html, custom, "pehlione_white_blue"));
    expect(document.querySelector('[data-managed-section="experience"] h2 b')?.textContent).toBe("Beruflicher Werdegang");
    expect(document.querySelector('[data-managed-section="experience"] h2 svg')).not.toBeNull();
    expect(document.querySelector("main")?.lastElementChild?.tagName).toBe("FOOTER");
    expect(document.querySelector('[data-custom-role="heading-label"]')?.textContent).toBe("Eigener Abschnitt");
  });
  it.each(["preview", "pdf"])("gives Zeitgenössisch extra sections shared %s icon headings", (surface) => {
    const interestsId = crypto.randomUUID();
    const projectsId = crypto.randomUUID();
    const custom = profileSchema.parse({ ...profile, specialSections: [
      { id: interestsId, kind: "interests", title: "Hobbys & Interesses", entries: [{ id: crypto.randomUUID(), title: "Fotografie" }] },
      { id: projectsId, kind: "projects", title: "Projekt-Highlight", entries: [{ id: crypto.randomUUID(), title: "Open Source" }] },
    ] });
    const pdf = surface === "pdf";
    const html = pdf
      ? '<section class="cv-sheet zeit-pdf"><main class="zeit-pdf-main"><section class="zeit-pdf-section"><header class="zeit-pdf-heading"><i><svg></svg></i><h3>Berufserfahrung</h3></header></section></main><aside class="zeit-pdf-left"></aside></section>'
      : '<div class="zeitgenoessisch-template"><main class="zeitgenoessisch-main-column"><section class="zeitgenoessisch-section"><header class="zeitgenoessisch-section-heading"><span class="zeitgenoessisch-section-heading__icon"><svg></svg></span><h2 class="zeitgenoessisch-section-heading__title">Berufserfahrung</h2></header></section></main><aside class="zeitgenoessisch-left-column"></aside></div>';
    const { document } = parseHTML(applyManagedResumeOutput(html, custom, "zeitgenoessisch"));
    for (const id of [`special:${interestsId}`, `special:${projectsId}`, "strengths"]) {
      const section = document.querySelector(`[data-managed-section="${id}"]`);
      expect(section?.querySelector(":scope > .cv-heading .cv-heading__icon svg path")).not.toBeNull();
      expect(["H2", "H3"]).toContain(section?.querySelector('[data-custom-role="heading"]')?.tagName);
      expect(section?.querySelectorAll(":scope > .cv-heading")).toHaveLength(1);
    }
    expect(document.querySelector('[data-managed-section="experience"] svg')).not.toBeNull();
    expect(document.querySelector(`[data-managed-section="special:${interestsId}"]`)?.textContent).toContain("Fotografie");
  });
  it.each([1, 2, 3, 4] as const)("renders the saved %s columns with aligned icon/title markup", (columns) => {
    const { document } = parseHTML(applyManagedResumeOutput(page, profile, "klassisch", 1, 1, { ...defaultDocumentDesign, strengthsColumns: columns }));
    expect(document.querySelector(".managed-strengths-grid")?.getAttribute("data-columns")).toBe(String(columns));
    expect(document.querySelector(".managed-strength-card > svg + strong")).not.toBeNull();
  });

  it("renders all knowledge entries and preserves manual icons through JSON validation", () => {
    const item = { ...createKnowledgeItem("Java"), iconId: "symbol:diamond" };
    const category = { ...createKnowledgeCategory("Programmiersprachen"), items: [item, createKnowledgeItem("Spring Boot", 1)] };
    const withKnowledge = profileSchema.parse(JSON.parse(JSON.stringify({ ...profile, knowledgeSection: { title: "Kenntnisse", isVisible: true, categories: [category] } })));
    const { document } = parseHTML(applyManagedResumeOutput(page, withKnowledge, "klassisch", 1, 1, { ...defaultDocumentDesign, knowledgeColumns: 2 }));
    const knowledge = document.querySelector('[data-managed-section="knowledge"]');
    expect(knowledge?.querySelector(".managed-item-grid")?.getAttribute("data-columns")).toBe("2");
    expect(knowledge?.querySelector('[data-strength-symbol="symbol:diamond"]')).not.toBeNull();
    expect(knowledge?.querySelector('[data-brand="devicon:spring"]')).not.toBeNull();
    expect(knowledge?.textContent).toContain("Programmiersprachen");
  });
  it("keeps every record, escapes user text and renders the block only once across pages", () => {
    const { document } = parseHTML(applyManagedResumeOutput(page + page, profile, "klassisch"));
    expect(document.querySelectorAll(".managed-strengths-grid")).toHaveLength(1);
    expect(document.querySelectorAll(".managed-strength-card")).toHaveLength(10);
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector(".managed-strength-card p")?.textContent).toBe("<script>Text</script>");
    expect(applyManagedResumeOutput(page, profile, "klassisch", 2, 2)).not.toContain("managed-strength-card");
  });

  it("honors section visibility", () => {
    const hidden = { ...profile, resumeSections: { ...profile.resumeSections, strengths: false } };
    expect(applyManagedResumeOutput(page, hidden, "klassisch")).not.toContain("Stärken");
  });
});
