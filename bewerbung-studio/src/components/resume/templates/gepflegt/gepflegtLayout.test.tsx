import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { GepflegtResume } from "./GepflegtResume";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { gepflegtDefaults } from "../../../../shared/cvTemplateDefaults/gepflegt.defaults";
import type { DocumentDesignSettings } from "../../../../shared/documentDesign";
import { getGepflegtDesignVariables, gepflegtResolvedCss, isWideGepflegtContact, resolveGepflegtGeometry } from "../../../../shared/gepflegtDesign";
import { getColorContrastRatio } from "../../../../shared/documentDesign";
import { resolveCvDesign } from "../../../../shared/cvDesign";
import { resolveResumeAppearance } from "../../../../shared/resumeDesignSystem";
import { estimateResumeHeaderTop } from "../../../../shared/resumeHeaderGeometry";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { resumeSectionPresentationCss } from "../../../../shared/resumeSectionPresentation";
import { applicationSchema, profileSchema, type ApplicantProfile } from "../../../../shared/schema";

// Fictional data only.
const now = "2026-01-01T12:00:00.000Z";
const makeProfile = (bulletLength = 1) => profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, updatedAt: now, firstName: "Mina", lastName: "Kaya",
  title: "Prozessplanerin", street: "Musterstraße 12", postalCode: "12345", city: "Berlin",
  email: "mina.kaya@example.org", phone: "+49 30 123456",
  linkedin: "https://www.linkedin.com/in/mina-kaya-prozessplanung-beispiel",
  summary: "Erfahrung in Planung und Analyse.",
  strengths: [{ id: crypto.randomUUID(), title: "Analyse", description: "Klare Ergebnisse." }],
  languages: ["Deutsch – C1", "Englisch – B2"], skills: ["Planung"], certifications: ["Beispielzertifikat"],
  experiences: Array.from({ length: 6 }, (_, index) => ({
    id: crypto.randomUUID(), from: "01/2020", to: "12/2021", role: `Position ${index + 1}`,
    company: "Beispiel GmbH", city: "Berlin",
    achievements: Array.from({ length: 5 }, (_, bullet) =>
      `Aufgabe ${index + 1}.${bullet + 1}: ${"Planung und Abstimmung von Arbeitsschritten mit dokumentierter Qualität. ".repeat(bulletLength)}`),
  })),
  education: [{ id: crypto.randomUUID(), from: "2015", to: "2018", degree: "Abschluss", institution: "Beispielschule" }],
});
const profile = makeProfile();
const defaults = getTemplateDocumentDesignDefaults("gepflegt");
const withOverrides = (cvOverrides: DocumentDesignSettings["cvOverrides"], base = defaults): DocumentDesignSettings => ({ ...base, cvOverrides });
const application = (settings: DocumentDesignSettings) => applicationSchema.parse({
  schemaVersion: 1, id: crypto.randomUUID(), folderName: "QA", company: { name: "Beispiel GmbH", city: "Berlin" },
  contact: {}, job: { title: "Prozessplanung" }, status: "Entwurf", templateId: "gepflegt",
  accentColor: gepflegtDefaults.colors.accent, secondaryColor: gepflegtDefaults.colors.sidebarBackground,
  designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});

