import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { setResumeSectionTitle } from "../../features/resume-sections/resume-sections";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { setResumeSummaryVisible } from "../../shared/resumeSummary";
import { applicationSchema, profileSchema, type Application } from "../../shared/schema";
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

const components: Record<string, unknown> = {
  elegant: ElegantResume, einspaltig: EinspaltigResume, gepflegt: GepflegtResume, klassisch: KlassischResume, kompakt: KompaktResume,
  kreativ: KreativResume, "ivy-league": IvyLeagueResume, modern: ModernResume, pehlione_white: PehlioneResume, pehlione_white_blue: PehlioneResume,
  stilvoll: StilvollResume, tabellarisch: TabellarischResume, zeitgenoessisch: ZeitgenoessischResume, zweispaltig: ZweispaltigResume,
};

const now = new Date("2026-10-02T10:00:00.000Z").toISOString();
const profileText = "Allgemeiner Überblick mit Schwerpunkt Backend.";
const ownText = "Stellenspezifischer Überblick mit Fokus Plattform.";
const base = {
  id: "8b000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mustafa", lastName: "Özdemir", title: "Projektleiter",
  city: "Stuttgart", phone: "+49 170 1234567", email: "mustafa@example.com", summary: profileText, updatedAt: now,
};
const make = (change: Record<string, unknown> = {}) => profileSchema.parse({ ...base, ...change });

