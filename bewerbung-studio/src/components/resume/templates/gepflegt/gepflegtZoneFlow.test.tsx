import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { resolveSectionPresentation, resumeSectionPresentationCss } from "../../../../shared/resumeSectionPresentation";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { GepflegtResume } from "./GepflegtResume";

const templateId = "gepflegt";
const now = "2026-09-21T12:00:00.000Z";
const makeProfile = (count: number) => profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin",
  city: "Berlin", applicationPlace: "Marburg", applicationDate: "2020-01-01",
  email: "mina@example.com", summary: "Erfahrene Entwicklerin mit Schwerpunkt auf skalierbaren Plattformen.",
  skills: ["TypeScript", "React"], languages: ["Deutsch – C1", "Englisch – B2"],
  certifications: ["IBM Full Stack Software Developer"],
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
      <GepflegtResume profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={plan}
        totalPages={resolved.pagePlan.length} accentColor={template.accent} secondaryColor={template.secondary}
        photoSource={null} resumeProfile="" sections={resolved.sections} />
    </ManagedResumePreview>,
  )).document as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  return { resolved, surfaces: { preview, pdf } };
};
const section = (page: Element, id: string) => page.querySelector(`[data-managed-section="${id}"]`);

describe("Gepflegt: shared document flow", () => {
  it("takes title typography, color, and rule from the destination column", () => {
    const main = resolveSectionPresentation(templateId, "certifications", "main")!;
    const sidebar = resolveSectionPresentation(templateId, "certifications", "sidebar")!;
    expect(main.icon).toBeNull();
    expect(sidebar.icon).toBeNull();
    expect(main.heading.fontSizePt.standard).toBe(14);
    expect(sidebar.heading.fontSizePt.standard).toBe(13);
    expect(main.heading.color).toContain("--gepflegt-heading");
    expect(sidebar.heading.color).toContain("--gepflegt-sidebar-text");
    expect(main.heading.dividerColor).toContain("--gepflegt-divider");
    // The sidebar rule is a tint of the sidebar text colour, so a changed sidebar palette keeps a matching line.
    expect(sidebar.heading.dividerColor).toContain("--gepflegt-sidebar-text");
    expect(resumeSectionPresentationCss).toContain('[data-cv-zone="sidebar"]>.cv-heading');
  });

  it("moves certificates between the main column and the first-page sidebar", () => {
    const base = makeProfile(8);
    const behind = render(moveManagerSection(base, templateId, "certifications", "main", 99));
    const sidebar = render(moveManagerSection(base, templateId, "certifications", "sidebar", 0));
    const ahead = render(moveManagerSection(base, templateId, "certifications", "main", 0));
    expect(behind.resolved.pagePlan.length).toBeGreaterThan(1);
    expect(sidebar.resolved.pagePlan[0].blocks).toContain("certifications");
    expect(ahead.resolved.pagePlan[0].blocks).toContain("certifications");
    for (const surface of ["preview", "pdf"] as const) {
      expect(section(behind.surfaces[surface][0], "certifications"), surface).toBeNull();
      const laterCertificate = behind.surfaces[surface].slice(1).map(page => section(page, "certifications")).find(Boolean);
      expect(laterCertificate?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(section(sidebar.surfaces[surface][0], "certifications")?.closest("aside"), surface).not.toBeNull();
      expect(section(sidebar.surfaces[surface][0], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("sidebar");
      expect(section(ahead.surfaces[surface][0], "certifications")?.closest("main"), surface).not.toBeNull();
      expect(section(ahead.surfaces[surface][0], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
    }
  });

  it("uses each column's iconless heading and the application date on the final page", () => {
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
      expect(section(pages[0], "languages")?.querySelector("[role='img'],.gepflegt-pdf-dots"), surface).not.toBeNull();
      expect(pages[0].querySelector("[data-resume-closing]"), surface).toBeNull();
      expect(pages[pages.length - 1].querySelector("[data-resume-closing-line]")?.textContent, surface).toBe("Marburg, 26.09.2026");
    }
  });
});
