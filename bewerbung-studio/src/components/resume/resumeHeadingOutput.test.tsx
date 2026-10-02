import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { resolveResumeHeading, setResumeHeading } from "../../shared/resumeHeading";
import { normalizeContinuationHeader } from "../../shared/resumeContinuation";
import { applicationSchema, profileSchema, type ApplicantProfile } from "../../shared/schema";
import { getTemplate } from "../../shared/templates";
import { ElegantHeader } from "./templates/elegant/ElegantHeader";
import { ElegantSidebar } from "./templates/elegant/ElegantSidebar";
import { EinfachHeader } from "./templates/einspaltig/EinfachHeader";
import { GepflegtHeader } from "./templates/gepflegt/GepflegtHeader";
import { GepflegtSidebar } from "./templates/gepflegt/GepflegtSidebar";
import { IvyLeagueHeader } from "./templates/ivy-league/IvyLeagueHeader";
import { KlassischHeader } from "./templates/klassisch/KlassischHeader";
import { KompaktHeader } from "./templates/kompakt/KompaktHeader";
import { KreativHeader } from "./templates/kreativ/KreativHeader";
import { ModernHeader } from "./templates/modern/ModernHeader";
import { PehlioneResume } from "./templates/pehlione";
import { StilvollHeader } from "./templates/stilvoll/StilvollHeader";
import { ZeitgenoessischHeader } from "./templates/zeitgenoessisch/ZeitgenoessischHeader";
import { ZweispaltigHeader } from "./templates/zweispaltig/ZweispaltigHeader";

