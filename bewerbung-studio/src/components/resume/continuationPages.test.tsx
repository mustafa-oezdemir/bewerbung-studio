import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../shared/schema";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { getTemplate } from "../../shared/templates";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { buildDocumentHtml } from "../../../electron/documents";
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

const components = {
  "elegant": ElegantResume,
  "einspaltig": EinspaltigResume,
  "gepflegt": GepflegtResume,
  "klassisch": KlassischResume,
  "kompakt": KompaktResume,
  "kreativ": KreativResume,
  "ivy-league": IvyLeagueResume,
  "modern": ModernResume,
  "pehlione_white": PehlioneResume,
  "pehlione_white_blue": PehlioneResume,
  "stilvoll": StilvollResume,
  "tabellarisch": TabellarischResume,
  "zeitgenoessisch": ZeitgenoessischResume,
  "zweispaltig": ZweispaltigResume,
};

const now = new Date("2026-07-19T10:00:00.000Z").toISOString();
const headline = "Prozessoptimierer Unikat";
const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: headline, city: "Berlin", email: "mina@example.com", phone: "+49 30 123456",
  summary: "Erfahrene Fachkraft mit Schwerpunkt auf verlässlichen Abläufen und klarer Zusammenarbeit im Team.",
  skills: ["TypeScript", "React", "Node.js", "SQL", "Prozessanalyse"], languages: ["Deutsch – C1", "Englisch – B2"],
  signaturePath: "data:image/png;base64,iVBORw0KGgo=",
  strengths: ["Analytisches Denken", "Strukturierte Arbeitsweise", "Schnelle Auffassungsgabe"].map((title) => ({ id: crypto.randomUUID(), title })),
  experiences: Array.from({ length: 6 }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Rolle ${index + 1}`, company: `Firma ${index + 1}`, city: "Berlin",
    achievements: Array.from({ length: 6 }, (_, item) => `Ergebnis ${item + 1} mit messbarer Verbesserung der Abläufe in der Abteilung ${index + 1}.`),
  })),
  education: Array.from({ length: 2 }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2000 + index}`, to: `${2004 + index}`, degree: `Abschluss ${index + 1}`, institution: `Hochschule ${index + 1}`,
  })),
  updatedAt: now,
});

const render = (templateId: string) => {
  const template = getTemplate(templateId);
  const settings = getTemplateDocumentDesignDefaults(templateId);
  const resolved = resolveCvDocument({ profile, templateId, settings, resumeProfile: "" });
  const application = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
    job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
  });
  const pdfPages = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  const component = components[templateId as keyof typeof components] as unknown as ComponentType<Record<string, unknown>>;
  const previewPages = resolved.pagePlan.map((plan) => parseHTML(`<html><body>${renderToStaticMarkup(
    <ManagedResumePreview
      designSettings={settings}
      resolvedCv={resolved}
      profile={resolved.profile}
      templateId={templateId}
      pageNumber={plan.pageNumber}
      totalPages={resolved.pagePlan.length}>
      {createElement(component, {
        profile: resolved.profile, templateId, name: "Mina Kaya", atsMode: false, plan, totalPages: resolved.pagePlan.length,
        accentColor: template.accent, secondaryColor: template.secondary, photoSource: null,
        resumeProfile: resolved.paginationSummary, sections: resolved.sections, backgroundId: "white",
      })}
    </ManagedResumePreview>,
  )}</body></html>`).document.body);
  return { resolved, pdfPages, previewPages };
};

const sectionIds = (page: Element) => Array.from(page.querySelectorAll("[data-managed-section]")).map((node) => node.getAttribute("data-managed-section")).sort();
const text = (page: Element) => (page.textContent ?? "").replace(/\s+/g, " ");

describe.each(Object.keys(components))("continuation page of %s", (templateId) => {
  const { resolved, pdfPages, previewPages } = render(templateId);

  it("plans the same two pages for preview and PDF", () => {
    expect(resolved.pagePlan).toHaveLength(2);
    expect(pdfPages).toHaveLength(2);
    expect(previewPages).toHaveLength(2);
  });

  it("shows the same sections on every page in preview and PDF", () => {
    for (const index of [0, 1]) expect({ page: index + 1, ids: sectionIds(previewPages[index]) }).toEqual({ page: index + 1, ids: sectionIds(pdfPages[index]) });
  });

  it.each(["preview", "pdf"] as const)("repeats the first-page header without an idle sidebar in the %s", (surface) => {
    const first = surface === "pdf" ? pdfPages[0] : previewPages[0];
    const second = surface === "pdf" ? pdfPages[1] : previewPages[1];
    expect(second.querySelector("aside")).toBeNull();
    const firstHeader = first.querySelector("header");
    const secondHeader = second.querySelector("header");
    expect(secondHeader?.outerHTML).toBe(firstHeader?.outerHTML);
    expect(secondHeader?.textContent).toContain("Mina Kaya");
    expect(secondHeader?.textContent).toContain(headline);
    expect(secondHeader?.textContent).toContain("mina@example.com");
    expect(secondHeader?.textContent).toContain("+49 30 123456");
    expect(secondHeader?.querySelector('a[href="mailto:mina@example.com"]')).not.toBeNull();
    expect(secondHeader?.querySelector('a[href="tel:+4930123456"]')).not.toBeNull();
    expect(second.querySelector("[data-resume-continuation-meta]")).toBeNull();
    expect(second.querySelector("footer [data-resume-header-extra-contact]")).toBeNull();
    if (templateId === "zweispaltig") expect(second.querySelector("footer")?.textContent).toContain("Seite 2 von 2");
  });

  it.each(["preview", "pdf"] as const)("never draws a career heading without entries in the %s", (surface) => {
    for (const page of surface === "pdf" ? pdfPages : previewPages) {
      for (const section of page.querySelectorAll('[data-managed-section="experience"],[data-managed-section="education"]')) {
        const heading = section.querySelector("h2,h3");
        expect((section.textContent ?? "").replace(heading?.textContent ?? "", "").trim()).not.toBe("");
      }
    }
  });

  it("renders every career entry exactly once", () => {
    const all = pdfPages.map(text).join(" ");
    for (const role of [...profile.experiences.map((item) => item.role), ...profile.education.map((item) => item.degree)]) {
      expect(all.split(role).length - 1).toBe(1);
    }
  });

  it("keeps the closing block on the last page only and inside the page", () => {
    expect(pdfPages[0].querySelector("[data-resume-closing],footer[class*=closing]")).toBeNull();
    expect(pdfPages[1].querySelector("[data-resume-closing],footer[class*=closing]")).not.toBeNull();
  });
});

it("renders certificates on their template-specific page, not twice after a split", () => {
  const certified = profileSchema.parse({ ...profile, certifications: ["TÜV Sicherheit Unikat"] });
  const renderCertificatePages = (templateId: string) => {
    const template = getTemplate(templateId);
    const settings = getTemplateDocumentDesignDefaults(templateId);
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Test", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf",
      templateId, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings,
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    return Array.from(parseHTML(buildDocumentHtml(application, certified, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  };
  const elegant = renderCertificatePages("elegant");
  const pehlione = renderCertificatePages("pehlione_white_blue");
  expect(elegant).toHaveLength(2);
  expect(pehlione).toHaveLength(2);
  expect(text(elegant[0])).toContain("TÜV Sicherheit Unikat");
  expect(text(elegant[1])).not.toContain("TÜV Sicherheit Unikat");
  expect(text(pehlione[0])).not.toContain("TÜV Sicherheit Unikat");
  expect(text(pehlione[1])).toContain("TÜV Sicherheit Unikat");
});
