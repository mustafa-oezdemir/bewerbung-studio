import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderCv } from "../../__parityHarness";
import { profileSchema, type ApplicantProfile } from "../../../../shared/schema";
import { getTemplateDocumentDesignDefaults, resolveCvDesign } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { getPaginationGeometry } from "../../../../shared/resumePaginationGeometry";
import {
  estimateTabellarischContinuationTop, getTabellarischDesignVariables, resolveTabellarischGeometry,
} from "../../../../shared/tabellarischDesign";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { harnessApplication } from "../../__parityHarness";
import { tabellarischDefaults } from "./tabellarisch.defaults";

const uid = (index: number) => `7e000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const now = "2026-10-12T10:00:00.000Z";
const bullet = (station: number, index: number) =>
  `Station ${station}, Aufgabe ${index + 1}: Planung und Koordination der Abläufe mit den beteiligten Fachbereichen`;

/**
 * Fictional profile like the reported one: three stations (the oldest is Transportpilot), then four Bildungsweg entries,
 * certificates and languages. Before the fix page one ended below the Transportpilot with ~66 mm free and the whole
 * Bildungsweg went to page two.
 */
const pilotProfile = (extra: Record<string, unknown> = {}) => profileSchema.parse({
  id: uid(1), isDefault: true, updatedAt: now, firstName: "Mira", lastName: "Beispiel",
  title: "Softwareentwicklerin | Fachinformatikerin für Anwendungsentwicklung",
  email: "mira.beispiel@example.org", phone: "+49 170 1234567", city: "Musterstadt",
  summary: "Softwareentwicklerin mit Erfahrung in der Entwicklung von Webanwendungen, der Prozessplanung und der Koordination "
    + "sicherheitskritischer Abläufe. Strukturierte Arbeitsweise, analytisches Denken und Freude an der Zusammenarbeit im Team. "
    + "Erfahrung mit PHP, Laravel, Symfony, JavaScript und relationalen Datenbanken sowie mit agilen Methoden.",
  strengths: [{ id: uid(2), title: "PHP", description: "" }, { id: uid(3), title: "Laravel", description: "" }, { id: uid(4), title: "Symfony", description: "" }],
  experiences: [
    { id: uid(10), from: "11/2024", to: "06/2025", role: "Praktikum als Anwendungsentwicklerin", company: "Universitätsstadt Muster", city: "Musterstadt",
      tasks: [], achievements: Array.from({ length: 4 }, (_, index) => bullet(1, index)) },
    { id: uid(11), from: "12/2018", to: "03/2019", role: "Prozessplanerin", company: "Beispiel Textil AG", city: "Musterstadt",
      tasks: [], achievements: Array.from({ length: 2 }, (_, index) => bullet(2, index)) },
    { id: uid(12), from: "12/2014", to: "11/2018", role: "Transportpilotin", company: "Luftfahrtbereich", city: "Musterstadt",
      tasks: [], achievements: ["Einsatzplanung, Briefings und Koordination operativer Einsätze", "Hohe Verantwortung in sicherheitskritischen Situationen",
        "Teamführung und präzise Entscheidungsfindung unter Zeitdruck"] },
  ],
  education: Array.from({ length: 4 }, (_, index) => ({
    id: uid(20 + index), from: `20${String(8 + index * 3).padStart(2, "0")}`, to: `20${String(11 + index * 3).padStart(2, "0")}`,
    degree: ["Fachinformatikerin für Anwendungsentwicklung", "Integrationskurs", "Ausbildung zur Transportpilotin", "Industrieingenieurwesen"][index],
    institution: ["Beispiel Akademie GmbH", "Volkshochschule Muster", "Beispiel Luftfahrtschule", "Beispiel Hochschule"][index], city: "Musterstadt",
  })),
  certifications: ["Full-Stack JavaScript Developer", "Generative AI Engineering", "Data Architecture", "DevOps and Software Engineering"],
  languages: ["Deutsch – C1", "Englisch – B2", "Türkisch – Muttersprache"],
  resumeClosing: { showPlace: true, showDate: true, showSignature: false },
  ...extra,
});

const plan = (profile: ApplicantProfile, overrides: Record<string, unknown> = {}) => {
  const settings = { ...getTemplateDocumentDesignDefaults("tabellarisch"), resumeOutputMode: "visual" as const, ...overrides };
  return resolveCvDocument({ profile, templateId: "tabellarisch", settings, application: harnessApplication("tabellarisch", settings) }).pagePlan;
};
const itemsOn = (pages: ReturnType<typeof plan>, kind: "experience" | "education") =>
  pages.map((page) => page.items.filter((item) => item.kind === kind).map((item) => item.id));
const bulletsOf = (page: Element) => Array.from(page.querySelectorAll('[data-managed-section="experience"] li')).map((node) => (node.textContent ?? "").trim());

describe("Tabellarisch: one geometry for preview, PDF and planner", () => {
  it("derives the bottom boundary of the text from the margins (no fixed limit): 297 − 14 − 5 mm", () => {
    const geometry = resolveTabellarischGeometry();
    const { page, margins, layout } = tabellarischDefaults;
    expect(geometry.contentBottom).toBe(page.heightMm - margins.bottomMm - layout.footerClearanceMm);
    expect(geometry).toMatchObject({ left: 15, right: 15, top: 15, bottom: 14, contentWidth: 180, timelineWidth: 130, bulletWidth: 125 });
    expect(getPaginationGeometry("tabellarisch").limit).toBe(geometry.contentBottom);
    // Seitenränder moves only the left and right edge.
    expect(resolveTabellarischGeometry(10)).toMatchObject({ left: 10, right: 10, top: 15, bottom: 14, contentBottom: geometry.contentBottom, contentWidth: 190 });
  });

  it("feeds both surfaces from the resolved design, typography and spacing included", () => {
    const overrides = { cvOverrides: { typography: { bodySizePt: 10, lineHeight: 1.3 }, spacing: { sectionGapMm: 4, entryGapMm: 2.5, pageMarginMm: 18 } } };
    const output = renderCv("tabellarisch", pilotProfile(), { overrides });
    const expected = getTabellarischDesignVariables(resolveCvDesign("tabellarisch", overrides.cvOverrides));
    expect(expected).toMatchObject({ "--tabellarisch-body-size": "10pt", "--tabellarisch-line-height": "1.3", "--tabellarisch-section-gap": "4mm",
      "--tabellarisch-entry-gap": "2.5mm", "--tabellarisch-margin-left": "18mm", "--tabellarisch-margin-right": "18mm", "--tabellarisch-margin-top": "15mm" });
    const roots = [...output.previewPages.map((page) => page.querySelector(".tabellarisch-template")), ...output.pdfPages.map((page) => page.querySelector(".tabellarisch-pdf"))];
    expect(roots.every(Boolean)).toBe(true);
    for (const root of roots) for (const [name, value] of Object.entries(expected)) expect(root?.getAttribute("style"), name).toContain(`${name}:${value}`);
    // The generic line-height rule (it would also reach labels such as the date) stays off: the reading text follows the variable.
    for (const page of [...output.previewPages, ...output.pdfPages]) expect(page.querySelector("[data-resume-spacing-line-height]")).toBeNull();
  });

  it("gives both surfaces the same central colours (the PDF reads the preview's variable names)", () => {
    const colors = { accent: "#aa1155", divider: "#11aa55", text: "#222266", muted: "#776655", sectionHeading: "#335577" };
    const output = renderCv("tabellarisch", pilotProfile(), { overrides: { cvOverrides: { colors } } });
    const style = (node: Element | null) => node?.getAttribute("style") ?? "";
    const roots = [...output.previewPages.map((page) => page.querySelector(".tabellarisch-template")), ...output.pdfPages.map((page) => page.querySelector(".tabellarisch-pdf"))];
    for (const root of roots) {
      for (const expected of ["--tabellarisch-accent:#aa1155", "--tabellarisch-line:#11aa55", "--tabellarisch-text:#222266", "--tabellarisch-muted:#776655",
        "--tabellarisch-section-title-color:#335577"]) expect(style(root)).toContain(expected);
    }
    const pdf = buildDocumentHtml(harnessApplication("tabellarisch"), pilotProfile(), "lebenslauf");
    // Rail, dots and section titles follow the variables on the PDF too (they used to read --tab-* names of their own).
    expect(pdf).toContain(".tabellarisch-pdf-rail:before{position:absolute;top:2.5mm;bottom:-1mm;left:50%;width:.35mm;background:var(--tabellarisch-line)");
    expect(pdf).toContain(":is(.tabellarisch-template,.tabellarisch-pdf) [data-managed-section]>:is(h2,h3){color:var(--tabellarisch-section-title-color");
  });

  it("draws name and entry titles in the primary colour and the entry details as bullets in the preview, as the PDF does", () => {
    // The preview paper sits under app.css: `.document-paper h1/h2/h3` (0,1,1) colours every heading and the reset
    // removes list bullets; the PDF's `.tabellarisch-pdf-entry h3` and plain `ul` have neither problem.
    const appCss = readFileSync("src/app.css", "utf8");
    expect(appCss).toMatch(/\.document-paper h1,\s*\.document-paper h2,\s*\.document-paper h3 \{\s*color: var\(--doc-heading-color\)/);
    const preview = readFileSync("src/components/resume/templates/tabellarisch/tabellarisch.css", "utf8").replace(/\s+/g, " ");
    expect(preview).toContain(".tabellarisch-template .tabellarisch-header__name, .tabellarisch-template .tabellarisch-timeline-entry__role { color: var(--tabellarisch-primary);");
    expect(preview).toContain(".tabellarisch-template .tabellarisch-timeline-entry__achievements { list-style: disc outside; }");
    const pdf = buildDocumentHtml(harnessApplication("tabellarisch"), pilotProfile(), "lebenslauf");
    expect(pdf).toContain(".tabellarisch-pdf-entry h3{margin:0;color:var(--tabellarisch-primary)");
    expect(pdf).not.toMatch(/\.tabellarisch-pdf-entry ul[^{]*\{[^}]*list-style:none/);
  });

  it("lets the central design reach the stylesheets: no floors, no density variants, one bottom padding", () => {
    const preview = readFileSync("src/components/resume/templates/tabellarisch/tabellarisch.css", "utf8");
    const pdf = buildDocumentHtml(harnessApplication("tabellarisch"), pilotProfile(), "lebenslauf");
    const pdfCss = pdf.slice(pdf.indexOf(".tabellarisch-pdf-contact[data-contact-kind"), pdf.indexOf("@media print{.no-print-background .tabellarisch-pdf-background"));
    for (const css of [preview, pdfCss]) {
      expect(css).not.toMatch(/(?<!min)max\(/);
      expect(css).not.toMatch(/data-density="(compact|dense)"/);
      expect(css).not.toContain("--doc-section-gap");
      expect(css).not.toContain("--tab-");
    }
    expect(preview).toContain("calc(var(--tabellarisch-margin-bottom) + var(--tabellarisch-footer-clearance))");
    expect(pdfCss).toContain("calc(var(--tabellarisch-margin-bottom) + var(--tabellarisch-footer-clearance))");
    // Certificate rows are spaced alike on both surfaces (and in the planner's model).
    expect(preview).toMatch(/\.tabellarisch-list-section li \{[^}]*margin: 0\.45mm 0;[^}]*padding-left: 0\.5mm;/);
    expect(pdfCss).toContain(".tabellarisch-pdf-list li,.tabellarisch-pdf-ats li{margin:.45mm 0;padding-left:.5mm");
    // A long résumé gets more pages, never smaller text or margins.
    const experiences = Array.from({ length: 6 }, (_, station) => ({ id: uid(60 + station), from: "01/2010", to: "01/2012",
      role: `Station ${station}`, company: "Beispiel GmbH", city: "Musterstadt", tasks: [], achievements: Array.from({ length: 8 }, (_, index) => bullet(station, index)) }));
    for (const page of plan(pilotProfile({ experiences }))) expect(page.density).toBe("standard");
  });
});

describe("Tabellarisch flows like a Word document", () => {
  it("keeps the Bildungsweg on page one below the Transportpilot when it has room (the reported gap)", () => {
    const pages = plan(pilotProfile());
    expect(itemsOn(pages, "experience")[0]).toEqual([uid(10), uid(11), uid(12)]);
    // The section starts on page one and goes on on page two: it is not moved as a whole.
    expect(itemsOn(pages, "education")[0].length).toBeGreaterThanOrEqual(1);
    expect(itemsOn(pages, "education").flat()).toEqual([uid(20), uid(21), uid(22), uid(23)]);
    expect(pages[0].fill?.main).toBeGreaterThan(0.9);
    expect(pages).toHaveLength(2);
  });

  it("keeps the room for the closing on the last page only", () => {
    const signature = `data:image/png;base64,${readFileSync("scripts/fixtures/qa-photo.b64", "utf8").trim()}`;
    const plain = plan(pilotProfile());
    const signed = plan(pilotProfile({ signaturePath: signature, resumeClosing: { showPlace: true, showDate: true, showSignature: true } }));
    expect(signed[0].items).toEqual(plain[0].items);
    expect(signed[0].blocks).toEqual(plain[0].blocks);
  });

  it("starts later pages under the compact head: name, Berufsbezeichnung and the chosen contacts", () => {
    const base = { name: "Mira Beispiel", title: "Softwareentwicklerin", pageMarginMm: undefined, sectionGapMm: 6.3 };
    // 15 mm margin, 13 pt name (1.15), 2.5 mm padding, 0.35 mm rule, then the larger of the 6 mm gap and the section gap.
    expect(estimateTabellarischContinuationTop({ ...base, contacts: [] })).toBeCloseTo(15 + 13 * 25.4 / 72 * 1.15 + 2.85 + 6.3, 1);
    expect(estimateTabellarischContinuationTop({ ...base, contacts: ["mira@example.org", "+49 170 1234567"] }))
      .toBeGreaterThan(estimateTabellarischContinuationTop({ ...base, contacts: [] }));
    expect(estimateTabellarischContinuationTop({ ...base, contacts: [], sectionGapMm: 3 })).toBeCloseTo(15 + 13 * 25.4 / 72 * 1.15 + 2.85 + 6, 1);
    const output = renderCv("tabellarisch", pilotProfile({ resumeContinuationContactVisibility: { email: true, phone: false } }));
    expect(output.pdfPages.length).toBeGreaterThan(1);
    for (const [surface, pages, head] of [["preview", output.previewPages, ".tabellarisch-continuation-header"], ["pdf", output.pdfPages, ".tabellarisch-pdf-continuation"]] as const) {
      const later = pages[1];
      expect(later.querySelector(head), surface).not.toBeNull();
      expect(later.querySelector(".tabellarisch-header,.tabellarisch-pdf-header"), surface).toBeNull();
      expect(later.querySelector(`${head} [data-resume-header-extra-contact]`)?.textContent, surface).toContain("mira.beispiel@example.org");
      expect(later.querySelector(head)?.textContent, surface).not.toContain("1234567");
    }
  });

  it("breaks a long entry between bullets: every bullet once, alike in preview and PDF", () => {
    const long = pilotProfile({
      experiences: [{ id: uid(40), from: "01/2015", to: "12/2024", role: "Projektleiterin", company: "Beispiel Werke GmbH", city: "Musterstadt",
        tasks: [], achievements: Array.from({ length: 40 }, (_, index) => bullet(9, index)) }],
    });
    const pages = plan(long);
    const parts = pages.flatMap((page) => page.items.filter((item) => item.id === uid(40)));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].bullets?.from).toBe(0);
    for (let index = 1; index < parts.length; index += 1) expect(parts[index].bullets?.from).toBe(parts[index - 1].bullets?.to);
    expect(parts.at(-1)?.bullets?.to).toBe(40);
    const output = renderCv("tabellarisch", long);
    const preview = output.previewPages.map(bulletsOf);
    const pdf = output.pdfPages.map(bulletsOf);
    expect(preview).toEqual(pdf);
    const all = preview.flat();
    expect(new Set(all).size).toBe(40);
    expect(all).toHaveLength(40);
    // After the entry the Bildungsweg follows on the same page, behind one section gap: no page of its own.
    expect(itemsOn(pages, "education")[pages.length - 1].length).toBeGreaterThan(0);
  });

  it("breaks a long certificate list between two certificates, each once and in order on both surfaces", () => {
    const certificates = Array.from({ length: 90 }, (_, index) => `Fiktives Zertifikat ${String(index + 1).padStart(2, "0")} in Prozessplanung und Qualität`);
    const profile = pilotProfile({ certifications: certificates });
    const pages = plan(profile);
    const ranges = pages.map((page) => page.blockRanges?.certifications).filter(Boolean);
    expect(ranges.length).toBeGreaterThan(1);
    expect(ranges[0]?.from).toBe(0);
    for (let index = 1; index < ranges.length; index += 1) expect(ranges[index]?.from).toBe(ranges[index - 1]?.to);
    expect(ranges.at(-1)?.to).toBe(90);
    const output = renderCv("tabellarisch", profile);
    const listed = (pages: Element[]) => pages.map((page) => Array.from(page.querySelectorAll('[data-managed-section="certifications"] li')).map((node) => (node.textContent ?? "").trim()));
    expect(listed(output.previewPages)).toEqual(listed(output.pdfPages));
    expect(listed(output.pdfPages).flat()).toEqual(certificates);
    const continued = output.pdfPages.find((page) => (page.querySelector('[data-managed-section="certifications"] li')?.textContent ?? "").includes(certificates[ranges[1]!.from]));
    expect(continued?.querySelector('[data-managed-section="certifications"] :is(h2,h3)')?.textContent).toContain("Fortsetzung");
  });

  it("keeps the order of the sections over the pages", () => {
    const output = renderCv("tabellarisch", pilotProfile({ certifications: Array.from({ length: 30 }, (_, index) => `Fiktives Zertifikat ${index + 1}`) }));
    for (const pages of [output.previewPages, output.pdfPages]) {
      const order = pages.flatMap((page) => Array.from(page.querySelectorAll("[data-managed-section]")).map((node) => node.getAttribute("data-managed-section")));
      const first = [...new Set(order)];
      expect(first.indexOf("experience")).toBeLessThan(first.indexOf("education"));
      expect(first.indexOf("education")).toBeLessThan(first.indexOf("certifications"));
      expect(first.indexOf("certifications")).toBeLessThan(first.indexOf("languages"));
    }
  });

  it("follows the central Eintragsabstand and Abschnittsabstand in the plan", () => {
    const tight = plan(pilotProfile(), { cvOverrides: { spacing: { entryGapMm: 1, sectionGapMm: 3 } } });
    const loose = plan(pilotProfile(), { cvOverrides: { spacing: { entryGapMm: 9, sectionGapMm: 12 } } });
    expect(tight[0].items.length).toBeGreaterThan(loose[0].items.length);
  });
});