const applicationFor = (templateId: string, documents: Record<string, string> = {}, overrides: Partial<Application["designSettings"]> = {}): Application => {
  const template = getTemplate(templateId);
  return applicationSchema.parse({
    schemaVersion: 1, id: "8c000000-0000-4000-8000-000000000001", folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
    job: { title: "Kundenservice" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    designSettings: { ...getTemplateDocumentDesignDefaults(templateId), ...overrides }, documents, statusHistory: [], createdAt: now, updatedAt: now,
  });
};

/** Preview and PDF page 1 as plain text. */
const render = (templateId: string, profile: ReturnType<typeof make>, documents: Record<string, string> = {}, overrides: Partial<Application["designSettings"]> = {}) => {
  const application = applicationFor(templateId, documents, overrides);
  const settings = application.designSettings;
  const template = getTemplate(templateId);
  const resolved = resolveCvDocument({ profile, templateId, settings, resumeProfile: application.documents.resumeProfile, application });
  const component = components[templateId] as ComponentType<Record<string, unknown>>;
  const text = (node: Element | null) => {
    node?.querySelectorAll("style,script").forEach((child) => child.remove());
    return (node?.textContent ?? "").replace(/\s+/g, " ");
  };
  const preview = text(parseHTML(`<html><body>${renderToStaticMarkup(
    <ManagedResumePreview designSettings={settings} resolvedCv={resolved} profile={resolved.profile} templateId={templateId} pageNumber={1} totalPages={resolved.pagePlan.length}>
      {createElement(component, {
        profile: resolved.profile, templateId, name: "Mustafa Özdemir", atsMode: settings.resumeOutputMode === "ats", plan: resolved.pagePlan[0],
        totalPages: resolved.pagePlan.length, accentColor: template.accent, secondaryColor: template.secondary, photoSource: null,
        resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: "white",
      })}
    </ManagedResumePreview>,
  )}</body></html>`).document.querySelector("body"));
  const pdf = text(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelector(".cv-sheet"));
  return { preview, pdf };
};

const ids = Object.keys(components);
const surfaces = ["preview", "pdf"] as const;

describe.each(ids)("Kurzprofil of %s", (templateId) => {
  it("A/K/L. shows the profile text, with the default title, in the preview and in the PDF", () => {
    const result = render(templateId, make());
    for (const surface of surfaces) {
      expect(result[surface], surface).toContain(profileText);
      expect(result[surface], surface).toContain("Kurzprofil");
      expect(result[surface], surface).not.toContain("Zusammenfassung");
    }
  });

  it("B. keeps the profile text even with archived Bewerbung text", () => {
    const result = render(templateId, make(), { resumeProfile: ownText });
    for (const surface of surfaces) {
      expect(result[surface], surface).toContain(profileText);
      expect(result[surface], surface).not.toContain(ownText);
    }
  });

  it("C. shows the profile text again once the Bewerbung text is cleared", () => {
    const result = render(templateId, make(), { resumeProfile: "" });
    for (const surface of surfaces) expect(result[surface], surface).toContain(profileText);
  });

  it("F. draws no placeholder and no empty section when there is no text", () => {
    const result = render(templateId, make({ summary: "" }));
    for (const surface of surfaces) {
      expect(result[surface], surface).not.toMatch(/Kurzprofil ergänzen|im Dokumenteditor ergänzen|Zusammenfassung/);
      expect(result[surface], surface).not.toContain("Kurzprofil");
    }
  });

  it("G. draws neither text nor heading when the Kurzprofil is switched off, and keeps the text in the profile", () => {
    const hidden = setResumeSummaryVisible(make(), false);
    expect(hidden.summary).toBe(profileText);
    const result = render(templateId, hidden);
    for (const surface of surfaces) {
      expect(result[surface], surface).not.toContain(profileText);
      expect(result[surface], surface).not.toContain("Kurzprofil");
    }
    const again = render(templateId, setResumeSummaryVisible(hidden, true));
    for (const surface of surfaces) expect(again[surface], surface).toContain(profileText);
  });

  it("J. prints a chosen title instead of the default", () => {
    const result = render(templateId, setResumeSectionTitle(make(), "summary", "Über mich"));
    for (const surface of surfaces) {
      expect(result[surface], surface).toContain("Über mich");
      expect(result[surface], surface).toContain(profileText);
      expect(result[surface], surface).not.toContain("Kurzprofil");
    }
  });

  it("keeps a title an older profile stored as its default as the new default", () => {
    const result = render(templateId, make({ resumeSectionTitles: { summary: "Zusammenfassung" } }));
    for (const surface of surfaces) {
      expect(result[surface], surface).toContain("Kurzprofil");
      expect(result[surface], surface).not.toContain("Zusammenfassung");
    }
  });

  it("L. shows the same Kurzprofil text in the preview and in the PDF, also in the plain (ATS) layout", () => {
    for (const documents of [{}, { resumeProfile: ownText }] as Array<Record<string, string>>) {
      const visual = render(templateId, make(), documents);
      const ats = render(templateId, make(), documents, { resumeOutputMode: "ats" });
      const token = profileText;
      for (const result of [visual, ats]) for (const surface of surfaces) expect(result[surface], surface).toContain(token);
    }
  });

  it("16. never takes the Deckblatt text for the Kurzprofil", () => {
    const result = render(templateId, make({ summary: "" }), { deckblattStatement: "Aussage nur für das Deckblatt" });
    for (const surface of surfaces) expect(result[surface], surface).not.toContain("Aussage nur für das Deckblatt");
    const withProfile = render(templateId, make(), { deckblattStatement: "Aussage nur für das Deckblatt" });
    for (const surface of surfaces) expect(withProfile[surface], surface).not.toContain("Aussage nur für das Deckblatt");
  });
});

describe("the Kurzprofil stays apart from the Deckblatt and the Anschreiben", () => {
  const html = (target: "deckblatt" | "anschreiben", documents: Record<string, string> = {}) =>
    buildDocumentHtml(applicationFor("klassisch", documents), make({ street: "Musterstraße 1", postalCode: "70173" }), target);

  it("does not put the profile's Kurzprofil on the Deckblatt, whatever it is called there", () => {
    expect(html("deckblatt")).not.toContain(profileText);
    expect(html("deckblatt", { deckblattStatement: "Nur für das Deckblatt." })).toContain("Nur für das Deckblatt.");
    expect(html("deckblatt", { resumeProfile: ownText })).not.toContain(ownText);
  });

  it("does not use the profile's Kurzprofil as the main text of the Anschreiben", () => {
    expect(html("anschreiben")).not.toContain(profileText);
    expect(html("anschreiben", { coverMainBody: "Mein eigener Hauptteil." })).toContain("Mein eigener Hauptteil.");
    expect(html("anschreiben", { resumeProfile: ownText })).not.toContain(ownText);
  });

  it("changes neither of them when the Kurzprofil changes", () => {
    const before = html("deckblatt", { deckblattStatement: "Nur für das Deckblatt." });
    const changed = buildDocumentHtml(applicationFor("klassisch", { deckblattStatement: "Nur für das Deckblatt." }), make({ summary: "Ganz anderes Kurzprofil.", street: "Musterstraße 1", postalCode: "70173" }), "deckblatt");
    expect(changed).toBe(before);
  });
});
