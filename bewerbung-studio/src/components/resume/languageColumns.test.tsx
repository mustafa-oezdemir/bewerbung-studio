import { describe, expect, it } from "vitest";
import { maximalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

const profile = maximalProfile({
  languages: ["Deutsch – C1", "Türkisch – C2", "Englisch – B2", "Französisch – B1"],
  resumeLanguageDisplay: { dots: true, level: true, description: true },
});

const grid = (pages: Element[]) => pages.map((page) => page.querySelector('[data-managed-section="languages"] .resume-language-grid')).find(Boolean) as Element;

/** Where every template draws its Sprachen by itself, and whether the section can be moved to the other column. */
const singleColumnTemplates = ["einspaltig", "klassisch", "ivy-league", "tabellarisch"];
const sidebarTemplates = ["elegant", "gepflegt", "kreativ", "modern", "pehlione_white", "pehlione_white_blue", "stilvoll", "tuerkis-profil", "zeitgenoessisch", "zweispaltig"];
/** The section list of the Lebenslauf with Sprachen in that column (Haupt-/Seitenspalte of the section manager). */
const placed = (templateId: string, zone: "main" | "sidebar", extra: Record<string, unknown> = {}) =>
  maximalProfile({ ...extra, resumeManagerLayouts: { [templateId]: [{ id: "languages", zone }] } });
/** Every Sprachen grid of both outputs: its column count as the attribute and as the CSS variable the grid is drawn with. */
const columnsOf = (result: ReturnType<typeof renderCv>) => [result.previewPages, result.pdfPages].map((pages) => {
  const grids = pages.flatMap((page) => Array.from(page.querySelectorAll('[data-managed-section="languages"] .resume-language-grid')));
  expect(grids.length).toBeGreaterThan(0);
  for (const node of grids) expect(node.getAttribute("style")).toContain(`--language-columns:${node.getAttribute("data-columns")}`);
  return [...new Set(grids.map((node) => node.getAttribute("data-columns")))].join(",");
});

describe("automatic Sprachen columns follow the column the section stands in", () => {
  const languageSets: Array<[string, string[]]> = [
    ["two", ["Deutsch – Verhandlungssicher", "Englisch – B2"]],
    ["three", ["Deutsch – C1", "Englisch – B2", "Türkisch – Muttersprache"]],
    ["four", ["Deutsch – C1", "Türkisch – C2", "Englisch – B2", "Französisch – B1"]],
    ["a long name", ["Deutsch – C1", "Bosnisch-Kroatisch-Serbisch – B1", "Englisch – B2"]],
  ];

  it.each(singleColumnTemplates)("uses three columns in the Hauptbereich of %s, also for two languages", (templateId) => {
    for (const [name, languages] of languageSets)
      expect(columnsOf(renderCv(templateId, maximalProfile({ languages }))), name).toEqual(["3", "3"]);
  });

  it.each(sidebarTemplates)("uses one column in the Seitenspalte of %s and three once the section stands in the Hauptbereich", (templateId) => {
    for (const [name, languages] of languageSets) {
      expect(columnsOf(renderCv(templateId, maximalProfile({ languages }))), `${name}: where the template draws it`).toEqual(["1", "1"]);
      expect(columnsOf(renderCv(templateId, placed(templateId, "sidebar", { languages }))), `${name}: Seitenspalte`).toEqual(["1", "1"]);
      expect(columnsOf(renderCv(templateId, placed(templateId, "main", { languages }))), `${name}: Hauptbereich`).toEqual(["3", "3"]);
    }
  });

  it("decides by the place, not by the template: Kompakt draws Sprachen in its main column", () => {
    for (const [name, languages] of languageSets) {
      expect(columnsOf(renderCv("kompakt", maximalProfile({ languages }))), name).toEqual(["3", "3"]);
      expect(columnsOf(renderCv("kompakt", placed("kompakt", "sidebar", { languages }))), `${name}: Seitenspalte`).toEqual(["1", "1"]);
    }
  });

  it.each(["klassisch", "kompakt", "zweispaltig", "modern", "pehlione_white"])("keeps the columns the user picked in %s, in either column", (templateId) => {
    for (const zone of ["main", "sidebar"] as const) for (const count of [1, 2, 3, 4] as const)
      expect(columnsOf(renderCv(templateId, placed(templateId, zone), { overrides: { languagesColumns: count } })), `${zone} ${count}`)
        .toEqual([String(count), String(count)]);
  });

  it("covers every template", () => {
    expect([...singleColumnTemplates, ...sidebarTemplates, "kompakt"].sort()).toEqual([...resumeTemplateIds].sort());
  });
});

describe("Sprachen that show only the dots of a level", () => {
  // The words of the stored level are not written again: Verhandlungssicher is C1 (five of six), B2 four.
  const stored = ["Deutsch – Verhandlungssicher", "Englisch – B2"];
  const filled = [5, 4];

  it.each(resumeTemplateIds)("draws name, dash and dots as one group in %s, in the preview and in the PDF", (templateId) => {
    const profile = maximalProfile({ languages: stored });
    expect(profile.resumeLanguageDisplay).toEqual({ dots: true, level: false, description: false });
    expect(profile.languages).toEqual(stored);
    const result = renderCv(templateId, profile);
    for (const pages of [result.previewPages, result.pdfPages]) {
      const cards = pages.flatMap((page) => Array.from(page.querySelectorAll('[data-managed-section="languages"] .resume-language-grid > .resume-language-item')));
      expect(cards).toHaveLength(2);
      cards.forEach((card, index) => {
        const name = stored[index].split(" – ")[0];
        expect(card.className).toContain("resume-language-item--compact");
        // one child: the name's line, which the dash and the dots continue
        expect(Array.from(card.children).map((child) => child.className.includes("resume-language-primary"))).toEqual([true]);
        const primary = card.children[0];
        expect(primary.querySelector("strong")?.textContent).toBe(name);
        const meter = primary.querySelector(":scope > .resume-language-meter")!;
        expect(Array.from(meter.children).map((child) => child.hasAttribute("data-resume-language-dots") ? "dots" : child.className)).toEqual(["resume-language-separator", "dots"]);
        expect(meter.children[0].textContent).toBe("–");
        expect(meter.children[0].getAttribute("aria-hidden")).toBe("true");
        const dots = meter.children[1];
        expect(dots.children).toHaveLength(6);
        expect(dots.querySelectorAll(".filled"), `${name}: filled dots`).toHaveLength(filled[index]);
        expect(Array.from(dots.children).map((mark) => mark.classList.contains("filled")), `${name}: filled dots first`)
          .toEqual(Array.from({ length: 6 }, (_, dot) => dot < filled[index]));
        expect(dots.getAttribute("aria-label")).toContain(name);
        // nothing of the level is written beside the dots
        expect(card.textContent?.replace(/\s+/g, " ").trim()).toBe(`${name} –`);
        expect(card.querySelector(".resume-language-level,.resume-language-description")).toBeNull();
      });
    }
  });

  it("keeps the row of a written level or description as it was", () => {
    for (const display of [{ dots: true, level: true, description: false }, { dots: true, level: false, description: true }, { dots: true, level: true, description: true }]) {
      const result = renderCv("zweispaltig", maximalProfile({ languages: stored, resumeLanguageDisplay: display }));
      for (const pages of [result.previewPages, result.pdfPages]) {
        const cards = Array.from(grid(pages).querySelectorAll(":scope > .resume-language-item"));
        expect(cards).toHaveLength(2);
        for (const card of cards) {
          expect(card.className).not.toContain("resume-language-item--compact");
          expect(card.querySelector(".resume-language-separator,.resume-language-meter")).toBeNull();
          // the dots are the row's own child, beside the name line
          expect(card.querySelector(":scope > [data-resume-language-dots]")).toBeTruthy();
        }
      }
    }
  });

  it("keeps the level readable as text in the ATS layout", () => {
    for (const templateId of resumeTemplateIds) {
      const result = renderCv(templateId, maximalProfile({ languages: stored }), { ats: true });
      for (const pages of [result.previewPages, result.pdfPages]) {
        const section = pages.map((page) => page.querySelector('[data-managed-section="languages"]')).find(Boolean) as Element;
        expect(section, templateId).toBeTruthy();
        const text = (section.textContent ?? "").replace(/\s+/g, " ");
        expect(text, templateId).toContain("Deutsch – Verhandlungssicher (C1)");
        expect(text, templateId).toContain("Englisch – B2 (fließend)");
        expect(section.querySelector("[data-resume-language-dots],.resume-language-separator,.resume-language-meter"), templateId).toBeNull();
      }
    }
  });
});

describe("Sprachen columns in preview and PDF", () => {
  it.each(resumeTemplateIds)("uses the same language cards in %s for auto, one and two columns", (templateId) => {
    for (const mode of ["auto", 1, 2] as const) {
      const result = renderCv(templateId, profile, { overrides: { languagesColumns: mode } });
      const preview = grid(result.previewPages);
      const pdf = grid(result.pdfPages);
      expect(preview, `${templateId} preview`).toBeTruthy();
      expect(pdf, `${templateId} PDF`).toBeTruthy();
      expect(pdf.getAttribute("data-columns")).toBe(preview.getAttribute("data-columns"));
      if (mode !== "auto") expect(preview.getAttribute("data-columns")).toBe(String(mode));
      // A list the sidebar lane breaks between two pages is read across its parts (each language once, in order).
      for (const pages of [result.previewPages, result.pdfPages]) {
        const cards = pages.flatMap((page) => Array.from(page.querySelectorAll('[data-managed-section="languages"] .resume-language-grid > .resume-language-item')));
        expect(cards).toHaveLength(4);
        expect(cards.map((item) => item.querySelector(".resume-language-primary")?.textContent)).toEqual([
          "Deutsch – C1", "Türkisch – C2", "Englisch – B2", "Französisch – B1",
        ]);
        expect(cards.every((item) => item.querySelector("[data-resume-language-dots]") && item.querySelector(".resume-language-description"))).toBe(true);
        if (!templateId.startsWith("pehlione_"))
          for (const card of cards) expect(card.querySelector("[data-resume-language-dots]")?.className, `${templateId}: native dot style`).not.toBe("resume-language-dots");
      }
    }
  });

  it.each(["klassisch", "tabellarisch", "modern", "zeitgenoessisch", "zweispaltig", "elegant"])(
    "honors three and four columns in %s", (templateId) => {
      for (const count of [3, 4] as const) {
        const result = renderCv(templateId, profile, { overrides: { languagesColumns: count } });
        expect(grid(result.previewPages).getAttribute("data-columns")).toBe(String(count));
        expect(grid(result.pdfPages).getAttribute("data-columns")).toBe(String(count));
      }
    },
  );

  it("keeps ATS as one plain text column for every visual choice", () => {
    for (const count of [1, 2, 3, 4] as const) {
      const result = renderCv("klassisch", profile, { ats: true, overrides: { languagesColumns: count } });
      for (const pages of [result.previewPages, result.pdfPages]) {
        const section = pages.map((page) => page.querySelector('[data-managed-section="languages"]')).find(Boolean) as Element;
        expect(section.querySelector(".resume-language-grid")).toBeNull();
        expect(section.querySelector(".resume-language-ats")?.getAttribute("data-columns")).toBe("1");
        expect(section.textContent).toContain("Deutsch – C1 (verhandlungssicher)");
      }
    }
  });

  it("keeps a language without a level free of dots and empty punctuation", () => {
    const result = renderCv("klassisch", maximalProfile({ languages: ["Latein"] }), { overrides: { languagesColumns: 4 } });
    for (const pages of [result.previewPages, result.pdfPages]) {
      const card = grid(pages).querySelector(".resume-language-item")!;
      expect(card.querySelector(".resume-language-primary")?.textContent).toBe("Latein");
      expect(card.querySelector("[data-resume-language-dots]")).toBeNull();
    }
  });

  it("keeps a language without a level free of dash and dots beside languages that show only their dots", () => {
    const mixed = maximalProfile({ languages: ["Deutsch – C1", "Latein"] });
    expect(mixed.resumeLanguageDisplay).toEqual({ dots: true, level: false, description: false });
    for (const templateId of ["klassisch", "zweispaltig"]) {
      const result = renderCv(templateId, mixed);
      for (const pages of [result.previewPages, result.pdfPages]) {
        const [german, latin] = Array.from(grid(pages).querySelectorAll(":scope > .resume-language-item"));
        expect(german.querySelector(".resume-language-separator")?.textContent).toBe("–");
        expect(latin.textContent).toBe("Latein");
        expect(latin.className).not.toContain("resume-language-item--compact");
        expect(latin.querySelector(".resume-language-separator,.resume-language-meter,[data-resume-language-dots]")).toBeNull();
      }
    }
  });

  it("keeps a long sidebar language atomic in a four-track grid", () => {
    const longProfile = maximalProfile({ languages: [
      "Deutsch – C1", "Türkisch – C2", "Englisch – B2", "Französisch – B1", "Bosnisch-Kroatisch-Serbisch – C1",
    ] });
    const result = renderCv("pehlione_white", longProfile, { overrides: { languagesColumns: 4 } });
    for (const pages of [result.previewPages, result.pdfPages]) {
      const languageGrid = grid(pages);
      expect(languageGrid.getAttribute("data-columns")).toBe("4");
      const cards = languageGrid.querySelectorAll(":scope > .resume-language-item");
      expect(cards).toHaveLength(5);
      expect(cards[4].getAttribute("style")).toContain("grid-column:span 2");
    }
  });
});
