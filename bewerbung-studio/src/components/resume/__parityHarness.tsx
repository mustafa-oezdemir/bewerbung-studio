import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { buildDocumentHtml } from "../../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { applicationSchema, type ApplicantProfile, type Application } from "../../shared/schema";
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

/** The 14 active Lebenslauf templates and their React components (test harness: preview vs. PDF). */
export const resumeComponents: Record<string, unknown> = {
  elegant: ElegantResume, einspaltig: EinspaltigResume, gepflegt: GepflegtResume, klassisch: KlassischResume, kompakt: KompaktResume,
  kreativ: KreativResume, "ivy-league": IvyLeagueResume, modern: ModernResume, pehlione_white: PehlioneResume, pehlione_white_blue: PehlioneResume,
  stilvoll: StilvollResume, tabellarisch: TabellarischResume, zeitgenoessisch: ZeitgenoessischResume, zweispaltig: ZweispaltigResume,
};
export const resumeTemplateIds = Object.keys(resumeComponents);

const now = "2026-10-02T10:00:00.000Z";

export const harnessApplication = (templateId: string, overrides: Partial<Application["designSettings"]> = {}, documents: Record<string, string> = {}): Application => {
  const template = getTemplate(templateId);
  return applicationSchema.parse({
    schemaVersion: 1, id: "8f200000-0000-4000-8000-000000000001", folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
    job: { title: "Kundenservice" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    applicationDate: "2026-10-02",
    designSettings: { ...getTemplateDocumentDesignDefaults(templateId), ...overrides }, documents, statusHistory: [], createdAt: now, updatedAt: now,
  });
};

const clean = (node: Element | null) => {
  node?.querySelectorAll("style,script").forEach((child) => child.remove());
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
};

const semantic = (page: Element) => ({
  elements: Array.from(page.querySelectorAll("[data-element-id]")).map((node) => node.getAttribute("data-element-id")!),
  sections: Array.from(page.querySelectorAll("[data-managed-section]")).map((node) => node.getAttribute("data-managed-section")!),
});

/** Every page of the Lebenslauf as the preview and as the PDF draw it, from one `resolveCvDocument`. */
export const renderCv = (
  templateId: string,
  profile: ApplicantProfile,
  options: { ats?: boolean; overrides?: Partial<Application["designSettings"]>; documents?: Record<string, string> } = {},
) => {
  const application = harnessApplication(templateId, { ...options.overrides, resumeOutputMode: options.ats ? "ats" : "visual" }, options.documents);
  const settings = application.designSettings;
  const template = getTemplate(templateId);
  const resolved = resolveCvDocument({ profile, templateId, settings, resumeProfile: application.documents.resumeProfile, application });
  const component = resumeComponents[templateId] as ComponentType<Record<string, unknown>>;
  const previewPages = resolved.pagePlan.map((plan, index) =>
    parseHTML(`<html><body>${renderToStaticMarkup(
      <ManagedResumePreview designSettings={settings} resolvedCv={resolved} profile={resolved.profile} templateId={templateId} pageNumber={index + 1} totalPages={resolved.pagePlan.length}>
        {createElement(component, {
          profile: resolved.profile, templateId, name: `${profile.firstName} ${profile.lastName}`, atsMode: settings.resumeOutputMode === "ats", plan,
          totalPages: resolved.pagePlan.length, accentColor: template.accent, secondaryColor: template.secondary, photoSource: null,
          resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: "white", closingDate: resolved.closingDate,
        })}
      </ManagedResumePreview>,
    )}</body></html>`).document.body as unknown as Element);
  const pdfPages = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet")) as unknown as Element[];
  const sem = (pages: Element[]) => {
    const all = pages.map(semantic);
    return { elements: all.flatMap((page) => page.elements), sections: all.flatMap((page) => page.sections) };
  };
  return {
    resolved,
    previewPages,
    pdfPages,
    preview: previewPages.map(clean).join(" "),
    pdf: pdfPages.map(clean).join(" "),
    previewSemantic: sem(previewPages),
    pdfSemantic: sem(pdfPages),
  };
};
