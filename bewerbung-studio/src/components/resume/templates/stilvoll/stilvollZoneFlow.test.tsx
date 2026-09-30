import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { StilvollResume } from "./StilvollResume";

const templateId = "stilvoll";
const now = "2026-09-21T12:00:00.000Z";
const bullet = (index: number) =>
  `Messbares Ergebnis ${index + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im gesamten Team.`;

const makeProfile = (experiences: number, extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", city: "Berlin", email: "mina@example.com", phone: "+49 176 123456",
    applicationPlace: "Marburg", applicationDate: "2020-01-01",
    summary: "Erfahrene Entwicklerin mit Schwerpunkt auf skalierbaren Plattformen.",
    strengths: ["Analytisches Denken", "Strukturierte Arbeitsweise"].map((title) => ({ id: crypto.randomUUID(), title, description: "" })),
    languages: ["Deutsch – C1", "Englisch – B2"],
    certifications: ["IBM Full Stack Software Developer", "DevOps and Software Engineering", "Apache Kafka"],
    experiences: Array.from({ length: experiences }, (_, index) => ({
      id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Position ${index + 1}`, company: `Unternehmen ${index + 1}`, city: "Berlin",
      achievements: Array.from({ length: 3 }, (_, item) => bullet(item)),
    })),
    education: [{ id: crypto.randomUUID(), from: "2000", to: "2004", degree: "Abschluss", institution: "Hochschule" }],
    updatedAt: now,
    ...extra,
  });

type Settings = Record<string, unknown>;
/** The page the user sees (React preview) and the page the PDF prints, from the same profile and the same application. */
const render = (profile: ReturnType<typeof makeProfile>, settings: Settings = {}, sentAt = "2026-09-26T10:00:00.000Z") => {
  const template = getTemplate(templateId);
  const designSettings = { ...getTemplateDocumentDesignDefaults(templateId), ...settings };
  const application = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
    status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary, designSettings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now, sentAt,
  });
  const resolved = resolveCvDocument({ profile, templateId, settings: designSettings, application });
  const preview = resolved.pagePlan.map((page) => parseHTML(renderToStaticMarkup(
    <ManagedResumePreview profile={resolved.profile} templateId={templateId} pageNumber={page.pageNumber} totalPages={resolved.pagePlan.length} designSettings={designSettings} resolvedCv={resolved}>
      <StilvollResume profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={page} totalPages={resolved.pagePlan.length}
        accentColor={template.accent} secondaryColor={template.secondary} backgroundId={designSettings.backgroundId} photoSource={null} resumeProfile="" sections={resolved.sections} />
    </ManagedResumePreview>,
  )).document as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  return { resolved, surfaces: { preview, pdf } };
};
const surfaces = ["preview", "pdf"] as const;
const sidebarOf = (page: Element) => page.querySelector(".stilvoll-left,.stilvoll-pdf-columns > aside");
const sectionOn = (page: Element, id: string) => page.querySelector(`[data-managed-section="${id}"]`);
const sidebarSection = (page: Element, id: string) => sidebarOf(page)?.querySelector(`[data-managed-section="${id}"]`) ?? null;
const move = (profile: ReturnType<typeof makeProfile>, id: string, zone: "main" | "sidebar", index = 0) => moveManagerSection(profile, templateId, id, zone, index);

describe("Stilvoll: sections follow their column", () => {
  it("A. the certificates stand in the sidebar of page one by default and follow the career once they are moved to the main column", () => {
    const inSidebar = render(makeProfile(5));
    const inMain = render(move(makeProfile(5), "certifications", "main", 99));
    const behindLong = render(move(makeProfile(6), "certifications", "main", 99));
    for (const surface of surfaces) {
      const node = sidebarSection(inSidebar.surfaces[surface][0], "certifications");
      expect(node, surface).not.toBeNull();
      expect(node?.getAttribute("data-cv-zone")).toBe("sidebar");
      expect(node?.querySelector(".cv-heading__label")?.textContent).toBe("Zertifikate");
      expect(node?.querySelectorAll("li")).toHaveLength(3);
      // In the main column they stand behind the career entries: on page one while it has room, else on page two.
      const first = inMain.surfaces[surface][0];
      expect(sectionOn(first, "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(sidebarSection(first, "certifications"), surface).toBeNull();
      const long = behindLong.surfaces[surface];
      expect(long, surface).toHaveLength(2);
      expect(sectionOn(long[0], "certifications"), surface).toBeNull();
      expect(sectionOn(long[1], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(sectionOn(long[1], "certifications")?.querySelectorAll("li"), surface).toHaveLength(3);
    }
  });

  it("B. every section draws the heading of the template, without an icon, and Sprachen keeps its own level dots", () => {
    for (const profile of [makeProfile(3), move(makeProfile(3), "languages", "main"), move(makeProfile(5), "languages", "main", 1)]) {
      const rendered = render(profile);
      for (const surface of surfaces) {
        const page = rendered.surfaces[surface][0];
        const node = sectionOn(page, "languages")!;
        expect(node, surface).not.toBeNull();
        const heading = node.querySelector(":scope > .cv-heading");
        expect(heading?.querySelector(":scope > .cv-heading__label")?.textContent, surface).toBe("Sprachen");
        expect(heading?.querySelector(".cv-heading__icon"), surface).toBeNull();
        expect(node.querySelectorAll('.stilvoll-languages i,[class*="pdf-dots"] i'), surface).toHaveLength(12);
        // Every managed heading of the page is drawn by the shared heading, in either column.
        for (const section of Array.from(page.querySelectorAll("[data-managed-section]")))
          expect(section.querySelector(":scope > .cv-heading"), `${surface} ${section.getAttribute("data-managed-section")}`).not.toBeNull();
      }
    }
  });

  it("C. a section pushed to page two comes back to the sidebar of page one when the user moves it there", () => {
    const behind = move(makeProfile(6), "certifications", "main", 99);
    const back = move(behind, "certifications", "sidebar", 0);
    const pushed = render(behind);
    const returned = render(back);
    expect(pushed.resolved.pagePlan[1].blocks).toContain("certifications");
    expect(returned.resolved.pagePlan[0].blocks).toContain("certifications");
    for (const surface of surfaces) {
      expect(sectionOn(pushed.surfaces[surface][1], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(sidebarSection(returned.surfaces[surface][0], "certifications"), surface).not.toBeNull();
      expect(sectionOn(returned.surfaces[surface][1], "certifications"), surface).toBeNull();
    }
  });

  it("D. a section moved to the main column starts on page one while there is room, else it flows on to page two", () => {
    const fits = render(move(makeProfile(5), "certifications", "main", 99));
    const flows = render(move(makeProfile(6), "certifications", "main", 99));
    const above = render(move(makeProfile(6), "certifications", "main", 0));
    expect(fits.resolved.pagePlan).toHaveLength(1);
    expect(flows.resolved.pagePlan[0].blocks ?? []).not.toContain("certifications");
    expect(above.resolved.pagePlan[0].blocks).toContain("certifications");
    for (const surface of surfaces) {
      expect(sectionOn(fits.surfaces[surface][0], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(sectionOn(flows.surfaces[surface][0], "certifications"), surface).toBeNull();
      expect(sectionOn(flows.surfaces[surface][1], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(sectionOn(above.surfaces[surface][0], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
    }
  });

  it("E. the colour of a heading follows the column the section stands in", () => {
    const settings = { cvOverrides: { colors: { sectionHeading: "#1d4ed8" } }, resumeAppearance: { sidebarSectionHeadingColor: "#cc0000" } };
    const colourOf = (page: Element, id: string) => sectionOn(page, id)?.querySelector(".cv-heading")?.getAttribute("style") ?? "";
    const inSidebar = render(makeProfile(3), settings);
    const inMain = render(move(makeProfile(3), "certifications", "main", 99), settings);
    for (const surface of surfaces) {
      expect(colourOf(inSidebar.surfaces[surface][0], "certifications"), surface).toContain("color:#cc0000");
      expect(colourOf(inSidebar.surfaces[surface][0], "languages"), surface).toContain("color:#cc0000");
      expect(colourOf(inMain.surfaces[surface][0], "certifications"), surface).toContain("color:#1d4ed8");
      expect(colourOf(inMain.surfaces[surface][0], "experience"), surface).toContain("color:#1d4ed8");
    }
  });

  it("F. the closing prints the place and the date of the application, in the preview and the PDF", () => {
    const rendered = render(makeProfile(3), {}, "2026-09-26T10:00:00.000Z");
    expect(rendered.resolved.closingDate).toBe("2026-09-26");
    for (const surface of surfaces) {
      const pages = rendered.surfaces[surface];
      const closing = pages[pages.length - 1].querySelector("[data-resume-closing]");
      expect(closing?.querySelector("[data-resume-closing-line]")?.textContent, surface).toBe("Marburg, 2026-09-26");
      expect(closing?.textContent ?? "").not.toContain("2020-01-01");
    }
    // Without a place typed in the closing falls back to the city of the profile.
    const cityOnly = render(makeProfile(3, { applicationPlace: "" }), {}, "2026-01-05T10:00:00.000Z");
    for (const surface of surfaces) {
      const pages = cityOnly.surfaces[surface];
      expect(pages[pages.length - 1].querySelector("[data-resume-closing-line]")?.textContent, surface).toBe("Berlin, 2026-01-05");
    }
  });

  it("G. over several pages the closing stands once, on the last page, and every section is drawn once", () => {
    const rendered = render(move(makeProfile(6), "certifications", "main", 99));
    expect(rendered.resolved.pagePlan).toHaveLength(2);
    for (const surface of surfaces) {
      const pages = rendered.surfaces[surface];
      expect(pages).toHaveLength(2);
      expect(pages[0].querySelectorAll("[data-resume-closing]"), surface).toHaveLength(0);
      expect(pages[1].querySelectorAll("[data-resume-closing]"), surface).toHaveLength(1);
      // The continuation page has one flow: no sidebar.
      expect(sidebarOf(pages[1]), surface).toBeNull();
      const ids = pages.flatMap((page) => Array.from(page.querySelectorAll("[data-managed-section]")).map((node) => node.getAttribute("data-managed-section")!));
      for (const id of ["languages", "certifications", "strengths", "summary"]) expect(ids.filter((value) => value === id), `${surface} ${id}`).toHaveLength(1);
    }
  });

  it("H. a section the template drew on its last page is drawn once when the plan hosts it in the sidebar of page one", () => {
    const withSpecial = (source: ReturnType<typeof makeProfile>) => profileSchema.parse({
      ...source, specialSections: [{ id: "88000000-0000-4000-8000-000000000001", kind: "interests", title: "Interessen", isVisible: true, contentType: "list", entries: [{ id: crypto.randomUUID(), title: "Schach" }] }],
    });
    const id = "special:88000000-0000-4000-8000-000000000001";
    const rendered = render(move(withSpecial(makeProfile(6)), id, "sidebar", 0));
    expect(rendered.resolved.pagePlan[0].blocks).toContain(id);
    for (const surface of surfaces) {
      const drawn = rendered.surfaces[surface].flatMap((page) => Array.from(page.querySelectorAll(`[data-managed-section="${id}"]`)));
      expect(drawn, surface).toHaveLength(1);
      expect(sidebarSection(rendered.surfaces[surface][0], id), surface).not.toBeNull();
    }
  });

  it("I. the typography chosen for the section headings reaches every heading of either column", () => {
    const settings = { cvOverrides: { typography: { sectionHeadingSizePt: 15, sectionHeadingUppercase: false } } };
    const rendered = render(move(makeProfile(3), "certifications", "main", 99), settings);
    for (const surface of surfaces) {
      for (const id of ["certifications", "languages", "experience"]) {
        const heading = sectionOn(rendered.surfaces[surface][0], id)?.querySelector(".cv-heading");
        expect(heading?.getAttribute("style") ?? "", `${surface} ${id}`).toContain("font-size:15pt");
        expect(heading?.getAttribute("style") ?? "").toContain("text-transform:none");
      }
    }
  });
});