/** Page one of both surfaces, built from the same resolved document. */
const surfaces = (settings: DocumentDesignSettings, source: ApplicantProfile = profile) => {
  const resolved = resolveCvDocument({ profile: source, templateId: "gepflegt", settings });
  const preview = parseHTML(renderToStaticMarkup(createElement(ManagedResumePreview, {
    profile: resolved.profile, templateId: "gepflegt", pageNumber: 1,
    totalPages: resolved.pagePlan.length, designSettings: resolved.settings, resolvedCv: resolved,
    children: createElement(GepflegtResume, {
      profile: resolved.profile, name: "Mina Kaya", atsMode: false, plan: resolved.pagePlan[0],
      totalPages: resolved.pagePlan.length, accentColor: gepflegtDefaults.colors.accent,
      secondaryColor: gepflegtDefaults.colors.sidebarBackground, photoSource: null,
      resumeProfile: resolved.summary, sections: resolved.sections, designVariables: resolved.gepflegtVariables,
    }),
  }))).document;
  const pdf = parseHTML(buildDocumentHtml(application(settings), source, "lebenslauf")).document;
  return {
    resolved,
    preview: preview.querySelector(".gepflegt-page")!,
    pdf: pdf.querySelector('.cv-sheet[data-template="gepflegt"] .gepflegt-pdf')!,
    pdfPages: Array.from(pdf.querySelectorAll('.cv-sheet[data-template="gepflegt"]')),
  };
};
const variable = (node: Element, name: string) =>
  new RegExp(`${name}:\\s*([^;]+)`).exec(node.getAttribute("style") ?? "")?.[1]?.trim();