const now = new Date("2026-07-19T10:00:00.000Z").toISOString();
const base = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mustafa", lastName: "Özdemir", title: "Softwareentwickler", city: "Berlin",
  email: "mustafa@example.com", phone: "+49 30 123456", summary: "Erfahrener Entwickler mit Schwerpunkt auf verlässlichen Abläufen.",
  skills: ["TypeScript", "React"], languages: ["Deutsch – C1"],
  experiences: Array.from({ length: 6 }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Rolle ${index + 1}`, company: `Firma ${index + 1}`, city: "Berlin",
    achievements: Array.from({ length: 6 }, (_, item) => `Ergebnis ${item + 1} mit messbarer Verbesserung der Abläufe in der Abteilung ${index + 1}.`),
  })),
  education: [{ id: crypto.randomUUID(), from: "2000", to: "2004", degree: "Abschluss", institution: "Hochschule" }],
  updatedAt: now,
});

const variants: Array<[string, ApplicantProfile, string]> = [
  ["default", base, "Lebenslauf"],
  ["with-name", setResumeHeading(base, { mode: "with-name" }), "Lebenslauf"],
  ["curriculum-vitae", setResumeHeading(base, { mode: "curriculum-vitae" }), "Curriculum Vitae"],
  ["custom", setResumeHeading(base, { mode: "custom", customTitle: "Mein Lebenslauf" }), "Mein Lebenslauf"],
];

type AnyComponent = ComponentType<Record<string, unknown>>;
const props = (profile: ApplicantProfile) => ({
  profile, name: "Mustafa Özdemir", title: "Softwareentwickler", photoSource: null, atsMode: false, compact: true,
  accentColor: "#155e58", secondaryColor: "#244766",
});
const headers: Array<[string, AnyComponent]> = [
  ["elegant", ElegantHeader as unknown as AnyComponent],
  ["einspaltig", EinfachHeader as unknown as AnyComponent],
  ["gepflegt", GepflegtHeader as unknown as AnyComponent],
  ["ivy-league", IvyLeagueHeader as unknown as AnyComponent],
  ["klassisch", KlassischHeader as unknown as AnyComponent],
  ["kompakt", KompaktHeader as unknown as AnyComponent],
  ["kreativ", KreativHeader as unknown as AnyComponent],
  ["modern", ModernHeader as unknown as AnyComponent],
  ["stilvoll", StilvollHeader as unknown as AnyComponent],
  ["zeitgenoessisch", ZeitgenoessischHeader as unknown as AnyComponent],
  ["zweispaltig", ZweispaltigHeader as unknown as AnyComponent],
];
const markup = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const textOf = (html: string) => (parseHTML(`<html><body>${html}</body></html>`).document.body.textContent ?? "").replace(/\s+/g, " ").trim();

describe.each(variants)("continuation heading of the %s mode", (_mode, profile, kicker) => {
  it.each(headers)("is drawn by the %s header from the central resolver", (_id, Header) => {
    const text = textOf(renderToStaticMarkup(createElement(Header, props(profile))));
    expect(text).toContain(`${kicker} · Fortsetzung`);
    expect(text).toContain("Mustafa Özdemir");
    // The name is printed once beside the heading, never as "Lebenslauf Mustafa Özdemir" + the name again.
    expect(text).not.toContain("Lebenslauf Mustafa Özdemir");
    expect(resolveResumeHeading(profile).continuationKicker).toBe(`${kicker} · Fortsetzung`);
  });

  it("is drawn by the Elegant and Gepflegt continuation sidebars", () => {
    const sidebar = { profile, name: "Mustafa Özdemir", summary: "", sections: profile.resumeSections, photoSource: null, atsMode: false, isContinuation: true, pageNumber: 2, totalPages: 2 };
    for (const Sidebar of [ElegantSidebar, GepflegtSidebar] as unknown as AnyComponent[]) {
      const intro = markup(renderToStaticMarkup(createElement(Sidebar, sidebar))).querySelector('[class$="sidebar__continuation"]')!;
      // The heading sits right above the name, so Lebenslauf + Name reads "Lebenslauf / Mustafa Özdemir".
      expect(intro.querySelector("p")?.textContent).toBe(kicker);
      expect(intro.querySelector("h2")?.textContent).toBe("Mustafa Özdemir");
      expect(textOf(intro.outerHTML)).toContain("Fortsetzung · Seite 2 von 2");
    }
  });

  it("is drawn by the Pehlione continuation sidebar", () => {
    for (const templateId of ["pehlione_white_blue", "pehlione_white"]) {
      const settings = getTemplateDocumentDesignDefaults(templateId);
      const resolved = resolveCvDocument({ profile, templateId, settings, resumeProfile: "" });
      const template = getTemplate(templateId);
      const html = renderToStaticMarkup(createElement(PehlioneResume as unknown as AnyComponent, {
        profile: resolved.profile, templateId, name: "Mustafa Özdemir", atsMode: false, plan: resolved.pagePlan[1], totalPages: resolved.pagePlan.length,
        accentColor: template.accent, secondaryColor: template.secondary, photoSource: null, resumeProfile: resolved.summary, sections: resolved.sections,
      }));
      const intro = markup(html).querySelector(".pehlione-continuation-intro")!;
      expect(intro.querySelector("p")?.textContent).toBe(kicker);
      expect(intro.querySelector("h2")?.textContent).toBe("Mustafa Özdemir");
    }
  });
});

describe("PDF of a template without a native header", () => {
  const pdfKickers = (profile: ApplicantProfile) => {
    const templateId = "classic-professional";
    const template = getTemplate(templateId);
    const application = applicationSchema.parse({
      schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
      job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
      designSettings: getTemplateDocumentDesignDefaults(templateId), documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    const pages = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
    return pages.map((page) => page.querySelector(".cv-header .kicker")?.textContent?.trim());
  };

  it.each(variants)("prints the %s heading on the first page and keeps it on the continuation page", (_mode, profile, kicker) => {
    const kickers = pdfKickers(profile);
    expect(kickers.length).toBeGreaterThan(1);
    expect(kickers[0]).toBe(kicker);
    // The managed output repeats the first-page header on every later page, so the chosen heading is kept as is.
    expect(kickers.every((value) => value === kicker)).toBe(true);
  });

  it("follows the profile name at once and never stores it", () => {
    const withName = setResumeHeading(base, { mode: "with-name" });
    expect(resolveResumeHeading({ ...withName, lastName: "Yılmaz" }).title).toBe("Lebenslauf Mustafa Yılmaz");
    expect(pdfKickers({ ...withName, lastName: "Yılmaz" })[0]).toBe("Lebenslauf");
  });
});

describe("continuation page indicator", () => {
  it("uses the chosen heading instead of a fixed Lebenslauf", () => {
    const page = parseHTML('<html><body><div id="r"><header class="modern-pdf-header compact"><div><p class="kicker">x</p><h1>Mina Kaya</h1></div></header></div></body></html>').document.getElementById("r")!;
    normalizeContinuationHeader(page, 2, 3, undefined, resolveResumeHeading(setResumeHeading(base, { mode: "custom", customTitle: "Mein Lebenslauf" })).kicker);
    expect(page.querySelector("[data-resume-continuation-meta]")?.textContent).toBe("Mein Lebenslauf · Seite 2 von 3");
  });
});

describe("no template spells the heading itself", () => {
  const files = [
    ...["elegant/ElegantHeader", "elegant/ElegantSidebar", "einspaltig/EinfachHeader", "gepflegt/GepflegtHeader", "gepflegt/GepflegtSidebar",
      "ivy-league/IvyLeagueHeader", "klassisch/KlassischHeader", "kompakt/KompaktHeader", "kreativ/KreativHeader", "modern/ModernHeader",
      "pehlione/PehlioneResume", "stilvoll/StilvollHeader", "zeitgenoessisch/ZeitgenoessischHeader", "zweispaltig/ZweispaltigHeader"]
      .map((file) => `src/components/resume/templates/${file}.tsx`),
    "src/views/DocumentsView.tsx", "src/shared/resumeContinuation.ts", "electron/documents.ts",
  ];
  it.each(files)("%s takes the heading from resolveResumeHeading", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source).not.toMatch(/Lebenslauf · (Fortsetzung|Seite)/);
    expect(source).not.toMatch(/<p>Lebenslauf<\/p>/);
    expect(source).not.toMatch(/class="kicker">Lebenslauf</);
  });
});
