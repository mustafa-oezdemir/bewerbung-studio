import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { sectionIcons } from "../../../../shared/resumeSectionPresentation";
import { pehlioneAppearanceCss } from "../../../../shared/pehlioneAppearance";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { PehlioneResume } from "./PehlioneResume";

type PehlioneId = "pehlione_white_blue" | "pehlione_white";
// The template of the running block (`describe.each` below): both Pehlione templates follow the same rules.
let templateId: PehlioneId = "pehlione_white_blue";
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
    status: "Entwurf", templateId, accentColor: "#08245C", secondaryColor: "#08245C", designSettings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now, sentAt,
  });
  const resolved = resolveCvDocument({ profile, templateId, settings: designSettings, application });
  const preview = resolved.pagePlan.map((page) => parseHTML(renderToStaticMarkup(
    <ManagedResumePreview profile={resolved.profile} templateId={templateId} pageNumber={page.pageNumber} totalPages={resolved.pagePlan.length} designSettings={designSettings} resolvedCv={resolved}>
      <PehlioneResume templateId={templateId} profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={page} totalPages={resolved.pagePlan.length}
        accentColor={template.accent} secondaryColor={template.secondary} resumeProfile={resolved.paginationSummary} sections={resolved.sections} closingDate={resolved.closingDate} />
    </ManagedResumePreview>,
  )).document as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  return { resolved, surfaces: { preview, pdf } };
};
const surfaces = ["preview", "pdf"] as const;
const sidebarOf = (page: Element) => page.querySelector(".pehlione-sidebar,.pehlione-pdf-sidebar");
const sectionOn = (page: Element, id: string) => page.querySelector(`[data-managed-section="${id}"]`);
const sidebarSection = (page: Element, id: string) => sidebarOf(page)?.querySelector(`[data-managed-section="${id}"]`) ?? null;
const move = (profile: ReturnType<typeof makeProfile>, id: string, zone: "main" | "sidebar", index = 0) => moveManagerSection(profile, templateId, id, zone, index);