describe("Gepflegt layout and central design", () => {
  it("keeps preview and PDF on the same resolved design variables", () => {
    const settings = withOverrides({
      colors: { accent: "#3366AA", heading: "#1F2D3D" },
      typography: { bodySizePt: 10.8, lineHeight: 1.4, sectionHeadingSizePt: 13, headingWeight: 800, sectionHeadingWeight: 700 },
      spacing: { sectionGapMm: 8, entryGapMm: 5, columnGapMm: 11, pageMarginMm: 14 },
    });
    const { preview, pdf, resolved } = surfaces(settings);
    const names = Object.keys(resolved.gepflegtVariables!);
    for (const name of names) expect(variable(pdf, name), name).toBe(variable(preview, name));
    expect(variable(preview, "--gepflegt-accent")).toBe("#3366AA");
    expect(variable(preview, "--gepflegt-heading")).toBe("#1F2D3D");
    expect(variable(preview, "--gepflegt-body-size")).toBe("10.8pt");
    expect(variable(preview, "--gepflegt-line-height")).toBe("1.4");
    expect(variable(preview, "--gepflegt-section-title-size")).toBe("13pt");
    expect(variable(preview, "--gepflegt-name-weight")).toBe("800");
    expect(variable(preview, "--gepflegt-section-weight")).toBe("700");
    expect(variable(preview, "--gepflegt-section-gap-base")).toBe("8mm");
    expect(variable(preview, "--gepflegt-entry-gap-base")).toBe("5mm");
    expect(variable(preview, "--gepflegt-main-padding-left")).toBe("11mm");
  });

  it("moves only the horizontal text edges with Seitenränder; top, bottom, photo and footer stay", () => {
    const native = surfaces(defaults);
    for (const margin of [10, 20, 30]) {
      const changed = surfaces(withOverrides({ spacing: { pageMarginMm: margin } }));
      for (const surface of [changed.preview, changed.pdf]) {
        expect(variable(surface, "--gepflegt-sidebar-padding-left")).toBe(`${25 + margin - 20}mm`);
        expect(variable(surface, "--gepflegt-main-padding-right")).toBe(`${margin}mm`);
        for (const fixed of ["--gepflegt-sidebar-padding-top", "--gepflegt-sidebar-padding-bottom", "--gepflegt-sidebar-padding-right",
          "--gepflegt-main-padding-top", "--gepflegt-main-padding-bottom", "--gepflegt-main-padding-left", "--gepflegt-footer-bottom",
          "--gepflegt-photo-size", "--gepflegt-photo-gap", "--gepflegt-topbar-height", "--gepflegt-sidebar-width"])
          expect(variable(surface, fixed), `${margin} ${fixed}`).toBe(variable(native.preview, fixed));
        // No generic text shift on top of the template's own margin.
        expect(variable(surface, "--resume-page-text-shift")).toBeUndefined();
        expect(surface.hasAttribute("data-resume-spacing-text")).toBe(false);
      }
    }
    expect(variable(native.preview, "--gepflegt-sidebar-padding-left")).toBe("25mm");
    expect(variable(native.preview, "--gepflegt-main-padding-right")).toBe("20mm");
    expect(variable(native.preview, "--gepflegt-main-padding-top")).toBe("14mm");
    expect(variable(native.preview, "--gepflegt-main-padding-bottom")).toBe("24mm");
  });

  it("never lets the sidebar text and the main text meet, for every margin, gap and sidebar width", () => {
    for (const margin of [5, 10, 20, 30]) for (const gap of [0, 8, 18]) for (const sidebar of [60, 80, 100]) {
      const geometry = resolveGepflegtGeometry(margin, gap, sidebar);
      const sideRight = geometry.sidebarWidth - geometry.sidebar.right;
      const mainLeft = geometry.sidebarWidth + geometry.main.left;
      expect(sideRight, `${margin}/${gap}/${sidebar}`).toBeLessThanOrEqual(mainLeft);
      expect(geometry.sideContentWidth).toBeGreaterThan(0);
      expect(geometry.mainContentWidth).toBeGreaterThan(0);
      expect(geometry.sidebar.left + geometry.sideContentWidth + geometry.sidebar.right).toBeCloseTo(sidebar);
      expect(mainLeft + geometry.mainContentWidth + geometry.main.right).toBeCloseTo(210);
      expect([geometry.sidebar.top, geometry.main.top, geometry.main.bottom, geometry.footerBottom]).toEqual([14, 14, 24, 16]);
    }
    // Columns shrink, they never overflow: grid tracks and their text may wrap anywhere.
    expect(gepflegtResolvedCss).toContain("grid-template-columns:var(--gepflegt-sidebar-width) minmax(0,1fr)");
    expect(gepflegtResolvedCss).toContain("overflow-wrap:anywhere");
  });

  it("draws Spaltenabstand once, as the main column's inset, not as an extra grid gap", () => {
    const { preview, pdf } = surfaces(withOverrides({ spacing: { columnGapMm: 14 } }));
    expect(variable(preview, "--gepflegt-main-padding-left")).toBe("14mm");
    expect(variable(pdf, "--gepflegt-main-padding-left")).toBe("14mm");
    for (const host of [preview.querySelector(".gepflegt-layout"), pdf])
      expect(host?.getAttribute("style") ?? "").not.toMatch(/(^|;)\s*column-gap\s*:/);
  });

  it("plans the pages with the main column width the margin leaves", () => {
    const long = makeProfile(3);
    const firstPageBullets = (pageMarginMm: number) => {
      const plan = resolveCvDocument({ profile: long, templateId: "gepflegt", settings: withOverrides({ spacing: { pageMarginMm } }) }).pagePlan;
      return plan[0].items.filter((item) => item.kind === "experience")
        .reduce((total, item) => total + (item.bullets ? item.bullets.to - item.bullets.from : 5), 0);
    };
    expect(firstPageBullets(30)).toBeLessThan(firstPageBullets(10));
    // A narrower header wraps more: the header estimate grows with a smaller width ratio.
    const header = (ratio: number) => estimateResumeHeaderTop("gepflegt", long, "main", 0, true, false, ratio)!;
    expect(header(0.8)).toBeGreaterThanOrEqual(header(1));
  });

  it("keeps the user's section columns when the design changes", () => {
    const moved = moveManagerSection(profile, "gepflegt", "languages", "main", 0);
    for (const settings of [defaults, withOverrides({ spacing: { pageMarginMm: 10, columnGapMm: 12, sectionGapMm: 9 } })]) {
      const pages = surfaces(settings, moved);
      for (const page of [pages.preview, pages.pdf]) {
        expect(page.querySelector('[data-managed-section="languages"]')?.getAttribute("data-cv-zone")).toBe("main");
        expect(page.querySelector('[data-managed-section="summary"]')?.getAttribute("data-cv-zone")).toBe("sidebar");
      }
    }
  });

  it("puts a long contact on a row of its own in both outputs", () => {
    const { preview, pdf } = surfaces(defaults);
    const wide = (root: Element, selector: string) => Array.from(root.querySelectorAll(selector))
      .map((node) => `${node.hasAttribute("data-wide")}:${node.textContent?.trim()}`);
    const previewContacts = wide(preview, ".gepflegt-header__contacts > *");
    expect(previewContacts).toEqual(wide(pdf, ".gepflegt-pdf-contact"));
    expect(previewContacts).toContain("true:www.linkedin.com/in/mina-kaya-prozessplanung-beispiel");
    expect(previewContacts).toContain("false:mina.kaya@example.org");
    expect(isWideGepflegtContact("x".repeat(31))).toBe(true);
    expect(gepflegtResolvedCss).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
  });

  it("styles both outputs from one rule set: bullets, footer, sidebar lists and section gaps", () => {
    expect(gepflegtResolvedCss).toContain(".gepflegt-page:not(.gepflegt-page--ats) .gepflegt-entry ul,.gepflegt-pdf:not(.gepflegt-pdf-ats) .gepflegt-pdf-entry ul{list-style:disc}");
    expect(gepflegtResolvedCss).toContain(".gepflegt-main>.resume-special-output-list{gap:var(--gepflegt-section-gap)}");
    // Certificates and every other sidebar block follow the central body size and section gap on every page.
    expect(resumeSectionPresentationCss).toContain('[data-cv-zone="sidebar"]{margin:0 0 var(--gepflegt-section-gap,6.5mm)}');
    expect(resumeSectionPresentationCss).toContain("font-size:var(--gepflegt-body-size,11pt);line-height:var(--gepflegt-line-height,1.3)");
    const { pdfPages } = surfaces(defaults, makeProfile(3));
    expect(pdfPages.length).toBeGreaterThan(1);
    // The footer reads like the preview: link at the left, page number at the right.
    const footer = pdfPages[0].querySelector(".gepflegt-pdf-footer");
    expect(footer?.lastElementChild?.textContent).toMatch(/^Seite 1 von \d+$/);
  });
});

