import { describe, expect, it } from "vitest";
import { renderCv } from "../../__parityHarness";
import { profileSchema } from "../../../../shared/schema";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { resolveExperience } from "../../../../shared/resumeCareer";
import { getKlassischDesignVariables, resolveKlassischGeometry } from "../../../../shared/klassischDesign";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { harnessApplication } from "../../__parityHarness";
import { klassischDefaults, klassischDesign } from "./klassisch.defaults";

const uid = (index: number) => `7d000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const words = ["Planung", "und", "Steuerung", "von", "Projekten", "mit", "Fachabteilungen", "sowie", "externen", "Partnern", "für", "Qualität"];
const sentence = (seed: number, length: number) => Array.from({ length }, (_, index) => words[(seed * 7 + index * 3) % words.length]).join(" ");

/** Fictional profile: one career entry far too long for page one, a second one behind it. */
const longEntryProfile = () => profileSchema.parse({
  id: uid(1), isDefault: true, updatedAt: "2026-10-07T10:00:00.000Z", firstName: "Lena", lastName: "Hoffmann", title: "Projektmanagerin",
  city: "Marburg", email: "lena.hoffmann@example.org", phone: "+49 151 2345678",
  summary: "Projektmanagerin mit acht Jahren Erfahrung in der Digitalisierung von Verwaltungsprozessen.",
  experiences: [
    { id: uid(10), from: "01/2019", to: "12/2024", role: "Projektleiterin Digitalisierung", company: "Beispiel Werke GmbH", city: "Frankfurt am Main",
      achievements: Array.from({ length: 28 }, (_, index) => `Punkt ${String(index + 1).padStart(2, "0")}: ${sentence(index, 9 + (index * 5) % 13)}.`) },
    { id: uid(11), from: "01/2016", to: "12/2018", role: "Referentin", company: "Muster AG", city: "Kassel", achievements: ["Einführung eines digitalen Rechnungsworkflows."] },
  ],
  education: [{ id: uid(20), from: "2010", to: "2014", degree: "Bachelor Wirtschaftsinformatik", institution: "Hochschule Beispielstadt" }],
  languages: ["Deutsch – Muttersprache", "Englisch – C1"],
});

/** Fictional profile whose every line is short enough to stay one line at 10, 18, 25/20 and 30 mm side margins. */
const shortLineProfile = () => profileSchema.parse({
  id: uid(2), isDefault: true, updatedAt: "2026-10-07T10:00:00.000Z", firstName: "Jonas", lastName: "Berg", title: "Kaufmann",
  city: "Kassel", email: "jonas@example.org",
  summary: "Kaufmann mit Erfahrung im Einkauf.",
  experiences: Array.from({ length: 9 }, (_, station) => ({
    id: uid(30 + station), from: `0${1 + (station % 8)}/20${10 + station}`, to: `0${2 + (station % 7)}/20${11 + station}`,
    role: `Einkäufer ${station + 1}`, company: `Firma ${station + 1}`, city: "Kassel",
    achievements: Array.from({ length: 6 }, (_, index) => `Ergebnis ${station + 1}.${index + 1} im Einkauf.`),
  })),
  education: [{ id: uid(40), from: "2005", to: "2009", degree: "Kaufmann im Groß- und Außenhandel", institution: "IHK Kassel" }],
});

const variables = (node: Element | null | undefined) => node?.getAttribute("style") ?? "";
const pageRoots = (output: ReturnType<typeof renderCv>) => ({
  preview: output.previewPages.map((page) => page.querySelector(".klassisch-template")),
  pdf: output.pdfPages.map((page) => page.querySelector(".klassisch-pdf")),
});
const bulletsOf = (page: Element) => Array.from(page.querySelectorAll('[data-managed-section="experience"] li')).map((node) => (node.textContent ?? "").trim());

describe("Klassisch: DIN-oriented page geometry", () => {
  it("defaults to a 25 / 20 / 25 / 20 mm text box, 11 pt body at 1.2 and 14 pt titles", () => {
    expect(resolveKlassischGeometry()).toMatchObject({ left: 25, right: 20, top: 25, bottom: 20, contentWidth: 165, contentBottom: 277 });
    expect(klassischDesign.tokens.spacing.pageMarginMm).toBe(25);
    expect(klassischDesign.tokens.typography).toMatchObject({ bodySizePt: 11, lineHeight: 1.2, sectionHeadingSizePt: 14, subheadingSizePt: 14, entryHeadingSizePt: 14 });
    const output = renderCv("klassisch", longEntryProfile());
    const roots = pageRoots(output);
    for (const surface of ["preview", "pdf"] as const) for (const root of roots[surface]) {
      const style = variables(root);
      for (const expected of ["--klassisch-margin-left:25mm", "--klassisch-margin-right:20mm", "--klassisch-margin-top:25mm", "--klassisch-margin-bottom:20mm",
        "--klassisch-body-size:11pt", "--klassisch-line-height:1.2", "--klassisch-section-heading-size:14pt", "--klassisch-name-size:24pt"])
        expect(style, surface).toContain(expected);
    }
  });

  it("draws header, sections and footer of the PDF from the same four margin variables", () => {
    const html = buildDocumentHtml(harnessApplication("klassisch"), longEntryProfile(), "lebenslauf");
    expect(html).toContain(".klassisch-pdf-content{position:relative;z-index:2;height:100%;padding:var(--klassisch-margin-top) var(--klassisch-margin-right) var(--klassisch-margin-bottom) var(--klassisch-margin-left)}");
    expect(html).toContain("right:var(--klassisch-margin-right);bottom:var(--klassisch-footer-bottom);left:var(--klassisch-margin-left)");
    // No old fixed 15 mm / 14 mm geometry and no second, independent margin.
    expect(html).not.toContain("--klassisch-margin:max(15mm");
    expect(html).not.toContain("padding:14mm var(--klassisch-margin) 17mm");
  });

  it.each([18, 10, 30])("Seitenränder %i mm moves only the left and right edge on both surfaces", (margin) => {
    const output = renderCv("klassisch", longEntryProfile(), { overrides: { cvOverrides: { spacing: { pageMarginMm: margin } } } });
    const roots = pageRoots(output);
    for (const surface of ["preview", "pdf"] as const) for (const root of roots[surface]) {
      const style = variables(root);
      expect(style, surface).toContain(`--klassisch-margin-left:${margin}mm`);
      expect(style, surface).toContain(`--klassisch-margin-right:${margin}mm`);
      expect(style, surface).toContain("--klassisch-margin-top:25mm");
      expect(style, surface).toContain("--klassisch-margin-bottom:20mm");
      // The generic text shift (sections only) never applies a second margin.
      expect(style, surface).not.toContain("--resume-page-text-shift");
      expect(root?.hasAttribute("data-resume-spacing-text"), surface).toBe(false);
    }
  });

  it("keeps the vertical page breaks when only the side margins change", () => {
    const profile = shortLineProfile();
    const plan = (margin?: number) => {
      const settings = { ...getTemplateDocumentDesignDefaults("klassisch"), ...(margin === undefined ? {} : { cvOverrides: { spacing: { pageMarginMm: margin } } }) };
      return resolveCvDocument({ profile, templateId: "klassisch", settings }).pagePlan;
    };
    const native = plan();
    expect(native.length).toBeGreaterThan(1);
    for (const margin of [10, 18, 30]) {
      const changed = plan(margin);
      expect(changed.map((page) => ({ items: page.items, blocks: page.blocks, density: page.density })))
        .toEqual(native.map((page) => ({ items: page.items, blocks: page.blocks, density: page.density })));
      // Same capacity: the planned fill of every page is the same share of the same height.
      changed.forEach((page, index) => expect(page.fill?.main).toBeCloseTo(native[index].fill?.main ?? 0, 6));
    }
  });

  it.each([undefined, 18])("breaks a long career entry between bullets like Word, preview = PDF (margin %s)", (margin) => {
    const profile = longEntryProfile();
    const output = renderCv("klassisch", profile, margin === undefined ? {} : { overrides: { cvOverrides: { spacing: { pageMarginMm: margin } } } });
    const plan = output.resolved.pagePlan;
    const long = profile.experiences[0];
    const parts = plan.flatMap((page) => page.items.filter((item) => item.id === long.id).map((item) => ({ page: page.pageNumber, ...item.bullets! })));
    // The entry starts on page one and goes on on page two: it is not moved to page two as a whole.
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toMatchObject({ page: 1, from: 0 });
    expect(parts[1].page).toBe(2);
    expect(parts[1].from).toBe(parts[0].to);
    const expected = resolveExperience(long).bullets.concat(resolveExperience(profile.experiences[1]).bullets);
    for (const surface of ["previewPages", "pdfPages"] as const) {
      const all = output[surface].flatMap(bulletsOf);
      // Every bullet exactly once: none lost, none twice.
      for (const bullet of expected) expect(all.filter((text) => text === bullet), `${surface} ${bullet}`).toHaveLength(1);
      expect(all).toHaveLength(expected.length);
      // The continued part carries the shared marker and the section says it goes on.
      const second = output[surface][1];
      expect(second.querySelector('[data-managed-section="experience"] article h3')?.textContent).toContain("· Fortsetzung");
      expect(second.querySelector('[data-managed-section="experience"] > :is(h2,h3)')?.textContent).toContain("Fortsetzung");
    }
    // The same bullets on the same pages on both surfaces.
    expect(output.previewPages.map(bulletsOf)).toEqual(output.pdfPages.map(bulletsOf));
    expect(output.previewPages).toHaveLength(output.pdfPages.length);
  });

  it("feeds both surfaces from one variable set", () => {
    const resolved = resolveCvDocument({ profile: longEntryProfile(), templateId: "klassisch", settings: getTemplateDocumentDesignDefaults("klassisch") });
    expect(resolved.klassischVariables).toEqual(getKlassischDesignVariables(resolved.design));
    expect(resolved.klassischVariables?.["--klassisch-footer-bottom"]).toBe(`${klassischDefaults.layout.footerBottomMm}mm`);
  });
});

describe("Seitenränder of the other templates", () => {
  it("still shifts the section text of a template without own margin geometry", () => {
    const output = renderCv("einspaltig", shortLineProfile(), { overrides: { cvOverrides: { spacing: { pageMarginMm: 18 } } } });
    for (const page of [...output.previewPages, ...output.pdfPages]) {
      const scope = page.querySelector("[data-resume-spacing-text]");
      expect(scope?.getAttribute("style")).toContain("--resume-page-text-shift");
    }
  });
});
