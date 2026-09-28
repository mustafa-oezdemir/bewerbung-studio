import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { profileSchema } from "./schema";
import { applyManagedResumeOutput, applyResumeSectionHeadingColors } from "./resumeManagedOutput";
import { defaultDocumentDesign } from "./documentDesign";
import { createKnowledgeCategory, createKnowledgeItem } from "../features/knowledge/knowledge.utils";

const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(),
  strengths: Array.from({ length: 10 }, (_, index) => ({ id: crypto.randomUUID(), title: `Stärke ${index + 1}`, description: index === 0 ? "<script>Text</script>" : "" })),
});
const page = '<section class="cv-sheet"><main><section><h2>Stärken</h2><p>Old content</p></section></main></section>';

describe("shared strengths output", () => {
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
    expect(document.querySelector('[data-managed-section="experience"] h2 b')?.textContent).toBe("Berufserfahrung");
    expect(document.querySelector('[data-managed-section="experience"] h2 svg')).not.toBeNull();
    expect(document.querySelector("main")?.lastElementChild?.tagName).toBe("FOOTER");
    expect(document.querySelector('[data-custom-role="heading-label"]')?.textContent).toBe("Eigener Abschnitt");
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
