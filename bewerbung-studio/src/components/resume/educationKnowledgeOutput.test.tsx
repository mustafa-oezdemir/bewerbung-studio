import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { applicationSchema, profileSchema } from "../../shared/schema";
import { getTemplate } from "../../shared/templates";
import { ManagedResumePreview } from "./ManagedResumePreview";
import { ElegantResume } from "./templates/elegant";
import { EinspaltigResume } from "./templates/einspaltig";
import { GepflegtResume } from "./templates/gepflegt";
import { KlassischResume } from "./templates/klassisch";
import { KompaktResume } from "./templates/kompakt";
import { KreativResume } from "./templates/kreativ";
import { IvyLeagueResume } from "./templates/ivy-league";
import { ModernResume } from "./templates/modern";
import { PehlioneResume } from "./templates/pehlione";
import { StilvollResume } from "./templates/stilvoll";
import { TabellarischResume } from "./templates/tabellarisch";
import { ZeitgenoessischResume } from "./templates/zeitgenoessisch";
import { ZweispaltigResume } from "./templates/zweispaltig";

const components: Record<string, ComponentType<Record<string, unknown>>> = {
  elegant: ElegantResume as ComponentType<Record<string, unknown>>,
  einspaltig: EinspaltigResume as ComponentType<Record<string, unknown>>,
  gepflegt: GepflegtResume as unknown as ComponentType<Record<string, unknown>>,
  klassisch: KlassischResume as ComponentType<Record<string, unknown>>,
  kompakt: KompaktResume as ComponentType<Record<string, unknown>>,
  kreativ: KreativResume as ComponentType<Record<string, unknown>>,
  "ivy-league": IvyLeagueResume as ComponentType<Record<string, unknown>>,
  modern: ModernResume as unknown as ComponentType<Record<string, unknown>>,
  pehlione_white: PehlioneResume as ComponentType<Record<string, unknown>>,
  pehlione_white_blue: PehlioneResume as ComponentType<Record<string, unknown>>,
  stilvoll: StilvollResume as ComponentType<Record<string, unknown>>,
  tabellarisch: TabellarischResume as unknown as ComponentType<Record<string, unknown>>,
  zeitgenoessisch: ZeitgenoessischResume as ComponentType<Record<string, unknown>>,
  zweispaltig: ZweispaltigResume as ComponentType<Record<string, unknown>>,
};
const now = "2026-10-02T10:00:00.000Z";
const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
  applicationPlace: "Marburg", resumeClosing: { showPlace: true, showDate: true, showSignature: false, dateMode: "application" },
  specialSections: [{ id: crypto.randomUUID(), kind: "interests", title: "Interessen und Hobbys",
    isVisible: true, contentType: "list", entries: [{ id: crypto.randomUUID(), title: "Fotografie",
      description: "Architektur und Landschaft", bullets: [] }] }],
  education: [{ id: crypto.randomUUID(), from: "08/2018", to: "07/2022",
    degree: "Bachelor of Science Informatik", institution: "Universität Stuttgart", city: "Stuttgart", country: "Deutschland",
    type: "Studium", fieldOfStudy: "Software Engineering", grade: "1,8", status: "Abgeschlossen", description: "Abschlussarbeit: Sichere APIs",
  }],
  knowledgeSection: { title: "Besondere Kenntnisse", isVisible: true, categories: [{
    id: crypto.randomUUID(), title: "IT-Kenntnisse", type: "it", displayMode: "comma-separated",
    showLevels: true, showYearsOfExperience: true, isVisible: true, sortOrder: 0, subcategories: [],
    items: [{ id: crypto.randomUUID(), name: "Java", level: "advanced", yearsOfExperience: 4,
      lastUsedYear: 2025, description: "Spring Boot und REST APIs", isVisible: true, sortOrder: 0 }],
  }] },
  languages: ["Englisch – B2", "Deutsch – Muttersprache"],
  certifications: ["03/2026 · Professional Scrum Master I · Scrum.org"],
});

const content = (html: string) => {
  const { document } = parseHTML(html);
  document.querySelectorAll("style,script").forEach((node) => node.remove());
  return (document.body?.textContent ?? "").replace(/\s+/g, " ");
};

const render = (templateId: string, atsMode = false) => {
  const template = getTemplate(templateId);
  const settings = { ...getTemplateDocumentDesignDefaults(templateId), resumeOutputMode: atsMode ? "ats" as const : "visual" as const };
  const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
    company: { name: "Test", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf",
    templateId, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings,
    documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
  const resolved = resolveCvDocument({ profile, templateId, settings, application });
  const Component = components[templateId];
  const preview = resolved.pagePlan.map((plan) => renderToStaticMarkup(
    <ManagedResumePreview designSettings={settings} resolvedCv={resolved} profile={resolved.profile} templateId={templateId}
      pageNumber={plan.pageNumber} totalPages={resolved.pagePlan.length}>
      {createElement(Component, { profile: resolved.profile, templateId, name: "Mina Kaya", atsMode,
        plan, totalPages: resolved.pagePlan.length, accentColor: template.accent, secondaryColor: template.secondary,
        photoSource: null, resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: "white", closingDate: resolved.closingDate })}
    </ManagedResumePreview>,
  )).join("");
  return { preview: content(`<html><body>${preview}</body></html>`), pdf: content(buildDocumentHtml(application, profile, "lebenslauf")) };
};

describe.each(Object.keys(components))("education and knowledge output in %s", (templateId) => {
  it("keeps entered education and skill details in preview and PDF", () => {
    const result = render(templateId);
    for (const surface of ["preview", "pdf"] as const) {
      expect(result[surface]).toContain("Bachelor of Science Informatik");
      expect(result[surface]).toContain("Universität Stuttgart");
      expect(result[surface]).toContain("Deutschland");
      expect(result[surface]).toContain("Software Engineering");
      expect(result[surface]).toContain("1,8");
      expect(result[surface]).toContain("Abschlussarbeit: Sichere APIs");
      expect(result[surface]).toContain("Java");
      expect(result[surface]).toContain("Fortgeschrittene Kenntnisse");
      expect(result[surface]).toContain("4 Jahre");
      expect(result[surface]).toContain("Spring Boot und REST APIs");
    }
  });
  it("keeps language levels readable in ATS preview and PDF", () => {
    const result = render(templateId, true);
    for (const surface of ["preview", "pdf"] as const) {
      expect(result[surface]).toContain("Englisch");
      expect(result[surface]).toContain("B2");
      expect(result[surface]).toContain("Muttersprache");
    }
  });
  it("keeps interests and the application closing in preview and PDF", () => {
    const result = render(templateId);
    for (const surface of ["preview", "pdf"] as const) {
      expect(result[surface]).toContain("Fotografie");
      expect(result[surface]).toContain("Architektur und Landschaft");
      expect(result[surface]).toContain("Marburg");
      expect(result[surface]).toContain("02.10.2026");
      expect(result[surface]).not.toContain("Ort, Datum und Unterschrift");
    }
  });
});
