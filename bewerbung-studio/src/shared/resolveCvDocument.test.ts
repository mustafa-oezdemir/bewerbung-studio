import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { buildDocumentHtml } from "../../electron/documents";
import { applicationSchema, profileSchema } from "./schema";
import { defaultDocumentDesign } from "./documentDesign";
import { resolveCvDocument } from "./resolveCvDocument";
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
    const input = { templateId, settings, resumeProfile: "Kurzprofil", jobTitle: "Entwicklung" };
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
    expect(pdf.pagePlan.flatMap((page) => page.items).every((item) => item.kind !== "education")).toBe(true);
    expect(pdf.pagePlan).toHaveLength(2);
  });

  it("uses the same Pehlione summary fallback for preview and PDF", () => {
    const profile = makeProfile();
    const resolved = resolveCvDocument({ profile, templateId: "pehlione_white", jobTitle: "Entwicklung" });
    expect(resolved.paginationSummary).toBe("Profil-Zusammenfassung");
    const jobSpecific = resolveCvDocument({
      profile, templateId: "pehlione_white", jobTitle: "Kundenservice",
      deckblattStatement: "Passende Deckblatt-Aussage",
    });
    expect(jobSpecific.paginationSummary).toBe("Passende Deckblatt-Aussage");
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
      deckblattStatement: application.documents.deckblattStatement,
      jobTitle: application.job.title,
    });
    const { document } = parseHTML(buildDocumentHtml(application, profile, "lebenslauf"));
    expect(document.querySelectorAll(".cv-sheet")).toHaveLength(resolved.pagePlan.length);
  });
});
