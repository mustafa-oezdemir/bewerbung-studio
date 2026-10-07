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
import { KlassischResume } from "./KlassischResume";

const templateId = "klassisch";
const now = "2026-09-21T12:00:00.000Z";
const makeProfile = (count: number) => profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin",
  city: "Berlin", applicationPlace: "Marburg", applicationDate: "2020-01-01",
  email: "mina@example.com", summary: "Erfahrene Entwicklerin mit Schwerpunkt auf skalierbaren Plattformen.",
  strengths: [{ id: crypto.randomUUID(), title: "Teamarbeit" }],
  languages: ["Deutsch – C1", "Englisch – B2"], certifications: ["IBM Full Stack Software Developer"],
  experiences: Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Position ${index + 1}`,
    company: `Unternehmen ${index + 1}`, city: "Berlin",
    achievements: Array.from({ length: 3 }, (_, bullet) => `Messbares Ergebnis ${bullet + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im gesamten Team.`),
  })),
  education: [{ id: crypto.randomUUID(), from: "2000", to: "2004", degree: "Abschluss", institution: "Hochschule" }],
  updatedAt: now,
});
type Profile = ReturnType<typeof makeProfile>;
const render = (profile: Profile) => {
  const template = getTemplate(templateId);
  const designSettings = getTemplateDocumentDesignDefaults(templateId);
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
      <KlassischResume profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={plan}
        totalPages={resolved.pagePlan.length} accentColor={template.accent} secondaryColor={template.secondary}
        backgroundId="classic-soft-blue-waves" photoSource={null} resumeProfile="" sections={resolved.sections} />
    </ManagedResumePreview>,
  )).document as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  return { resolved, surfaces: { preview, pdf } };
};
const section = (page: Element, id: string) => page.querySelector(`[data-managed-section="${id}"]`);

describe("Klassisch: shared document flow", () => {
  it("moves certificates from the continuation back to the first page", () => {
    const base = makeProfile(8);
    const behind = render(moveManagerSection(base, templateId, "certifications", "main", 99));
    const above = render(moveManagerSection(base, templateId, "certifications", "main", 0));
    expect(behind.resolved.pagePlan.length).toBeGreaterThan(1);
    // Behind the career sections they stand on a later page (the last one that holds the flow behind the career).
    const behindPage = behind.resolved.pagePlan.findIndex((page) => page.blocks?.includes("certifications"));
    expect(behindPage).toBeGreaterThan(0);
    expect(above.resolved.pagePlan[0].blocks).toContain("certifications");
    for (const surface of ["preview", "pdf"] as const) {
      expect(section(behind.surfaces[surface][0], "certifications"), surface).toBeNull();
      expect(section(behind.surfaces[surface][behindPage], "certifications"), surface).not.toBeNull();
      expect(section(above.surfaces[surface][0], "certifications"), surface).not.toBeNull();
    }
  });

  it("keeps iconless headings and puts the application date on the final page", () => {
    const output = render(makeProfile(8));
    for (const surface of ["preview", "pdf"] as const) {
      const pages = output.surfaces[surface];
      expect(pages.length, surface).toBeGreaterThan(1);
      for (const page of pages) {
        for (const node of Array.from(page.querySelectorAll("[data-managed-section]"))) {
          expect(node.querySelectorAll(":scope > .cv-heading"), `${surface} ${node.getAttribute("data-managed-section")}`).toHaveLength(1);
          expect(node.querySelector("[data-cv-icon]"), surface).toBeNull();
        }
      }
      expect(pages[0].querySelector("[data-resume-closing]"), surface).toBeNull();
      expect(pages[pages.length - 1].querySelector("[data-resume-closing-line]")?.textContent, surface).toBe("Marburg, 26.09.2026");
    }
  });
});
