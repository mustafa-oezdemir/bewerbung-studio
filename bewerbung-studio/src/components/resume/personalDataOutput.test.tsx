import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { resumePersonalFieldKeys } from "../../features/resume-sections/resume-section-system";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { applicationSchema, profileSchema, type ApplicantProfile } from "../../shared/schema";
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

const now = new Date("2026-10-01T10:00:00.000Z").toISOString();
const allOn = Object.fromEntries(resumePersonalFieldKeys.map((key) => [key, true]));
const source = {
  id: crypto.randomUUID(), isDefault: true, firstName: "Mustafa", lastName: "Özdemir", title: "Projektleiter",
  street: "Musterstraße 10", postalCode: "12345", city: "Stuttgart", country: "Deutschland",
  phone: "0170 1234567", email: "mustafa@example.com", linkedin: "linkedin.com/in/test", github: "github.com/test", portfolio: "example.com",
  birthDate: "25.11.1990", birthPlace: "Gerze", nationality: "deutsch-türkisch", familyStatus: "Verheiratet", children: "Anna und Ben",
  summary: "Erfahrener Projektleiter.", updatedAt: now,
};
const make = (change: Record<string, unknown> = {}) => profileSchema.parse({ ...source, ...change });

/** Preview and PDF page 1 of one template as plain text. */
const render = (templateId: string, profile: ApplicantProfile, ats = false) => {
  const template = getTemplate(templateId);
  const settings = { ...getTemplateDocumentDesignDefaults(templateId), ...(ats ? { resumeOutputMode: "ats" as const } : {}) };
  const resolved = resolveCvDocument({ profile, templateId, settings, resumeProfile: "" });
  const application = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
    job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
  });
  const text = (node: Element | null) => {
    node?.querySelectorAll("style,script").forEach((child) => child.remove());
    return (node?.textContent ?? "").replace(/\s+/g, " ");
  };
  const pdf = text(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelector(".cv-sheet"));
  const plan = resolved.pagePlan[0];
  const component = components[templateId] as ComponentType<Record<string, unknown>>;
  const preview = text(parseHTML(`<html><body>${renderToStaticMarkup(
    <ManagedResumePreview designSettings={settings} resolvedCv={resolved} profile={resolved.profile} templateId={templateId} pageNumber={1} totalPages={resolved.pagePlan.length}>
      {createElement(component, {
        profile: resolved.profile, templateId, name: "Mustafa Özdemir", atsMode: ats, plan, totalPages: resolved.pagePlan.length,
        accentColor: template.accent, secondaryColor: template.secondary, photoSource: null,
        resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: "white",
      })}
    </ManagedResumePreview>,
  )}</body></html>`).document.querySelector("body"));
  return { pdf, preview };
};

const tokens = {
  phone: "0170 1234567", email: "mustafa@example.com", linkedin: "linkedin.com/in/test", address: "Stuttgart",
  birthDate: "25.11.1990", birthPlace: "Gerze", nationality: "deutsch-türkisch", familyStatus: "Verheiratet", children: "Anna und Ben",
} as const;
const present = (text: string) => Object.entries(tokens).filter(([, token]) => text.includes(token)).map(([key]) => key);

describe.each(Object.keys(components))("personal data of %s", (templateId) => {
  const everything = render(templateId, make({ resumePersonalFieldVisibility: allOn }));
  const legacy = render(templateId, make());

  it("shows every personal field that is switched on, in the preview and in the PDF", () => {
    for (const surface of ["preview", "pdf"] as const)
      expect(present(everything[surface]), surface).toEqual(Object.keys(tokens));
  });

  it("shows the same personal data in the preview and in the PDF", () => {
    expect(present(everything.preview)).toEqual(present(everything.pdf));
    expect(present(legacy.preview)).toEqual(present(legacy.pdf));
  });

  it("does not show Staatsangehörigkeit, Familienstand and Kinder of an older profile", () => {
    for (const surface of ["preview", "pdf"] as const) {
      expect(present(legacy[surface]), surface).toEqual(expect.arrayContaining(["phone", "email", "linkedin", "address"]));
      for (const hidden of ["birthDate", "birthPlace", "nationality", "familyStatus", "children"])
        expect(present(legacy[surface]), `${surface} ${hidden}`).not.toContain(hidden);
    }
  });

  it.each(Object.keys(tokens))("hides %s with its own switch and keeps the others", (key) => {
    const visibilityKey = key === "linkedin" ? "linkedin" : key;
    const result = render(templateId, make({ resumePersonalFieldVisibility: { ...allOn, [visibilityKey]: false } }));
    for (const surface of ["preview", "pdf"] as const)
      expect(present(result[surface]), `${surface} without ${key}`).toEqual(Object.keys(tokens).filter((item) => item !== key));
  });

  it("draws no label for an empty value", () => {
    const empty = render(templateId, make({
      birthDate: "", birthPlace: "", nationality: "", familyStatus: "", children: "", resumePersonalFieldVisibility: allOn,
    }));
    for (const surface of ["preview", "pdf"] as const)
      expect(empty[surface], surface).not.toMatch(/Geb\.|Geboren|Staatsangehörigkeit|Familienstand|Kinder/);
  });
});

