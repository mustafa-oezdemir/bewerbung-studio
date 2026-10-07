import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { ManagedResumePreview } from "./ManagedResumePreview";
import { GepflegtResume } from "./templates/gepflegt";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { gepflegtDefaults } from "../../shared/cvTemplateDefaults/gepflegt.defaults";
import { getColorContrastRatio } from "../../shared/documentDesign";
import { gepflegtGeometry, gepflegtLetterCss, gepflegtResolvedCss } from "../../shared/gepflegtDesign";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { getPaginationGeometry } from "../../shared/resumePaginationGeometry";
import { applicationSchema, profileSchema } from "../../shared/schema";

const now = "2026-01-01T12:00:00.000Z";
const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, updatedAt: now, firstName: "Mina", lastName: "Kaya",
  title: "Prozessplanerin", street: "Musterstraße 12", postalCode: "12345", city: "Berlin",
  email: "mina.kaya@example.org", phone: "+49 30 123456", summary: "Erfahrung in Planung und Analyse.",
  strengths: [{ id: crypto.randomUUID(), title: "Analyse", description: "Klare Ergebnisse." }],
  languages: ["Deutsch – C1"], skills: ["Planung"], certifications: ["Beispielzertifikat"],
  experiences: Array.from({ length: 4 }, (_, index) => ({
    id: crypto.randomUUID(), from: "01/2020", to: "12/2021", role: `Position ${index + 1}`,
    company: "Beispiel GmbH", city: "Berlin",
    achievements: Array.from({ length: 5 }, (_, bullet) =>
      `Aufgabe ${index + 1}.${bullet + 1}: Planung und Abstimmung von Arbeitsschritten mit dokumentierter Qualität und messbarem Ergebnis.`),
  })),
  education: [{ id: crypto.randomUUID(), from: "2015", to: "2018", degree: "Abschluss", institution: "Beispielschule" }],
});
const defaults = getTemplateDocumentDesignDefaults("gepflegt");
const application = (settings = defaults) => applicationSchema.parse({
  schemaVersion: 1, id: crypto.randomUUID(), folderName: "QA", company: { name: "Beispiel GmbH", city: "Berlin" },
  contact: {}, job: { title: "Prozessplanung" }, status: "Entwurf", templateId: "gepflegt",
  accentColor: gepflegtDefaults.colors.accent, secondaryColor: gepflegtDefaults.colors.sidebarBackground,
  designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});
const preview = (resolved: ReturnType<typeof resolveCvDocument>) => renderToStaticMarkup(
  createElement(ManagedResumePreview, {
    profile: resolved.profile, templateId: "gepflegt", pageNumber: 1,
    totalPages: resolved.pagePlan.length, designSettings: resolved.settings, resolvedCv: resolved,
    children: createElement(GepflegtResume, {
      profile: resolved.profile, name: "Mina Kaya", atsMode: false, plan: resolved.pagePlan[0],
      totalPages: resolved.pagePlan.length, accentColor: gepflegtDefaults.colors.accent,
      secondaryColor: gepflegtDefaults.colors.sidebarBackground, photoSource: null,
      resumeProfile: resolved.summary, sections: resolved.sections, designVariables: resolved.gepflegtVariables,
    }),
  }),
);

