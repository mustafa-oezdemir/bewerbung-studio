import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { buildDocumentHtml } from "../../electron/documents";
import { applicationSchema, profileSchema } from "./schema";
import { defaultDocumentDesign } from "./documentDesign";
import { resolveCvDocument } from "./resolveCvDocument";
import { zoneFlowTemplates } from "./resumeSectionPresentation";
import { resolveResumePresentation } from "./resumePresentation";

const templateIds = [
  "elegant", "einspaltig", "gepflegt", "klassisch", "kompakt", "kreativ",
  "ivy-league", "modern", "pehlione_white", "pehlione_white_blue",
  "stilvoll", "tabellarisch", "zeitgenoessisch", "zweispaltig",
];

const makeProfile = () => profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya",
  summary: "Profil-Zusammenfassung", updatedAt: new Date().toISOString(),
  experiences: Array.from({ length: 9 }, (_, index) => ({
    id: crypto.randomUUID(), from: "2020", to: "2024", role: `Rolle ${index}`,
    company: "Firma", achievements: Array.from({ length: 7 }, () => "Konkrete Leistung und Ergebnis"),
  })),
  education: [{ id: crypto.randomUUID(), from: "2017", to: "2020", degree: "B.Sc.", institution: "Hochschule" }],
});

describe("shared CV document resolution", () => {
  it("filters project catalogue per Bewerbung before pagination and PDF rendering", () => {
    const projects = ["Alpha", "Beta", "Gamma"].map((title) => ({ id: crypto.randomUUID(), title,
      url: `https://example.com/${title.toLowerCase()}`, technologies: ["Go"], description: `${title} description` }));
    const sectionId = crypto.randomUUID();
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya",
      updatedAt: new Date().toISOString(), specialSections: [{ id: sectionId, kind: "projects", title: "Projekte", entries: projects }] });
    const source = JSON.stringify(profile);
    const make = (selection?: string[]) => ({ ...defaultDocumentDesign,
      ...(selection !== undefined ? { resumePresentation: { selectedProjectEntryIds: selection } } : {}) });
    const legacy = resolveCvDocument({ profile, templateId: "modern", settings: make() });
    expect(legacy.profile?.specialSections[0].entries).toHaveLength(3);
    const empty = resolveCvDocument({ profile, templateId: "modern", settings: make([]) });
    expect(empty.profile?.specialSections[0].entries).toHaveLength(0);
    expect(empty.managerSections.find((entry) => entry.id === `special:${sectionId}`)?.visible).toBe(false);
    expect(empty.pagePlan.flatMap((page) => page.items).some((item) => item.id === `special:${sectionId}`)).toBe(false);
    const chosen = resolveCvDocument({ profile, templateId: "modern", settings: make([projects[2].id, "deleted", projects[0].id]) });
    expect(chosen.profile?.specialSections[0].entries.map((entry) => entry.title)).toEqual(["Alpha", "Gamma"]);
    expect(profile.specialSections[0].entries).toHaveLength(3);
    expect(JSON.stringify(profile)).toBe(source);
    const app = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Beispiel",
      company: { name: "Beispiel GmbH", city: "Berlin" }, contact: {}, job: { title: "Go" }, status: "Entwurf",
      templateId: "modern", accentColor: "#123456", documents: {}, designSettings: make([projects[0].id]),
      statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const html = buildDocumentHtml(app, profile, "lebenslauf");
    expect(html).toContain("Alpha description");
    expect(html).not.toContain("Beta description");
    expect(html).not.toContain("Gamma description");
    expect(resolveCvDocument({ profile, templateId: "modern", settings: make([projects[1].id]) }).profile?.specialSections[0].entries[0].title).toBe("Beta");
  });
  it.each(templateIds)("resolves the same page and layout decisions for %s before and after preview projection", (templateId) => {
    const profile = makeProfile();
    const settings = {
      ...defaultDocumentDesign,
      resumePresentation: {
        layoutMode: "two-column" as const,
        sidebarSide: "left" as const,
        sidebarWidthPercent: 35 as const,
        sections: { education: { visible: false } },
      },
    };
    const input = { templateId, settings, resumeProfile: "Kurzprofil" };
    const pdf = resolveCvDocument({ ...input, profile });
    const preview = resolveCvDocument({
      ...input,
      profile: resolveResumePresentation(profile, templateId, settings.resumePresentation),
      presentationAlreadyApplied: true,
    });
    expect(preview.pagePlan).toEqual(pdf.pagePlan);
    expect(preview.managerSections).toEqual(pdf.managerSections);
    expect(preview.knowledgeGroups).toEqual(pdf.knowledgeGroups);
    expect(preview.design).toEqual(pdf.design);
    expect(preview.layout).toEqual(pdf.layout);
    expect(pdf.pagePlan.flatMap((page) => page.items).some((item) => item.kind === "education")).toBe(true);
    expect(pdf.pagePlan.length).toBeGreaterThanOrEqual(2);
  });

  it("resolves the same Kurzprofil for every template, preview and PDF alike", () => {
    const profile = makeProfile();
    for (const templateId of templateIds) {
      expect(resolveCvDocument({ profile, templateId }).summary, templateId).toBe("Profil-Zusammenfassung");
      expect(resolveCvDocument({ profile, templateId, resumeProfile: "  Bewerbungstext  " }).summary, templateId).toBe("Profil-Zusammenfassung");
    }
  });

  it.each(templateIds)("prints the resolved page count for %s", (templateId) => {
    const profile = makeProfile();
    const now = new Date().toISOString();
    const application = applicationSchema.parse({
      schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {},
      job: { title: "Entwicklung" }, status: "Entwurf", templateId,
      accentColor: "#123456",
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    const resolved = resolveCvDocument({
      profile, templateId, settings: application.designSettings,
      resumeProfile: application.documents.resumeProfile,
      application,
    });
    const { document } = parseHTML(buildDocumentHtml(application, profile, "lebenslauf"));
    expect(document.querySelectorAll(".cv-sheet")).toHaveLength(resolved.pagePlan.length);
  });

  it("takes the closing date from the application for every template", () => {
    const profile = makeProfile();
    const application = { sentAt: "2026-09-26T10:00:00.000Z", createdAt: "2026-09-01T09:00:00.000Z" };
    for (const templateId of templateIds) {
      expect(resolveCvDocument({ profile, templateId, application }).closingDate, templateId).toBe("26.09.2026");
      expect(resolveCvDocument({ profile, templateId }).closingDate, templateId).toBeUndefined();
    }
  });

  it("prints an October application date in German format", () => {
    const application = { sentAt: "2026-10-01T10:00:00.000Z", createdAt: "2026-09-30T09:00:00.000Z" };
    expect(resolveCvDocument({ profile: makeProfile(), templateId: "pehlione_white", application }).closingDate).toBe("01.10.2026");
  });
});
