import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { ZeitgenoessischResume } from "./ZeitgenoessischResume";

const templateId = "zeitgenoessisch";
const now = "2026-09-21T12:00:00.000Z";
const makeProfile = (count: number) => profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin",
  city: "Berlin", applicationPlace: "Marburg", applicationDate: "2020-01-01",
  email: "mina@example.com", summary: "Erfahrene Entwicklerin mit Schwerpunkt auf skalierbaren Plattformen.",
  strengths: [{ id: crypto.randomUUID(), title: "Analytisches Denken", description: "" }],
  languages: ["Deutsch – C1", "Englisch – B2"],
  certifications: ["IBM Full Stack Software Developer", "Apache Kafka"],
  experiences: Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Position ${index + 1}`,
    company: `Unternehmen ${index + 1}`, city: "Berlin",
    achievements: Array.from({ length: 3 }, (_, bullet) => `Messbares Ergebnis ${bullet + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im gesamten Team.`),
  })),
  education: [{ id: crypto.randomUUID(), from: "2000", to: "2004", degree: "Abschluss", institution: "Hochschule" }],
  updatedAt: now,
});
type Profile = ReturnType<typeof makeProfile>;
const move = (profile: Profile, zone: "main" | "sidebar", index = 0) =>
  moveManagerSection(profile, templateId, "certifications", zone, index);
const render = (profile: Profile, overrides: Record<string, unknown> = {}) => {
  const template = getTemplate(templateId);
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
      <ZeitgenoessischResume profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={plan}
        totalPages={resolved.pagePlan.length} accentColor={template.accent} secondaryColor={template.secondary}
        photoSource={null} resumeProfile="" sections={resolved.sections} />
    </ManagedResumePreview>,
  )).document as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  return { resolved, surfaces: { preview, pdf } };
};
const section = (page: Element, id: string) => page.querySelector(`[data-managed-section="${id}"]`);

describe("Zeitgenössisch: shared document flow", () => {
  it("moves certificates between the main column, continuation and first-page sidebar on both surfaces", () => {
    const base = makeProfile(6);
    const behind = render(move(base, "main", 99));
    const sidebar = render(move(move(base, "main", 99), "sidebar"));
    const above = render(move(move(base, "main", 99), "main", 0));
    expect(behind.resolved.pagePlan).toHaveLength(2);
    expect(behind.resolved.pagePlan[1].blocks).toContain("certifications");
    expect(sidebar.resolved.pagePlan[0].blocks).toContain("certifications");
    expect(above.resolved.pagePlan[0].blocks).toContain("certifications");
    for (const surface of ["preview", "pdf"] as const) {
      expect(section(behind.surfaces[surface][0], "certifications"), surface).toBeNull();
      expect(section(behind.surfaces[surface][1], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(section(sidebar.surfaces[surface][0], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("sidebar");
      expect(section(above.surfaces[surface][0], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
    }
  });

  it("uses the same Sprachen icon and application closing in preview and PDF", () => {
    const output = render(makeProfile(6));
    for (const surface of ["preview", "pdf"] as const) {
      const pages = output.surfaces[surface];
      expect(section(pages[0], "summary")?.getAttribute("data-cv-zone"), surface).toBe("main");
      const languages = section(pages[0], "languages");
      expect(languages?.querySelectorAll(":scope > .cv-heading"), surface).toHaveLength(1);
      expect(languages?.querySelector("[data-cv-icon]")?.getAttribute("data-cv-icon"), surface).toBe("languages");
      expect(pages[0].querySelector("[data-resume-closing]"), surface).toBeNull();
      expect(pages[pages.length - 1].querySelector("[data-resume-closing-line]")?.textContent, surface).toBe("Marburg, 26.09.2026");
    }
    const icon = (surface: "preview" | "pdf") => section(output.surfaces[surface][0], "languages")?.querySelector(".cv-heading__icon")?.innerHTML;
    expect(icon("preview")).toBe(icon("pdf"));
  });

  it("applies the destination heading style to certificates and keeps all native section icons", () => {
    const settings = { cvOverrides: { colors: { sectionHeading: "#1d4ed8" } }, resumeAppearance: { sidebarSectionHeadingColor: "#cc0000" } };
    const inSidebar = render(move(makeProfile(3), "sidebar"), settings);
    const inMain = render(move(makeProfile(3), "main", 99), settings);
    for (const surface of ["preview", "pdf"] as const) {
      const sidebar = section(inSidebar.surfaces[surface][0], "certifications")!;
      const main = inMain.surfaces[surface].map((page) => section(page, "certifications")).find(Boolean)!;
      expect(sidebar.querySelector(":scope > .cv-heading")?.getAttribute("style"), surface).toContain("color:#cc0000");
      expect(main.querySelector(":scope > .cv-heading")?.getAttribute("style"), surface).toContain("color:#1d4ed8");
      for (const page of inSidebar.surfaces[surface])
        for (const node of Array.from(page.querySelectorAll("[data-managed-section]"))) {
          expect(node.querySelectorAll(":scope > .cv-heading"), `${surface} ${node.getAttribute("data-managed-section")}`).toHaveLength(1);
          expect(node.querySelectorAll(":scope > .cv-heading .cv-heading__icon"), `${surface} ${node.getAttribute("data-managed-section")}`).toHaveLength(1);
        }
    }
  });
});
