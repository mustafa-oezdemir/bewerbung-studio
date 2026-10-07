import { describe, expect, it } from "vitest";
import { harnessApplication, renderCv } from "../../__parityHarness";
import { profileSchema } from "../../../../shared/schema";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { defaultDocumentDesign } from "../../../../shared/documentDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { resolveExperience } from "../../../../shared/resumeCareer";
import { resolveResumeDesignView } from "../../../../shared/resumeDesignSystem";
import { getEinspaltigDesignVariables, resolveEinspaltigGeometry } from "../../../../shared/einspaltigDesign";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { einspaltigDefaults, einspaltigDesign } from "./einfach.defaults";

const uid = (index: number) => `7f000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const words = ["Planung", "und", "Steuerung", "von", "Projekten", "mit", "Fachabteilungen", "sowie", "externen", "Partnern", "für", "Qualität"];
const sentence = (seed: number, length: number) => Array.from({ length }, (_, index) => words[(seed * 7 + index * 3) % words.length]).join(" ");

/** Fictional profile: one career entry far too long for page one, a second one behind it. */
const longEntryProfile = () => profileSchema.parse({
  id: uid(1), isDefault: true, updatedAt: "2026-10-07T10:00:00.000Z", firstName: "Jana", lastName: "Winter", title: "Projektmanagerin",
  city: "Kassel", email: "jana.winter@example.org", phone: "+49 160 1234567",
  summary: "Projektmanagerin mit Erfahrung in der Digitalisierung von Verwaltungsprozessen.",
  experiences: [
    { id: uid(10), from: "01/2019", to: "12/2024", role: "Projektleiterin Digitalisierung", company: "Beispiel Werke GmbH", city: "Frankfurt am Main",
      achievements: Array.from({ length: 28 }, (_, index) => `Punkt ${String(index + 1).padStart(2, "0")}: ${sentence(index, 9 + (index * 5) % 13)}.`) },
    { id: uid(11), from: "01/2016", to: "12/2018", role: "Referentin", company: "Muster AG", city: "Kassel", achievements: ["Einführung eines digitalen Rechnungsworkflows."] },
  ],
  education: [{ id: uid(20), from: "2010", to: "2014", degree: "Bachelor Wirtschaftsinformatik", institution: "Hochschule Beispielstadt" }],
  languages: ["Deutsch – Muttersprache", "Englisch – C1"],
});

/** Fictional profile whose every line stays one line at 10, 18, 25/20 and 30 mm side margins. */
const shortLineProfile = () => profileSchema.parse({
  id: uid(2), isDefault: true, updatedAt: "2026-10-07T10:00:00.000Z", firstName: "Tom", lastName: "Berg", title: "Kaufmann",
  city: "Kassel", email: "tom@example.org", summary: "Kaufmann mit Erfahrung im Einkauf.",
  experiences: Array.from({ length: 9 }, (_, station) => ({
    id: uid(30 + station), from: `0${1 + (station % 8)}/20${10 + station}`, to: `0${2 + (station % 7)}/20${11 + station}`,
    role: `Einkäufer ${station + 1}`, company: `Firma ${station + 1}`, city: "Kassel",
    achievements: Array.from({ length: 6 }, (_, index) => `Ergebnis ${station + 1}.${index + 1} im Einkauf.`),
  })),
  education: [{ id: uid(40), from: "2005", to: "2009", degree: "Kaufmann im Großhandel", institution: "IHK Kassel" }],
});

const styleOf = (node: Element | null | undefined) => node?.getAttribute("style") ?? "";
const roots = (output: ReturnType<typeof renderCv>) => ({
  preview: output.previewPages.map((page) => page.querySelector(".einfach-template")),
  pdf: output.pdfPages.map((page) => page.querySelector(".einfach-pdf")),
});
const bulletsOf = (page: Element) => Array.from(page.querySelectorAll('[data-managed-section="experience"] li')).map((node) => (node.textContent ?? "").trim());
const withDesign = (cvOverrides: Record<string, unknown>) => ({ overrides: { cvOverrides } });

describe("Einspaltig: DIN-oriented page geometry", () => {
  it("defaults to a 25 / 20 / 25 / 20 mm text box, 11 pt body at 1.25, name 16 pt and 14 pt section titles", () => {
    expect(resolveEinspaltigGeometry()).toMatchObject({ left: 25, right: 20, top: 25, bottom: 20, contentWidth: 165, contentBottom: 277 });
    expect(einspaltigDesign.tokens.spacing.pageMarginMm).toBe(25);
    expect(einspaltigDesign.tokens.typography).toMatchObject({ bodySizePt: 11, lineHeight: 1.25, headingSizePt: 16, sectionHeadingSizePt: 14, fontId: "source-sans", headingFontId: "source-sans" });
    const output = renderCv("einspaltig", longEntryProfile());
    for (const [surface, list] of Object.entries(roots(output))) for (const root of list) {
      for (const expected of ["--einfach-margin-left:25mm", "--einfach-margin-right:20mm", "--einfach-margin-top:25mm", "--einfach-margin-bottom:20mm",
        "--einfach-body-size:11pt", "--einfach-line-height:1.25", "--einfach-name-size:16pt", "--einfach-section-heading-size:14pt"])
        expect(styleOf(root), surface).toContain(expected);
    }
  });

  it("shows the DIN page for a new Bewerbung, whatever the app-wide slider defaults are", () => {
    // A Bewerbung from the wizard carries defaultDocumentDesign (marginLevel 5, Schriftgröße medium): no choice of the user.
    const settings = { ...defaultDocumentDesign, templateId: undefined };
    const view = resolveResumeDesignView("einspaltig", settings);
    expect(view.effective.tokens.spacing.pageMarginMm).toBe(25);
    expect(view.effective.tokens.typography).toMatchObject({ bodySizePt: 11, lineHeight: 1.25 });
  });

  it("draws header, sections and footer of the PDF from the same margin variables, without the old fixed values", () => {
    const html = buildDocumentHtml(harnessApplication("einspaltig"), longEntryProfile(), "lebenslauf");
    expect(html).toContain(".einfach-pdf-inner{position:relative;z-index:2;height:100%;padding:var(--einfach-margin-top) var(--einfach-margin-right) var(--einfach-margin-bottom) var(--einfach-margin-left)}");
    expect(html).toContain("right:var(--einfach-margin-right);bottom:var(--einfach-footer-bottom);left:var(--einfach-margin-left)");
    // The Einspaltig rules of the PDF stylesheet (other templates share the sheet) carry no fixed size or margin of their own.
    const rules = (html.match(/[^}]*einfach[^{]*\{[^}]*\}/g) ?? []).join("\n");
    expect(rules).toContain(".einfach-pdf");
    for (const old of ["max(15mm", "+ 1.2pt", "clamp(", "font-size:24pt", "font-size:13.5pt", "font-size:11.5pt", "font-size:9pt", "dashed"])
      expect(rules, old).not.toContain(old);
  });

  it.each([18, 10, 30])("Seitenränder %i mm moves only the left and right edge on both surfaces", (margin) => {
    const output = renderCv("einspaltig", longEntryProfile(), withDesign({ spacing: { pageMarginMm: margin } }));
    for (const [surface, list] of Object.entries(roots(output))) for (const root of list) {
      const style = styleOf(root);
      expect(style, surface).toContain(`--einfach-margin-left:${margin}mm`);
      expect(style, surface).toContain(`--einfach-margin-right:${margin}mm`);
      expect(style, surface).toContain("--einfach-margin-top:25mm");
      expect(style, surface).toContain("--einfach-margin-bottom:20mm");
      expect(style, surface).not.toContain("--resume-page-text-shift");
      expect(root?.hasAttribute("data-resume-spacing-text"), surface).toBe(false);
    }
  });

  it("keeps the vertical page breaks when only the side margins change", () => {
    const profile = shortLineProfile();
    const plan = (margin?: number) => resolveCvDocument({ profile, templateId: "einspaltig",
      settings: { ...getTemplateDocumentDesignDefaults("einspaltig"), ...(margin === undefined ? {} : { cvOverrides: { spacing: { pageMarginMm: margin } } }) } }).pagePlan;
    const native = plan();
    expect(native.length).toBeGreaterThan(1);
    for (const margin of [10, 18, 30]) {
      const changed = plan(margin);
      expect(changed.map((page) => ({ items: page.items, blocks: page.blocks, density: page.density })))
        .toEqual(native.map((page) => ({ items: page.items, blocks: page.blocks, density: page.density })));
      changed.forEach((page, index) => expect(page.fill?.main).toBeCloseTo(native[index].fill?.main ?? 0, 6));
    }
  });

  it.each([
    ["Lesetext 11.8 pt", { typography: { bodySizePt: 11.8 } }, "--einfach-body-size:11.8pt"],
    ["Zeilenhöhe 1.35", { typography: { lineHeight: 1.35 } }, "--einfach-line-height:1.35"],
    ["Abschnittstitel 15 pt", { typography: { sectionHeadingSizePt: 15 } }, "--einfach-section-heading-size:15pt"],
    ["Abschnittsabstand 8 mm", { spacing: { sectionGapMm: 8 } }, "--einfach-section-gap-base:8mm"],
    ["Eintragsabstand 6 mm", { spacing: { entryGapMm: 6 } }, "--einfach-entry-gap-base:6mm"],
  ])("applies %s from the central Lebenslauf design to preview, PDF and the page plan", (_name, cvOverrides, variable) => {
    const native = renderCv("einspaltig", shortLineProfile());
    const output = renderCv("einspaltig", shortLineProfile(), withDesign(cvOverrides));
    for (const [surface, list] of Object.entries(roots(output))) for (const root of list) expect(styleOf(root), surface).toContain(variable);
    // The planner measures with the same value: a larger value takes more room, so page one holds fewer bullets.
    const firstPage = (plan: typeof native.resolved.pagePlan) => plan[0].items.reduce((sum, item) => sum + (item.bullets ? item.bullets.to - item.bullets.from : 6), 0);
    const fewer = firstPage(output.resolved.pagePlan) < firstPage(native.resolved.pagePlan);
    const fuller = (output.resolved.pagePlan[0].fill?.main ?? 0) > (native.resolved.pagePlan[0].fill?.main ?? 0);
    expect(fewer || fuller).toBe(true);
    expect(output.previewPages).toHaveLength(output.pdfPages.length);
    expect(output.previewPages.map(bulletsOf)).toEqual(output.pdfPages.map(bulletsOf));
  });

  it("keeps one accent: a chosen colour world replaces it everywhere, the neutral text stays", () => {
    const design = einspaltigDesign.tokens;
    const native = getEinspaltigDesignVariables(design);
    expect(native["--einfach-accent"]).toBe(einspaltigDefaults.colors.primary);
    expect(native["--einfach-section-heading"]).toBe(native["--einfach-accent"]);
    expect(native["--einfach-text"]).toBe(einspaltigDefaults.colors.text);
    const chosen = getEinspaltigDesignVariables(design, undefined, "#7A1F3D");
    for (const key of ["--einfach-accent", "--einfach-primary", "--einfach-section-heading", "--einfach-divider", "--einfach-subheading", "--einfach-icon"])
      expect(chosen[key], key).toBe("#7A1F3D");
    expect(chosen["--einfach-text"]).toBe(einspaltigDefaults.colors.text);
    // A colour the user sets in the Lebenslauf design wins over the application colour.
    expect(getEinspaltigDesignVariables({ ...design, colors: { ...design.colors, sectionHeading: "#123456" } }, { sectionHeading: "#123456" }, "#7A1F3D")["--einfach-section-heading"]).toBe("#123456");
  });

  it.each([undefined, 18])("breaks a long career entry between bullets like Word, preview = PDF (margin %s)", (margin) => {
    const profile = longEntryProfile();
    const output = renderCv("einspaltig", profile, margin === undefined ? {} : withDesign({ spacing: { pageMarginMm: margin } }));
    const plan = output.resolved.pagePlan;
    const long = profile.experiences[0];
    const parts = plan.flatMap((page) => page.items.filter((item) => item.id === long.id).map((item) => ({ page: page.pageNumber, ...item.bullets! })));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toMatchObject({ page: 1, from: 0 });
    expect(parts[1]).toMatchObject({ page: 2, from: parts[0].to });
    const expected = resolveExperience(long).bullets.concat(resolveExperience(profile.experiences[1]).bullets);
    for (const surface of ["previewPages", "pdfPages"] as const) {
      const all = output[surface].flatMap(bulletsOf);
      for (const bullet of expected) expect(all.filter((text) => text === bullet), `${surface} ${bullet}`).toHaveLength(1);
      expect(all).toHaveLength(expected.length);
      const second = output[surface][1];
      expect(second.querySelector('[data-managed-section="experience"] article h3')?.textContent).toContain("· Fortsetzung");
      expect(second.querySelector('[data-managed-section="experience"] > :is(h2,h3)')?.textContent).toContain("Fortsetzung");
    }
    expect(output.previewPages.map(bulletsOf)).toEqual(output.pdfPages.map(bulletsOf));
  });
});