describe("Gepflegt default design and page flow", () => {
  it("ships a readable German CV default: 11-12 pt body, 13-15 pt headings, line height 1.0-1.5, one font, one accent", () => {
    const design = resolveCvDesign("gepflegt");
    expect(design.typography.bodySizePt).toBeGreaterThanOrEqual(11);
    expect(design.typography.bodySizePt).toBeLessThanOrEqual(12);
    for (const heading of [design.typography.sectionHeadingSizePt, design.typography.subheadingSizePt, gepflegtDefaults.typography.sidebarTitleSizePt]) {
      expect(heading).toBeGreaterThanOrEqual(13);
      expect(heading).toBeLessThanOrEqual(15);
    }
    expect(design.typography.lineHeight).toBeGreaterThanOrEqual(1);
    expect(design.typography.lineHeight).toBeLessThanOrEqual(1.5);
    expect(new Set([design.typography.fontId, design.typography.headingFontId]).size).toBeLessThanOrEqual(2);
    // The accent is the sidebar's teal (one hue) and readable as text on the paper.
    expect(design.colors.accent).toBe(gepflegtDefaults.colors.sidebarBackground);
    expect(getColorContrastRatio(design.colors.accent, design.colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps one accent: an old template cyan becomes the teal, a chosen colour stays, a new sidebar takes the accent along", () => {
    const design = resolveCvDesign("gepflegt");
    const appearance = resolveResumeAppearance("gepflegt");
    expect(getGepflegtDesignVariables(design, appearance, undefined, "#00B8B5", "#087875")["--gepflegt-accent"]).toBe("#087875");
    expect(getGepflegtDesignVariables(design, appearance, undefined, "#AA3355", "#087875")["--gepflegt-accent"]).toBe("#AA3355");
    const blue = getGepflegtDesignVariables(design, resolveResumeAppearance("gepflegt", { sidebarBackgroundColor: "#1F4E8C" }), undefined, "#087875", "#087875");
    expect(blue["--gepflegt-accent"]).toBe("#1F4E8C");
    const pale = getGepflegtDesignVariables(design, resolveResumeAppearance("gepflegt", { sidebarBackgroundColor: "#9FD3E0" }), undefined);
    expect(getColorContrastRatio(pale["--gepflegt-accent"], design.colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("never lets Seitenränder reach a vertical variable (getGepflegtDesignVariables)", () => {
    const appearance = resolveResumeAppearance("gepflegt");
    const vertical = ["--gepflegt-main-padding-top", "--gepflegt-main-padding-bottom", "--gepflegt-sidebar-padding-top",
      "--gepflegt-sidebar-padding-bottom", "--gepflegt-footer-bottom", "--gepflegt-photo-gap", "--gepflegt-topbar-height"];
    const native = getGepflegtDesignVariables(resolveCvDesign("gepflegt"), appearance, undefined);
    for (const pageMarginMm of [5, 10, 30]) {
      const changed = getGepflegtDesignVariables(resolveCvDesign("gepflegt", { spacing: { pageMarginMm } }), appearance, undefined);
      for (const name of vertical) expect(changed[name], `${pageMarginMm} ${name}`).toBe(native[name]);
      expect(changed["--gepflegt-main-padding-right"]).toBe(`${pageMarginMm}mm`);
    }
  });

  it("plans the same pages at every margin when no line changes, and fills them to the bottom", () => {
    // Short one-line bullets: a margin can only change line wrapping, so the page plan must not move at all.
    const base = makeProfile();
    const station = (number: number) => ({
      ...base.experiences[0], id: crypto.randomUUID(), role: `Station ${number}`,
      achievements: Array.from({ length: 6 }, (_, bullet) => `Aufgabe ${number}.${bullet + 1} erledigt`),
    });
    const short = profileSchema.parse({ ...base, experiences: Array.from({ length: 12 }, (_, index) => station(index + 1)) });
    const plan = (pageMarginMm: number) => resolveCvDocument({ profile: short, templateId: "gepflegt", settings: withOverrides({ spacing: { pageMarginMm } }) }).pagePlan;
    const shape = (pages: ReturnType<typeof plan>) => pages.map((page) => page.items.map((item) => `${item.id}:${item.bullets?.from ?? 0}-${item.bullets?.to ?? "all"}`).join(","));
    expect(plan(20).length).toBeGreaterThan(1);
    expect(shape(plan(10))).toEqual(shape(plan(20)));
    expect(shape(plan(30))).toEqual(shape(plan(20)));
    // Word-like flow: a page that continues on the next one is planned full. Page one may keep less than the smallest part
    // of the next entry (its header and two bullet lines, ~29 mm) free; the continuation pages are filled to the bottom.
    const pages = plan(20);
    for (const page of pages.slice(0, -1)) expect(page.fill?.main ?? 0).toBeGreaterThan(0.8);
    for (const page of pages.slice(1, -1)) expect(page.fill?.main ?? 0).toBeGreaterThan(0.95);
  });

  it("prints every period as MM/JJJJ - MM/JJJJ in both outputs", () => {
    const { preview, pdf } = surfaces(defaults);
    const periods = (root: Element, selector: string) => Array.from(root.querySelectorAll(selector)).map((node) => node.textContent?.trim());
    const previewPeriods = periods(preview, ".gepflegt-entry__heading > span");
    expect(previewPeriods.length).toBeGreaterThan(0);
    for (const period of previewPeriods) expect(period).toMatch(/^\d{2}\/\d{4} – (\d{2}\/\d{4}|heute)$/);
    expect(periods(pdf, ".gepflegt-pdf-entry-heading > span")).toEqual(previewPeriods);
  });
});