describe.each(Object.keys(components))("personal data of %s in the plain (ATS) layout", (templateId) => {
  const everything = render(templateId, make({ resumePersonalFieldVisibility: allOn }), true);
  const legacy = render(templateId, make(), true);

  it("shows every switched-on field, the same in the preview and in the PDF", () => {
    for (const surface of ["preview", "pdf"] as const) expect(present(everything[surface]), surface).toEqual(Object.keys(tokens));
    expect(present(everything.preview)).toEqual(present(everything.pdf));
  });

  it("keeps the voluntary fields of an older profile out", () => {
    for (const surface of ["preview", "pdf"] as const)
      for (const hidden of ["birthDate", "birthPlace", "nationality", "familyStatus", "children"])
        expect(present(legacy[surface]), `${surface} ${hidden}`).not.toContain(hidden);
  });
});

it.each(["kreativ", "tabellarisch"])("%s keeps the address while Land follows the central switch in preview and PDF", (templateId) => {
  const shown = render(templateId, make({ resumePersonalFieldVisibility: allOn }));
  const hidden = render(templateId, make({ resumePersonalFieldVisibility: { ...allOn, country: false } }));
  const legacy = render(templateId, make());
  for (const surface of ["preview", "pdf"] as const) {
    expect(shown[surface]).toContain("Deutschland");
    expect(hidden[surface]).not.toContain("Deutschland");
    expect(legacy[surface]).not.toContain("Deutschland");
    expect(hidden[surface]).toContain("Stuttgart");
  }
});

describe("section title of the personal data", () => {
  const renamed = make({ resumeSemanticSections: [{ semanticType: "personalData", customTitle: "Angaben zur Person", visible: true, enabled: true, order: 1 }] });

  it.each(["einspaltig", "klassisch", "kompakt", "stilvoll", "modern"])("%s prints the chosen title above the plain personal data", (templateId) => {
    const ats = render(templateId, renamed, true);
    for (const surface of ["preview", "pdf"] as const) {
      expect(ats[surface], surface).toContain("Angaben zur Person");
      expect(ats[surface], surface).not.toContain("Persönliche Daten");
    }
    const plain = render(templateId, make(), true);
    for (const surface of ["preview", "pdf"] as const) expect(plain[surface], surface).toContain("Persönliche Daten");
  });
});

describe("no template formats the personal data itself", () => {
  const templates = ["elegant/ElegantHeader", "einspaltig/EinfachHeader", "gepflegt/GepflegtHeader", "ivy-league/IvyLeagueHeader", "klassisch/KlassischHeader",
    "kompakt/KompaktSections", "kreativ/KreativHeader", "modern/ModernContactSection", "stilvoll/StilvollHeader", "tabellarisch/TabellarischHeader",
    "zeitgenoessisch/ZeitgenoessischHeader", "zeitgenoessisch/ZeitgenoessischContactSection", "zweispaltig/ZweispaltigHeader"].map((file) => `src/components/resume/templates/${file}.tsx`);
  const files = [...templates, "electron/documents.ts", "src/shared/pehlioneContacts.ts"];

  it.each(files)("%s uses the central address, birth and phone helpers", (file) => {
    const code = readFileSync(resolve(process.cwd(), file), "utf8");
    // The old per-template birth text and address joins.
    expect(code).not.toMatch(/Geb\. \$\{/);
    expect(code).not.toMatch(/\[profile\??\.(?:postalCode, )?profile\??\.city, profile\??\.country\]/);
    expect(code).not.toMatch(/\[profile\??\.birthDate, profile\??\.birthPlace\]/);
    expect(code).not.toMatch(/profile\??\.birthDate \|\| profile\??\.birthPlace/);
    expect(code).not.toMatch(/tel:\$\{profile\??\.phone\.replace/);
  });

  const models = ["elegant/elegant.model", "ivy-league/ivy-league.model", "kreativ/kreativ.model", "tabellarisch/tabellarisch.model",
    "zeitgenoessisch/zeitgenoessisch.model", "zweispaltig/zweispaltig.model", "resume-template-data"].map((file) => `src/components/resume/templates/${file}.ts`);
  it.each(models)("keeps one URL normalisation in %s", (file) => {
    expect(readFileSync(resolve(process.cwd(), file), "utf8")).not.toMatch(/\^\[a-z\]\[a-z\d\+\.-\]\*:/);
  });
});
