import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import type { ComponentType } from "react";
import { applicationSchema, profileSchema } from "../../shared/schema";
import { getTemplate } from "../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { makeSidebarLaneInput, type SidebarLaneOptions } from "../../shared/__sidebarLaneFixture";
import { ManagedResumePreview } from "./ManagedResumePreview";
import { buildDocumentHtml } from "../../../electron/documents";
import { ZeitgenoessischResume } from "./templates/zeitgenoessisch";
import { ZweispaltigResume } from "./templates/zweispaltig";
import { StilvollResume } from "./templates/stilvoll";
import { ModernResume } from "./templates/modern";
import { KreativResume } from "./templates/kreativ";
import { KompaktResume } from "./templates/kompakt";
import { GepflegtResume } from "./templates/gepflegt";
import { ElegantResume } from "./templates/elegant";
import { managedResumeCss } from "../../shared/resumeManagedOutput";

const now = "2026-10-02T12:00:00.000Z";
type TemplateComponent = ComponentType<{
  profile: unknown; templateId: string; name: string; atsMode: boolean; plan: unknown; totalPages: number;
  accentColor: string; secondaryColor: string; photoSource: string | null; resumeProfile: string; sections: unknown;
}>;
const templates: Array<[string, TemplateComponent]> = [
  ["zeitgenoessisch", ZeitgenoessischResume as unknown as TemplateComponent],
  ["zweispaltig", ZweispaltigResume as unknown as TemplateComponent],
  ["stilvoll", StilvollResume as unknown as TemplateComponent],
];

const render = (templateId: string, Component: TemplateComponent, options: SidebarLaneOptions, overrides: Record<string, unknown> = {}) => {
  const template = getTemplate(templateId);
  const profile = profileSchema.parse(makeSidebarLaneInput(templateId, options));
  const designSettings = { ...getTemplateDocumentDesignDefaults(templateId), ...overrides };
  const application = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Firma", city: "Berlin" },
    contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId,
    accentColor: template.accent, secondaryColor: template.secondary, designSettings, documents: {},
    statusHistory: [], createdAt: now, updatedAt: now, sentAt: "2026-09-26T10:00:00.000Z",
  });
  const resolved = resolveCvDocument({ profile, templateId, settings: designSettings, application });
  const preview = resolved.pagePlan.map((plan) => parseHTML(renderToStaticMarkup(
    <ManagedResumePreview profile={resolved.profile} templateId={templateId} pageNumber={plan.pageNumber}
      totalPages={resolved.pagePlan.length} designSettings={designSettings} resolvedCv={resolved}>
      <Component profile={resolved.profile} templateId={templateId} name="Mina Kaya" atsMode={false} plan={plan}
        totalPages={resolved.pagePlan.length} accentColor={template.accent} secondaryColor={template.secondary}
        photoSource={null} resumeProfile="" sections={resolved.sections} />
    </ManagedResumePreview>,
  )).document as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  return { resolved, surfaces: { preview, pdf } as Record<"preview" | "pdf", Element[]> };
};

const SIDEBAR = 'aside,[data-cv-zone="sidebar"]';
const inSidebar = (node: Element) => Boolean(node.closest(SIDEBAR));
const knowledgeNames = (page: Element) =>
  Array.from(page.querySelectorAll('[data-managed-section="knowledge"] .managed-item-text'))
    .map((node) => /Kenntnis (\d+)/.exec(node.textContent ?? "")?.[1] ?? "");
const sections = (page: Element) =>
  Array.from(page.querySelectorAll("[data-managed-section]")).map((node) => `${node.getAttribute("data-managed-section")}:${inSidebar(node) ? "s" : "m"}`).sort();

