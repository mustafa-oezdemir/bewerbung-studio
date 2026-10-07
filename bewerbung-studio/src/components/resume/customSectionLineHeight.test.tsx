import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { applicationSchema, profileSchema } from "../../shared/schema";
import { renderCv } from "./__parityHarness";

const profile = profileSchema.parse({
  id: "a3000000-0000-4000-8000-000000000001", isDefault: true, updatedAt: "2026-10-07T10:00:00.000Z",
  firstName: "Lena", lastName: "Beispiel", title: "Entwicklerin",
  specialSections: [
    { id: "a3000000-0000-4000-8000-000000000002", kind: "projects", title: "Projekte", entries: [
      { id: "a3000000-0000-4000-8000-000000000003", title: "Go Ledger", technologies: ["Go", "PostgreSQL"], description: "Atomare Buchungen." },
      { id: "a3000000-0000-4000-8000-000000000004", title: "Shipping Service", technologies: ["Go"], description: "Sendungen und Retouren." },
    ] },
    { id: "a3000000-0000-4000-8000-000000000005", kind: "interests", title: "Hobbys & Interesses", contentType: "list", entries: [
      { id: "a3000000-0000-4000-8000-000000000006", title: "Code" },
      { id: "a3000000-0000-4000-8000-000000000007", title: "Gartenarbeit" },
    ] },
  ],
});

describe.each(["modern", "klassisch"])("compact special sections in %s", (templateId) => {
  it("uses the selected line height for projects and interests on both surfaces and in pagination", () => {
    const settings = (lineHeight: number) => ({ ...getTemplateDocumentDesignDefaults(templateId),
      cvOverrides: { typography: { lineHeight } } });
    const compact = renderCv(templateId, profile, { overrides: settings(1.1) });
    const spacious = renderCv(templateId, profile, { overrides: settings(1.4) });
    for (const pages of [compact.previewPages, compact.pdfPages]) {
      for (const kind of ["projects", "interests"]) {
        const sections = pages.flatMap((page) => Array.from(page.querySelectorAll(`[data-custom-kind="${kind}"]`)));
        expect(sections, kind).toHaveLength(1);
        expect(sections[0].querySelectorAll('[data-custom-role="entry"]')).toHaveLength(2);
        expect((sections[0] as HTMLElement).style.getPropertyValue("--doc-line-height")).toBe("1.1");
      }
    }
    const totalFill = (result: typeof compact) => result.resolved.pagePlan.reduce((sum, page) => sum + (page.fill?.main ?? 0), 0);
    expect(totalFill(spacious)).toBeGreaterThan(totalFill(compact));

    const application = applicationSchema.parse({ schemaVersion: 1, id: "a3000000-0000-4000-8000-000000000008",
      folderName: "Test", company: { name: "Beispiel GmbH", city: "Berlin" }, contact: {}, job: { title: "Entwicklerin" },
      status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567",
      designSettings: settings(1.1), documents: {}, statusHistory: [],
      createdAt: "2026-10-07T10:00:00.000Z", updatedAt: "2026-10-07T10:00:00.000Z" });
    const pdfHtml = buildDocumentHtml(application, profile, "lebenslauf");
    expect(pdfHtml).toContain("--doc-line-height:1.1");
    expect(pdfHtml).toContain('[data-custom-kind="projects"]');
    expect(pdfHtml).toContain('[data-custom-kind="interests"]');
    expect(pdfHtml).toContain("row-gap:0!important");
  });
});
