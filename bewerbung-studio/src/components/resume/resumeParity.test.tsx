import { describe, expect, it } from "vitest";
import { setResumeSectionTitle } from "../../features/resume-sections/resume-sections";
import { maximalProfile, minimalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

/** Every token of the profile that has to reach the Lebenslauf, by the field it comes from. */
export const maximalTokens: Record<string, string[]> = {
  identity: ["Mustafa", "Özdemir", "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung"],
  personal: ["Musterstraße 12", "35037 Marburg", "+49 170 1234567", "mustafa@example.com", "linkedin.com/in/mustafa-oezdemir", "github.com/mustafa-oezdemir", "mustafa-oezdemir.de",
    "xing.com/profile/Mustafa_Oezdemir", "gitlab.com/mustafa-oezdemir", "17.05.1990", "Ankara", "deutsch", "verheiratet", "2 Kinder"],
  summary: ["Plattformen und verlässlicher Zusammenarbeit"],
  career: ["11/2024 – heute", "Muster GmbH", "Vollzeit", "Entwicklung interner Plattformen", "Team mit 5 Personen", "Konzeption zentraler Funktionen", "Grafana-Datasource-Plugin",
    "Technologien: TypeScript, React, Grafana", "Open-Source-Veröffentlichung des Plugins", "07/2023 – 10/2024", "IAD GmbH", "Webanwendungen umgesetzt", "Ladezeit halbiert"],
  education: ["07/2023 – 11/2025", "Fachinformatiker für Anwendungsentwicklung", "Deutschland", "Anwendungsentwicklung", "1,8", "Abschlussprojekt: Monitoring-Plattform"],
  knowledge: ["Java", "Fortgeschrittene Kenntnisse", "4 Jahre", "Spring Boot und REST APIs"],
  languages: ["Englisch", "C1", "Deutsch", "Muttersprache"],
  certifications: ["03/2026", "Professional Scrum Master I", "Scrum.org"],
  strengths: ["Analytisches Denken"],
  interests: ["Fotografie", "Architektur- und Landschaftsfotografie"],
  custom: ["Eigene Projekte", "Open-Source-Plugin", "Grafana Community", "Remote", "2025", "Datasource für Monitoring-Daten", "Dokumentation veröffentlicht", "example.org/plugin"],
  closing: ["Marburg, 02.10.2026"],
};

describe.each(resumeTemplateIds)("maximal profile in %s", (templateId) => {
  const profile = maximalProfile();
  for (const mode of ["visual", "ats"] as const) {
    it(`reaches the preview and the PDF with every field (${mode})`, () => {
      const result = renderCv(templateId, profile, { ats: mode === "ats" });
      const missing: string[] = [];
      for (const [group, tokens] of Object.entries(maximalTokens))
        for (const token of tokens)
          for (const surface of ["preview", "pdf"] as const)
            if (!result[surface].includes(token)) missing.push(`${group}/${surface}: ${token}`);
      expect(missing).toEqual([]);
    });
  }

  it("draws the same sections and entries in the preview and the PDF", () => {
    const result = renderCv(templateId, profile);
    expect([...new Set(result.pdfSemantic.sections)].sort()).toEqual([...new Set(result.previewSemantic.sections)].sort());
    expect(result.pdfPages.length).toBe(result.previewPages.length);
  });
});

it.each(["modern", "elegant", "klassisch"])("renders selected project content and links equally in %s preview and PDF", templateId => {
  const base = minimalProfile();
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const profile = { ...base, specialSections: [{ id: crypto.randomUUID(), kind: "projects" as const, title: "Projekte", isVisible: true,
    entries: ids.map((id, index) => ({ id, title: `Beispielprojekt ${index + 1}`, subtitle: "", from: "", to: "", date: "", location: "",
      url: `https://example.com/project-${index + 1}`, technologies: ["Go"], description: `Beschreibung ${index + 1}`, bullets: [] })) }] };
  const result = renderCv(templateId, profile, { overrides: { resumePresentation: { selectedProjectEntryIds: [ids[1]] } } });
  for (const surface of ["preview", "pdf"] as const) {
    expect(result[surface]).toContain("Beispielprojekt 2");
    expect(result[surface]).not.toContain("Beispielprojekt 1");
    expect(result[surface]).not.toContain("Beispielprojekt 3");
  }
  expect(result.previewPages.length).toBe(result.pdfPages.length);
  expect(result.previewPages.flatMap(page => Array.from(page.querySelectorAll('a[href="https://example.com/project-2"]')))).toHaveLength(1);
  expect(result.pdfPages.flatMap(page => Array.from(page.querySelectorAll('a[href="https://example.com/project-2"]')))).toHaveLength(1);
});

const customTitles = {
  summary: "Über mich",
  strengths: "Meine Stärken",
  experience: "Praxiserfahrung",
  education: "Ausbildungsweg",
  knowledge: "Kompetenzen",
  languages: "Fremdsprachen",
  certifications: "Nachweise",
} as const;

describe.each(resumeTemplateIds)("section titles in %s", (templateId) => {
  it("prints every title the user chose, in the preview and the PDF, visual and ATS", () => {
    let profile = maximalProfile();
    for (const [type, title] of Object.entries(customTitles)) profile = setResumeSectionTitle(profile, type as keyof typeof customTitles, title);
    for (const ats of [false, true]) {
      const result = renderCv(templateId, profile, { ats });
      for (const surface of ["preview", "pdf"] as const) {
        // Pehlione draws its Stärken as the competency group: that group's own title (editable in the panel) applies.
        const expected = Object.entries(customTitles).filter(([type]) => !(templateId.startsWith("pehlione_") && type === "strengths")).map(([, title]) => title);
        const missing = expected.filter((title) => !result[surface].toLocaleLowerCase("de-DE").includes(title.toLocaleLowerCase("de-DE")));
        expect(missing, `${ats ? "ats" : "visual"} / ${surface}`).toEqual([]);
        for (const fixed of ["Beruflicher Werdegang", "Bildungsweg", "Kurzprofil"])
          expect(result[surface], `${ats ? "ats" : "visual"} / ${surface}: ${fixed}`).not.toContain(fixed);
      }
    }
  });
});

describe.each(resumeTemplateIds)("minimal profile in %s", (templateId) => {
  it("draws one page with no empty label, icon line or placeholder", () => {
    for (const ats of [false, true]) {
      const result = renderCv(templateId, minimalProfile(), { ats });
      expect(result.pdfPages, ats ? "ats" : "visual").toHaveLength(1);
      expect(result.previewPages, ats ? "ats" : "visual").toHaveLength(1);
      for (const surface of ["preview", "pdf"] as const) {
        const text = result[surface];
        expect(text).toContain("Mina Kaya");
        expect(text).toContain("Assistentin");
        for (const empty of ["Telefon:", "E-Mail:", "Geburtsort", "Familienstand", "Staatsangehörigkeit", "Kinder:", "Technologien:", "Note:", "undefined", "null", "ergänzen"])
          expect(text, `${surface}: ${empty}`).not.toContain(empty);
        expect(text, surface).not.toMatch(/·\s*·|:\s*$/);
      }
    }
  });
});

/**
 * A long, fictional Kurzprofil: 70 sentences, each ending with a unique token (K000 …), so lost, repeated or reordered
 * words show. It flows over several pages in the sidebar or the main column, depending on the template.
 */
const longSummary = Array.from({ length: 70 }, (_, index) =>
  `Fiktive Erfahrung in Analyse, Planung und Abstimmung K${String(index).padStart(3, "0")}.`).join(" ");
const summaryTokens = (page: Element) =>
  Array.from((page.querySelector('[data-managed-section="summary"]')?.textContent ?? "").replaceAll("\u00ad", "").matchAll(/K\d{3}/g), (match) => match[0]);
const columnOf = (node: Element) =>
  node.closest('aside,[data-cv-zone="sidebar"],[data-resume-layout-zone="sidebar"],.modern-resume-right-column,.modern-pdf-right,.kompakt-right') ? "sidebar" : "main";
/** The managed sections of one column of a page, in reading order. */
const columnSections = (page: Element, column: string, ats = false) =>
  Array.from(page.querySelectorAll("[data-managed-section]")).filter((node) => (ats ? "main" : columnOf(node)) === column)
    .map((node) => node.getAttribute("data-managed-section")!);

describe.each(resumeTemplateIds)("a Kurzprofil longer than a page in %s", (templateId) => {
  for (const ats of [false, true]) {
    it(`flows like a word processor in the preview and the PDF alike (${ats ? "ats" : "visual"})`, () => {
      const result = renderCv(templateId, maximalProfile({ summary: longSummary }), { ats });
      expect(result.previewPages).toHaveLength(result.pdfPages.length);
      const expected = Array.from({ length: 70 }, (_, index) => `K${String(index).padStart(3, "0")}`);
      for (const [surface, pages] of [["preview", result.previewPages], ["pdf", result.pdfPages]] as const) {
        // every word once, in order, across the pages
        expect(pages.flatMap(summaryTokens), surface).toEqual(expected);
        // a column never starts a section again once another one began: the Kurzprofil ends before the next section
        // starts (the plain layout is one column)
        for (const column of ["sidebar", "main"]) {
          const runs: string[] = [];
          for (const page of pages) for (const id of columnSections(page, column, ats)) if (runs.at(-1) !== id) runs.push(id);
          expect(runs.filter((id, index) => runs.indexOf(id) !== index), `${surface} ${column}: ${runs.join(" > ")}`).toEqual([]);
        }
      }
      // both surfaces break the text on the same pages and draw the same sections in the same columns (the plain
      // layout: the sections this flow places; Gepflegt's and Kompakt's plain PDF markup order or omit some others)
      const governed = (ids: string[]) => ats ? ids.filter((id) => ["summary", "strengths", "languages", "experience", "education"].includes(id)) : ids;
      result.pdfPages.forEach((page, index) => {
        expect(summaryTokens(result.previewPages[index]), `page ${index + 1}`).toEqual(summaryTokens(page));
        for (const column of ["sidebar", "main"])
          expect(governed(columnSections(result.previewPages[index], column, ats)), `page ${index + 1} ${column}`).toEqual(governed(columnSections(page, column, ats)));
      });
    });
  }
});