describe.each(templates)("sidebar lane on the page, %s", (templateId, Component) => {
  const output = render(templateId, Component, { knowledge: 24 });

  it("draws the first part in the sidebar of page one and the rest in the sidebar of page two, on both surfaces", () => {
    expect(output.resolved.pagePlan.length).toBeGreaterThanOrEqual(2);
    for (const surface of ["preview", "pdf"] as const) {
      const pages = output.surfaces[surface];
      expect(pages, surface).toHaveLength(output.resolved.pagePlan.length);
      const first = knowledgeNames(pages[0]);
      const second = knowledgeNames(pages[1]);
      expect(first.length, surface).toBeGreaterThan(0);
      expect(second.length, surface).toBeGreaterThan(0);
      // every item exactly once, in order, split at a row
      expect([...first, ...second], surface).toEqual(Array.from({ length: 24 }, (_, index) => String(index + 1).padStart(2, "0")));
      for (const page of pages.slice(0, 2)) {
        const knowledge = page.querySelector('[data-managed-section="knowledge"]')!;
        expect(inSidebar(knowledge), surface).toBe(true);
        expect(knowledge.getAttribute("data-cv-zone"), surface).toBe("sidebar");
      }
    }
  });

  it("keeps the sidebar of page two (a sidebar element is there), and fills it with the planned section only", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const page = output.surfaces[surface][1];
      const aside = page.querySelector("aside");
      expect(aside, surface).not.toBeNull();
      expect(output.resolved.pagePlan[1].sidebar).toBe(true);
      // nothing of page one's sidebar is repeated: no contacts, no strengths, no languages
      expect(aside!.querySelector('a[href^="mailto:"],a[href^="tel:"]'), surface).toBeNull();
      expect(page.querySelector('[data-managed-section="strengths"]'), surface).toBeNull();
      expect(page.querySelector('[data-managed-section="languages"]'), surface).toBeNull();
      expect(aside!.querySelector('[data-managed-section="knowledge"]'), surface).not.toBeNull();
    }
  });

  it("repeats the plain heading on page two and marks the continued category", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const heading = output.surfaces[surface][1].querySelector('[data-managed-section="knowledge"] > :is(h2,h3)');
      expect(heading?.textContent?.replace(/\s+/g, " ").trim(), surface).toBe("Besondere Kenntnisse");
      expect(output.surfaces[surface][1].querySelector('[data-managed-section="knowledge"] [data-resume-entry-marker]')?.textContent, surface).toContain("Fortsetzung");
    }
  });

  it("flows the main column independently: the education goes on in the main column of page two", () => {
    for (const surface of ["preview", "pdf"] as const) {
      const page = output.surfaces[surface][1];
      const education = page.querySelector('[data-managed-section="education"]');
      if (output.resolved.pagePlan[1].items.some((item) => item.kind === "education")) {
        expect(education, surface).not.toBeNull();
        expect(inSidebar(education!), surface).toBe(false);
      }
    }
  });

  it("is the same page plan on both surfaces: the same sections in the same columns on every page", () => {
    for (let index = 0; index < output.resolved.pagePlan.length; index += 1)
      expect(sections(output.surfaces.preview[index]), `page ${index + 1}`).toEqual(sections(output.surfaces.pdf[index]));
  });

  it("marks the columns of every page so that the column surfaces run to the usable bottom", () => {
    for (const surface of ["preview", "pdf"] as const) {
      for (const page of output.surfaces[surface]) {
        const host = page.querySelector("[data-resume-columns]");
        expect(host, surface).not.toBeNull();
        expect(host!.parentElement?.hasAttribute("data-resume-columns-root"), surface).toBe(true);
      }
    }
  });

  it("draws no continuation sidebar when the page plan has no sidebar content for the page", () => {
    const idle = render(templateId, Component, { knowledge: 3, stations: 5, bullets: 6, education: 4 });
    expect(idle.resolved.pagePlan.length).toBeGreaterThanOrEqual(2);
    for (const surface of ["preview", "pdf"] as const)
      for (const page of idle.surfaces[surface].slice(1)) {
        expect(page.querySelector("aside"), surface).toBeNull();
        expect(page.querySelector("[data-resume-continued-sidebar]"), surface).toBeNull();
      }
  });

  it("keeps the knowledge section in the main column when the user put it there: no sidebar on page two for it", () => {
    const main = render(templateId, Component, { knowledge: 24, zone: "main" });
    for (const surface of ["preview", "pdf"] as const) {
      for (const page of main.surfaces[surface]) {
        const knowledge = page.querySelector('[data-managed-section="knowledge"]');
        if (knowledge) expect(inSidebar(knowledge), surface).toBe(false);
      }
    }
  });
});

// The column surfaces (the background the user gives the main and the side column) belong to every two-column template.
describe("column surfaces run to the usable bottom of the page", () => {
  const all: Array<[string, TemplateComponent]> = [
    ...templates,
    ["modern", ModernResume as unknown as TemplateComponent],
    ["kreativ", KreativResume as unknown as TemplateComponent],
    ["kompakt", KompaktResume as unknown as TemplateComponent],
    ["gepflegt", GepflegtResume as unknown as TemplateComponent],
    ["elegant", ElegantResume as unknown as TemplateComponent],
  ];

  it.each(all)("%s: the columns host of every page is marked on both surfaces", (templateId, Component) => {
    const output = render(templateId, Component, { knowledge: 6, stations: 4, bullets: 6 });
    for (const surface of ["preview", "pdf"] as const)
      for (const page of output.surfaces[surface]) {
        const hosts = page.querySelectorAll("[data-resume-columns]");
        expect(hosts, `${surface} ${templateId}`).toHaveLength(1);
        expect(hosts[0].parentElement?.hasAttribute("data-resume-columns-root"), `${surface} ${templateId}`).toBe(true);
      }
  });

  it("the page rules make the columns host take the room between header and footer and its columns stretch", () => {
    expect(managedResumeCss).toContain("[data-resume-columns-root]{display:flex!important;flex-direction:column!important}");
    expect(managedResumeCss).toContain("[data-resume-columns-root]>[data-resume-columns]{flex:1 1 auto!important");
    expect(managedResumeCss).toContain("[data-resume-columns]>:is(main,aside,");
    expect(managedResumeCss).toContain("{align-self:stretch!important;min-height:100%}");
  });

  it("gepflegt: the main column that grows to the page bottom holds the special sections, they do not sink below it", () => {
    const output = render("gepflegt", GepflegtResume as unknown as TemplateComponent, { knowledge: 4, specials: 2, specialEntries: 3 });
    const last = output.surfaces.preview[output.surfaces.preview.length - 1];
    const specials = last.querySelectorAll(".resume-special-output-list");
    expect(specials.length).toBeGreaterThan(0);
    for (const list of Array.from(specials)) expect(list.closest("main.gepflegt-main")).not.toBeNull();
  });

  it.each(all)("%s: the plain (ATS) output stays a single column without surfaces", (templateId, Component) => {
    const output = render(templateId, Component, { knowledge: 6 }, { resumeOutputMode: "ats" });
    for (const page of output.surfaces.preview) expect(page.querySelector("[data-resume-columns]"), templateId).toBeNull();
  });
});