describe.each(["pehlione_white_blue", "pehlione_white"] as const)("%s: sections follow their column", (template) => {
  beforeEach(() => { templateId = template; });

  it("A. a section moved from the main column to the sidebar is drawn as a sidebar section, in the preview and the PDF", () => {
    const before = render(makeProfile(5));
    const after = render(move(makeProfile(5), "certifications", "sidebar"));
    for (const surface of surfaces) {
      // By default the certificates close the main column, on the last page.
      const last = before.surfaces[surface][1];
      expect(sectionOn(last, "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(sectionOn(before.surfaces[surface][0], "certifications"), surface).toBeNull();
      // Moved to the sidebar they stand there on page one, with the heading of the sidebar.
      const first = after.surfaces[surface][0];
      const node = sidebarSection(first, "certifications");
      expect(node, surface).not.toBeNull();
      expect(node?.getAttribute("data-cv-zone")).toBe("sidebar");
      expect(node?.querySelector(".cv-heading__icon svg"), surface).not.toBeNull();
      expect(node?.querySelector(".cv-heading__label")?.textContent).toBe("Zertifikate");
      expect(node?.querySelectorAll("li")).toHaveLength(3);
      expect(sectionOn(after.surfaces[surface][1], "certifications"), surface).toBeNull();
    }
  });

  it("B. the Sprachen icon is drawn from the one registry in the preview and the PDF, wherever the section stands", () => {
    for (const profile of [makeProfile(3), move(makeProfile(3), "languages", "main"), move(makeProfile(5), "languages", "main", 1)]) {
      const rendered = render(profile);
      const markup = surfaces.map((surface) => {
        const node = sectionOn(rendered.surfaces[surface][0], "languages")!;
        expect(node, surface).not.toBeNull();
        const icon = node.querySelector(".cv-heading__icon");
        expect(icon?.querySelector("svg"), surface).not.toBeNull();
        expect(node.querySelector("[data-cv-icon]")?.getAttribute("data-cv-icon")).toBe("languages");
        return icon!.innerHTML.replaceAll(" />", "/>");
      });
      expect(markup[0]).toBe(markup[1]);
      expect(markup[0]).toContain(sectionIcons.languages);
    }
  });

  it("C. a section pinned to page two comes back to the sidebar of page one once that column has room", () => {
    const summary = "Sehr ausführliche Beschreibung der Erfahrung in der Softwareentwicklung. ".repeat(11);
    const crowded = move(move(makeProfile(7, { summary }), "summary", "sidebar"), "certifications", "sidebar", 1);
    const roomy = move(move(makeProfile(7), "summary", "sidebar"), "certifications", "sidebar", 1);
    const full = render(crowded);
    const free = render(roomy);
    expect(full.resolved.pagePlan[1].blocks).toContain("certifications");
    expect(free.resolved.pagePlan[0].blocks).toContain("certifications");
    for (const surface of surfaces) {
      expect(sectionOn(full.surfaces[surface][1], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(sidebarSection(free.surfaces[surface][0], "certifications"), surface).not.toBeNull();
      expect(sectionOn(free.surfaces[surface][1], "certifications"), surface).toBeNull();
    }
  });

  it("D. a section moved to the main column starts on page one while there is room, else it flows on to page two", () => {
    const start = move(makeProfile(3), "certifications", "sidebar");
    const fits = render(move(start, "certifications", "main", 99));
    expect(fits.resolved.pagePlan).toHaveLength(1);
    const long = move(move(makeProfile(7), "certifications", "sidebar"), "certifications", "main", 99);
    const flows = render(long);
    expect(flows.resolved.pagePlan).toHaveLength(2);
    for (const surface of surfaces) {
      const one = sectionOn(fits.surfaces[surface][0], "certifications");
      expect(one?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(sidebarSection(fits.surfaces[surface][0], "certifications"), surface).toBeNull();
      expect(sectionOn(flows.surfaces[surface][0], "certifications"), surface).toBeNull();
      expect(sectionOn(flows.surfaces[surface][1], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
    }
  });

  it("E. the colour of a heading follows the column the section stands in", () => {
    const settings = { cvOverrides: { colors: { sectionHeading: "#1d4ed8" } }, resumeAppearance: { sidebarSectionHeadingColor: "#cc0000" } };
    const colourOf = (page: Element, id: string) => sectionOn(page, id)?.querySelector(".cv-heading")?.getAttribute("style") ?? "";
    const inSidebar = render(move(makeProfile(5), "certifications", "sidebar"), settings);
    const inMain = render(makeProfile(5), settings);
    for (const surface of surfaces) {
      expect(colourOf(inSidebar.surfaces[surface][0], "certifications"), surface).toContain("color:#cc0000");
      expect(colourOf(inSidebar.surfaces[surface][0], "languages"), surface).toContain("color:#cc0000");
      expect(colourOf(inMain.surfaces[surface][1], "certifications"), surface).toContain("color:#1d4ed8");
      expect(colourOf(inMain.surfaces[surface][0], "experience"), surface).toContain("color:#1d4ed8");
      // The glyph of a boxed icon keeps its contrast against the box; a bare icon follows the colour of its title.
      const icon = sectionOn(inSidebar.surfaces[surface][0], "certifications")?.querySelector(".cv-heading__icon svg");
      const style = icon?.getAttribute("style") ?? "";
      if (templateId === "pehlione_white") expect(style, surface).toContain("stroke:#cc0000");
      else expect(style, surface).not.toContain("stroke");
    }
  });

  it("F. the closing prints the place and the date of the application, in the preview and the PDF", () => {
    const rendered = render(makeProfile(3), {}, "2026-09-26T10:00:00.000Z");
    expect(rendered.resolved.closingDate).toBe("2026-09-26");
    for (const surface of surfaces) {
      const pages = rendered.surfaces[surface];
      const closing = pages[pages.length - 1].querySelector("footer.pehlione-closing,footer.pehlione-pdf-closing");
      expect(closing?.querySelector("p")?.textContent, surface).toBe("Marburg, 2026-09-26");
      expect(closing?.textContent ?? "").not.toContain("2020-01-01");
    }
    // The choice of another place and alignment goes through the shared closing block with the same date.
    const chosen = render(makeProfile(3), { resumePresentation: { closing: { placement: "main" } } }, "2026-09-26T10:00:00.000Z");
    for (const surface of surfaces) {
      const pages = chosen.surfaces[surface];
      expect(pages[pages.length - 1].querySelector("[data-resume-closing-date]")?.textContent, surface).toBe("2026-09-26");
      expect(pages[pages.length - 1].querySelector("[data-resume-closing-place]")?.textContent, surface).toBe("Marburg");
    }
    // The place falls back to the city of the profile.
    const cityOnly = render(makeProfile(3, { applicationPlace: "" }), {}, "2026-01-05T10:00:00.000Z");
    for (const surface of surfaces) {
      const pages = cityOnly.surfaces[surface];
      expect(pages[pages.length - 1].querySelector("footer.pehlione-closing p,footer.pehlione-pdf-closing p")?.textContent, surface).toBe("Berlin, 2026-01-05");
    }
  });

  it("G. over several pages the closing stands once, on the last page, and every section is drawn once", () => {
    const rendered = render(move(makeProfile(7), "certifications", "sidebar"));
    expect(rendered.resolved.pagePlan).toHaveLength(2);
    for (const surface of surfaces) {
      const pages = rendered.surfaces[surface];
      expect(pages).toHaveLength(2);
      expect(pages[0].querySelectorAll("footer.pehlione-closing,footer.pehlione-pdf-closing,[data-resume-closing]"), surface).toHaveLength(0);
      expect(pages[1].querySelectorAll("footer.pehlione-closing,footer.pehlione-pdf-closing,[data-resume-closing]"), surface).toHaveLength(1);
      // The continuation page has one flow: no sidebar.
      expect(sidebarOf(pages[1]), surface).toBeNull();
      const ids = pages.flatMap((page) => Array.from(page.querySelectorAll("[data-managed-section]")).map((node) => node.getAttribute("data-managed-section")!));
      for (const id of ["languages", "certifications", "strengths"]) expect(ids.filter((value) => value === id), `${surface} ${id}`).toHaveLength(1);
    }
  });

  it("H. the header repeated on page two is the header of page one, in the preview as in the PDF", () => {
    const rendered = render(move(makeProfile(7), "certifications", "sidebar"));
    for (const surface of surfaces) {
      const [first, second] = rendered.surfaces[surface];
      const header = (page: Element) => page.querySelector("header")!;
      expect(header(second).querySelector("h1")?.textContent, surface).toBe(header(first).querySelector("h1")?.textContent);
      expect(header(second).className, surface).toBe(header(first).className);
      expect(header(second).className).not.toContain("continuation");
    }
    // The preview stylesheet of page two no longer shrinks that header (both Pehlione White templates).
    expect(pehlioneAppearanceCss).toContain('[data-template="pehlione_white_blue"],[data-template="pehlione_white"])[data-page="2"]:not([data-density="compact"]) .pehlione-header h1{font-size:29pt}');
  });

  it("I. the typography chosen for the section headings reaches every heading of either column", () => {
    const settings = { cvOverrides: { typography: { sectionHeadingSizePt: 15, sectionHeadingUppercase: false } } };
    const rendered = render(move(makeProfile(5), "certifications", "sidebar"), settings);
    for (const surface of surfaces) {
      for (const id of ["certifications", "languages", "experience"]) {
        const heading = sectionOn(rendered.surfaces[surface][0], id)?.querySelector(".cv-heading");
        expect(heading?.getAttribute("style") ?? "", `${surface} ${id}`).toContain("font-size:15pt");
        expect(heading?.getAttribute("style") ?? "").toContain("text-transform:none");
      }
    }
  });
});