describe("Gepflegt resolved design", () => {
  it("uses an A4 visual lane with DIN text edges and one planner geometry", () => {
    const pagination = getPaginationGeometry("gepflegt");
    expect([gepflegtGeometry.pageWidthMm, gepflegtGeometry.pageHeightMm]).toEqual([210, 297]);
    expect(gepflegtGeometry.sidebar.paddingLeftMm).toBe(10);
    expect(gepflegtGeometry.sidebarWidthMm - gepflegtGeometry.sidebar.paddingLeftMm - gepflegtGeometry.sidebar.paddingRightMm).toBe(65);
    expect(pagination.mainLeft).toBe(gepflegtGeometry.sidebarWidthMm + gepflegtGeometry.main.paddingLeftMm);
    expect(pagination.mainRight).toBe(gepflegtGeometry.pageWidthMm - gepflegtGeometry.main.paddingRightMm);
    expect(pagination.limit).toBe(gepflegtGeometry.pageHeightMm - gepflegtGeometry.main.paddingBottomMm);
    expect(gepflegtGeometry.main.footerBottomMm).toBeGreaterThanOrEqual(15);
  });

  it("uses 10 mm horizontal margins by default and leaves vertical edges fixed for custom margins", () => {
    const native = resolveCvDocument({ profile, templateId: "gepflegt", settings: defaults });
    const customSettings = { ...defaults, cvOverrides: { spacing: { pageMarginMm: 20 } } };
    const custom = resolveCvDocument({ profile, templateId: "gepflegt", settings: customSettings });
    const initial = native.gepflegtVariables!;
    const changed = custom.gepflegtVariables!;
    expect(defaults.cvOverrides?.spacing?.pageMarginMm).toBeUndefined();
    expect(initial["--gepflegt-sidebar-padding-left"]).toBe("10mm");
    expect(initial["--gepflegt-main-padding-right"]).toBe("10mm");
    expect(changed["--gepflegt-sidebar-padding-left"]).toBe("20mm");
    expect(changed["--gepflegt-main-padding-right"]).toBe("20mm");
    for (const name of ["sidebar-padding-top", "sidebar-padding-bottom", "main-padding-top", "main-padding-bottom", "main-padding-left", "footer-bottom"])
      expect(changed[`--gepflegt-${name}`], name).toBe(initial[`--gepflegt-${name}`]);
    expect(custom.pagePlan[0].fill?.main).not.toBe(native.pagePlan[0].fill?.main);
    const pdf = buildDocumentHtml(application(customSettings), profile, "lebenslauf");
    const html = preview(custom);
    for (const surface of [parseHTML(pdf).document.querySelector(".gepflegt-pdf"), parseHTML(html).document.querySelector(".gepflegt-page")]) {
      expect(surface?.getAttribute("style")).toContain("--gepflegt-sidebar-padding-left:20mm");
      expect(surface?.getAttribute("style")).toContain("--gepflegt-main-padding-right:20mm");
      expect(surface?.getAttribute("style")).toContain("--gepflegt-main-padding-bottom:24mm");
    }
  });

  it("resolves typography and density without reverting to 7.8pt or 1.18", () => {
    const settings = { ...defaults, cvOverrides: { typography: { bodySizePt: 11, lineHeight: 1.45 } } };
    const resolved = resolveCvDocument({ profile, templateId: "gepflegt", settings });
    const variables = resolved.gepflegtVariables!;
    expect(variables["--gepflegt-body-size"]).toBe("11pt");
    expect(variables["--gepflegt-line-height"]).toBe("1.45");
    expect(gepflegtResolvedCss).toContain("--gepflegt-entry-gap-base");
    expect(gepflegtResolvedCss).toContain("--gepflegt-body-size");
    expect(gepflegtResolvedCss).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
    expect(gepflegtResolvedCss).toContain("white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    expect(gepflegtResolvedCss).not.toContain("7.8pt");
    expect(gepflegtResolvedCss).not.toContain("1.18");
    const pdf = buildDocumentHtml(application(settings), profile, "lebenslauf");
    const pages = parseHTML(pdf).document.querySelectorAll('.cv-sheet[data-template="gepflegt"]');
    const html = preview(resolved);
    for (const surface of [pages[0]?.querySelector(".gepflegt-pdf"), parseHTML(html).document.querySelector(".gepflegt-page")]) {
      expect(surface?.getAttribute("style")).toContain("--gepflegt-body-size:11pt");
      expect(surface?.getAttribute("style")).toContain("--gepflegt-line-height:1.45");
    }
    expect(resolved.pagePlan.every(page => page.sidebar)).toBe(true);
  });

  it("keeps long contact labels in one grid row in preview and PDF", () => {
    const longContactProfile = profileSchema.parse({
      ...profile,
      linkedin: "https://www.linkedin.com/in/fictional-long-profile-name",
    });
    const resolved = resolveCvDocument({ profile: longContactProfile, templateId: "gepflegt", settings: defaults });
    const pdf = parseHTML(buildDocumentHtml(application(), longContactProfile, "lebenslauf")).document;
    const visual = parseHTML(preview(resolved)).document;
    for (const root of [pdf, visual]) {
      const contact = root.querySelector('a[href*="linkedin.com"]');
      expect(contact?.getAttribute("data-contact-wide")).toBe("true");
      expect(contact?.textContent).toContain("fictional-long-profile-name");
    }
  });

  it("places a short final education entry in the remaining space on page one", () => {
    const lastEducationId = crypto.randomUUID();
    const pageProfile = profileSchema.parse({
      ...profile,
      title: "Softwareentwicklerin | Fachinformatikerin für Anwendungsentwicklung",
      experiences: [{
        id: crypto.randomUUID(), from: "2024", to: "2025", role: "Praktikum als Anwendungsentwicklerin",
        company: "Universitätsstadt Musterstadt", city: "Musterstadt",
        achievements: Array.from({ length: 5 }, (_, index) =>
          `Entwicklung einer Schnittstelle mit Authentifizierung und Monitoring für sichere Nutzung und Dokumentation ${index}`),
      }],
      education: [
        { id: crypto.randomUUID(), from: "2023", to: "2025", degree: "Fachinformatikerin für Anwendungsentwicklung", institution: "Akademie GmbH",
          description: "Ausbildung mit Schwerpunkt Softwareentwicklung und Monitoring." },
        { id: crypto.randomUUID(), from: "2019", to: "2022", degree: "Ausbildung zur Transportpilotin", institution: "Luftfahrtzentrum",
          description: "Pilotenausbildung mit Schwerpunkt sicherheitskritische Prozesse." },
        { id: lastEducationId, from: "2008", to: "2012", degree: "Industrieingenieurwesen", institution: "Muster Hochschule" },
      ],
    });
    const pages = resolveCvDocument({ profile: pageProfile, templateId: "gepflegt", settings: defaults }).pagePlan;
    expect(pages[0].items.some((item) => item.id === lastEducationId)).toBe(true);
    expect(pages[0].fill?.main).toBeLessThanOrEqual(1);
  });

  it("lets education start on page one with a smaller saved body size", () => {
    const pageProfile = profileSchema.parse({
      ...profile,
      title: "Softwareentwicklung | Fachinformatik für Anwendungsentwicklung",
      linkedin: "https://www.linkedin.com/in/fictional-long-profile-name",
      experiences: profile.experiences.slice(0, 3),
      education: Array.from({ length: 4 }, (_, index) => ({
        id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2012 + index}`,
        degree: `Ausbildung ${index + 1}`, institution: "Muster Hochschule",
      })),
    });
    const settings = { ...defaults, cvOverrides: { typography: { bodySizePt: 9 }, spacing: { pageMarginMm: 10 } } };
    const pages = resolveCvDocument({ profile: pageProfile, templateId: "gepflegt", settings }).pagePlan;
    expect(pages[0].items.some((item) => item.kind === "education")).toBe(true);
    expect(pages.flatMap((page) => page.items.filter((item) => item.kind === "education"))).toHaveLength(4);
  });

  it("resolves every palette family and keeps sidebar text readable", () => {
    const settings = { ...defaults,
      cvOverrides: { colors: { accent: "#85BCE6", heading: "#142A4A", text: "#343E48" } },
      resumeAppearance: { sidebarBackgroundColor: "#162E54" },
    };
    const resolved = resolveCvDocument({ profile, templateId: "gepflegt", settings });
    const v = resolved.gepflegtVariables!;
    expect(v["--gepflegt-sidebar-background"]).toBe("#162E54");
    expect(v["--gepflegt-accent"]).toBe("#85BCE6");
    expect(v["--gepflegt-heading"]).toBe("#142A4A");
    expect(v["--gepflegt-text"]).toBe("#343E48");
    expect(v["--gepflegt-topbar"]).not.toBe(gepflegtDefaults.colors.sidebarTopBar);
    expect(getColorContrastRatio(v["--gepflegt-sidebar-text"], v["--gepflegt-sidebar-background"])).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrastRatio(v["--gepflegt-sidebar-muted"], v["--gepflegt-sidebar-background"])).toBeGreaterThanOrEqual(4.5);
    const letter = buildDocumentHtml(application(settings), profile, "anschreiben");
    expect(letter).toContain("gepflegt-letter");
    expect(letter).toContain("--gepflegt-heading:#142A4A");
    expect(letter).toContain("--gepflegt-accent:#85BCE6");
    expect(letter).toContain("--gepflegt-sidebar-background:#162E54");
  });

  it("derives CV and letter identity from the same profile, with 13pt subject and 11pt body", () => {
    const letter = buildDocumentHtml(application(), profile, "anschreiben");
    const doc = parseHTML(letter).document;
    expect(doc.querySelector(".sender-name")?.textContent).toBe("Mina Kaya");
    expect(doc.querySelector(".sender-title")?.textContent).toBe("Prozessplanerin");
    expect(doc.querySelector(".sender-contact")?.textContent).toContain("mina.kaya@example.org");
    expect(doc.querySelector(".sender-contact")?.textContent).toContain("+49 30 123456");
    expect(doc.querySelector(".recipient")?.textContent).toContain("Beispiel GmbH");
    expect(gepflegtLetterCss).toContain('font-size:var(--letter-subject-size)!important');
    expect(gepflegtLetterCss).toContain('font-size:var(--letter-body-size)!important');
    expect(letter).toContain("--letter-subject-size:13pt");
    expect(letter).toContain("--letter-body-size:11pt");
  });
});
