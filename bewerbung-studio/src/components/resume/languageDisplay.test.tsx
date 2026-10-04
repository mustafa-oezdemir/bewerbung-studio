import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { languageDotTemplates, resolveLanguageLevelDisplay } from "../../features/languages/language-levels";
import { LanguageDisplayOptions } from "../languages/LanguageDisplayOptions";
import { maximalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

const on = { dots: true, level: true, description: true };
const languages = ["Deutsch – C1", "Türkisch – C2"];
const profileWith = (display: Record<string, boolean>, stored = languages) => maximalProfile({ languages: stored, resumeLanguageDisplay: display });

type Surface = "preview" | "pdf";
const surfaces: Surface[] = ["preview", "pdf"];

/** The Sprachen section of the surface: its text (without the title), the dots and the pieces the shared markup writes. */
const sectionOf = (templateId: string, profile: ReturnType<typeof maximalProfile>, surface: Surface, ats = false) => {
  const result = renderCv(templateId, profile, { ats });
  const pages = surface === "preview" ? result.previewPages : result.pdfPages;
  const section = pages.map((page) => page.querySelector('[data-managed-section="languages"]')).find(Boolean) as Element;
  expect(section, `${templateId} ${surface}: Sprachen section`).toBeTruthy();
  const copy = section.cloneNode(true) as Element;
  copy.querySelectorAll("h1,h2,h3,h4,style,script").forEach((node) => {
    if (/^Sprachen$/i.test((node.textContent ?? "").trim())) node.remove();
  });
  return {
    text: (copy.textContent ?? "").replace(/\s+/g, " ").trim(),
    dots: section.querySelectorAll('[role="img"][aria-label],[class*="dots"]').length,
    suffixes: Array.from(section.querySelectorAll(".resume-language-level")).map((node) => (node.textContent ?? "").replace(/\s+/g, " ")),
    descriptions: Array.from(section.querySelectorAll(".resume-language-description")).map((node) => (node.textContent ?? "").trim()),
  };
};

describe("language display settings", () => {
  it("keeps everything on for an older profile and fills missing keys", () => {
    expect(maximalProfile().resumeLanguageDisplay).toEqual(on);
    expect(maximalProfile({ resumeLanguageDisplay: { dots: false } }).resumeLanguageDisplay).toEqual({ dots: false, level: true, description: true });
    expect(resolveLanguageLevelDisplay("kaputt")).toEqual(on);
  });

  it("offers the three parts as checkboxes in the Lebenslauf panel", () => {
    const html = renderToStaticMarkup(<LanguageDisplayOptions profile={maximalProfile({ resumeLanguageDisplay: { dots: true, level: false, description: true } })} onChange={vi.fn()} />);
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    const boxes = Array.from(document.querySelectorAll("label")).map((label) => [label.textContent, label.querySelector("input")?.hasAttribute("checked")]);
    expect(boxes).toEqual([["Punkte", true], ["Niveau (z. B. C1)", false], ["Beschreibung (z. B. Verhandlungssicher)", true]]);
    expect(html).toContain("Gilt für die Lebenslauf-Vorlagen mit Sprachpunkten.");
    expect(html).toContain("Im ATS-Layout steht das Niveau immer als Text.");
  });
});

// Without dots every template writes the same single line, in the preview and in the PDF.
describe.each(resumeTemplateIds)("Sprachen in %s without Punkte", (templateId) => {
  const cases: Array<[string, Record<string, boolean>, string[], RegExp[]]> = [
    ["A) Niveau", { dots: false, level: true, description: false }, ["Deutsch – C1", "Türkisch – C2"], [/Verhandlungssicher/, /muttersprachlich/, / · /]],
    ["B) Niveau + Beschreibung", { dots: false, level: true, description: true }, ["Deutsch – C1 · Verhandlungssicher", "Türkisch – C2 · Annähernd muttersprachlich"], []],
    ["C) Beschreibung", { dots: false, level: false, description: true }, ["Deutsch – Verhandlungssicher", "Türkisch – Annähernd muttersprachlich"], [/C1/, /C2/, / · /]],
    ["D) nichts", { dots: false, level: false, description: false }, ["Deutsch", "Türkisch"], [/C1/, /C2/, /Verhandlungssicher/, /muttersprachlich/, / – /, / · /]],
  ];
  it.each(cases)("%s", (_name, display, expected, forbidden) => {
    for (const surface of surfaces) {
      const section = sectionOf(templateId, profileWith(display), surface);
      for (const line of expected) expect(section.text, `${surface}: ${line}`).toContain(line);
      for (const pattern of forbidden) expect(section.text, `${surface}: ${pattern}`).not.toMatch(pattern);
      expect(section.text, surface).not.toMatch(/\(C[12]\)|\(Verhandlungssicher\)/);
      expect(section.dots, `${surface}: no dot row`).toBe(0);
      expect(section.descriptions, surface).toEqual([]);
    }
  });

  it("is the same text in the preview and in the PDF for every combination", () => {
    for (const dots of [false, true]) for (const level of [false, true]) for (const description of [false, true]) {
      const profile = profileWith({ dots, level, description });
      const preview = sectionOf(templateId, profile, "preview");
      const pdf = sectionOf(templateId, profile, "pdf");
      expect(pdf.text, `dots ${dots} level ${level} description ${description}`).toBe(preview.text);
      expect(pdf.dots).toBe(preview.dots);
      expect(pdf.descriptions).toEqual(preview.descriptions);
    }
  });

  it("writes the level as text and draws no dots in the ATS layout, whatever is ticked", () => {
    for (const display of [{ dots: true, level: false, description: false }, on, { dots: false, level: false, description: false }]) {
      const preview = renderCv(templateId, profileWith(display), { ats: true });
      for (const [surface, pages] of [["preview", preview.previewPages], ["pdf", preview.pdfPages]] as const) {
        const section = pages.map((page) => page.querySelector('[data-managed-section="languages"]')).find(Boolean) as Element | undefined;
        const text = (section?.textContent ?? "").replace(/\s+/g, " ");
        expect(text, `${surface} ATS`).toContain("Deutsch – C1 (verhandlungssicher)");
        expect(text, `${surface} ATS`).toContain("Türkisch – C2 (annähernd muttersprachlich)");
        expect(section?.querySelectorAll('[role="img"],[class*="dots"]').length ?? 0, `${surface} ATS dots`).toBe(0);
        expect(text).not.toMatch(/Deutsch – C1 \(verhandlungssicher\)\s*(?:–|·)?\s*C1/);
      }
    }
  });
});

// Templates with level dots: the name line holds the level, the dots follow, the description sits behind them.
describe.each(languageDotTemplates)("Sprachen in %s with Punkte", (templateId) => {
  const cases: Array<[string, Record<string, boolean>, string[], string[], string[]]> = [
    ["E) Punkte + Niveau", { dots: true, level: true, description: false }, [" – C1", " – C2"], [], ["Verhandlungssicher", "muttersprachlich"]],
    ["F) Punkte + Niveau + Beschreibung", { dots: true, level: true, description: true }, [" – C1", " – C2"], ["Verhandlungssicher", "Annähernd muttersprachlich"], []],
    ["G) Punkte + Beschreibung", { dots: true, level: false, description: true }, [], ["Verhandlungssicher", "Annähernd muttersprachlich"], ["C1", "C2"]],
    ["H) nur Punkte", { dots: true, level: false, description: false }, [], [], ["C1", "C2", "Verhandlungssicher", "muttersprachlich"]],
  ];
  it.each(cases)("%s", (_name, display, suffixes, descriptions, absent) => {
    for (const surface of surfaces) {
      const section = sectionOf(templateId, profileWith(display), surface);
      expect(section.dots, `${surface}: one dot row per language`).toBe(2);
      expect(section.suffixes, surface).toEqual(suffixes);
      expect(section.descriptions, surface).toEqual(descriptions);
      expect(section.text, surface).toContain("Deutsch");
      expect(section.text, surface).toContain("Türkisch");
      for (const word of absent) expect(section.text, `${surface}: ${word}`).not.toContain(word);
      // the level and its words are never glued together
      expect(section.text, surface).not.toMatch(/C1 · Verhandlungssicher|C2 · Annähernd/);
    }
  });

  it("removes the dots from the document when Punkte is off", () => {
    for (const surface of surfaces) {
      const section = sectionOf(templateId, profileWith({ dots: false, level: true, description: true }), surface);
      expect(section.dots, surface).toBe(0);
      expect(section.suffixes, surface).toEqual([" – C1 · Verhandlungssicher", " – C2 · Annähernd muttersprachlich"]);
      expect(section.descriptions, surface).toEqual([]);
    }
  });
});

describe("Klassisch", () => {
  it("writes Deutsch – C1, never Deutsch (C1)", () => {
    for (const surface of surfaces) {
      const noDots = sectionOf("klassisch", profileWith({ dots: false, level: true, description: false }), surface);
      expect(noDots.text, surface).toContain("Deutsch – C1");
      expect(noDots.text, surface).not.toMatch(/Deutsch \(C1\)|\(C1\)/);
      const full = sectionOf("klassisch", profileWith({ dots: false, level: true, description: true }), surface);
      expect(full.text, surface).toContain("Deutsch – C1 · Verhandlungssicher");
      expect(full.text, surface).toContain("Türkisch – C2 · Annähernd muttersprachlich");
      // With Punkte Klassisch draws the dots like the other templates: name – level, dots, description.
      const ticked = sectionOf("klassisch", profileWith(on), surface);
      expect(ticked.suffixes, surface).toEqual([" – C1", " – C2"]);
      expect(ticked.descriptions, surface).toEqual(["Verhandlungssicher", "Annähernd muttersprachlich"]);
      expect(ticked.dots, surface).toBe(2);
    }
  });
});

describe("Klassisch list width", () => {
  const widths = (display: Record<string, boolean>) => {
    const result = renderCv("klassisch", profileWith(display));
    return {
      preview: result.previewPages.some((page) => page.querySelector(".klassisch-languages--wide")),
      pdf: result.pdfPages.some((page) => page.querySelector(".klassisch-pdf-languages--wide")),
    };
  };
  it("spans the page for long lines, so Deutsch – C1 · Verhandlungssicher stays in one line", () => {
    expect(widths({ dots: false, level: true, description: true })).toEqual({ preview: true, pdf: true });
    expect(widths({ dots: false, level: true, description: false })).toEqual({ preview: false, pdf: false });
    // with dots the first line is short: the list keeps its two columns
    expect(widths(on)).toEqual({ preview: false, pdf: false });
  });
});

describe("Tabellarisch", () => {
  it("does not print the stored language text around the settings", () => {
    for (const surface of surfaces) {
      const withWords = sectionOf("tabellarisch", profileWith({ dots: false, level: true, description: true }), surface);
      expect(withWords.text, surface).toContain("Deutsch – C1 · Verhandlungssicher");
      const withoutWords = sectionOf("tabellarisch", profileWith({ dots: false, level: true, description: false }), surface);
      expect(withoutWords.text, surface).toContain("Deutsch – C1");
      expect(withoutWords.text, surface).not.toContain("Verhandlungssicher");
      const names = sectionOf("tabellarisch", profileWith({ dots: true, level: false, description: false }), surface);
      expect(names.text, surface).not.toMatch(/C1|C2/);
    }
  });
});

describe("Pehlione", () => {
  it.each(["pehlione_white", "pehlione_white_blue"])("%s follows Niveau and Beschreibung, not the stored text", (templateId) => {
    for (const surface of surfaces) {
      const full = sectionOf(templateId, profileWith({ dots: true, level: true, description: true }), surface);
      expect(full.text, surface).toContain("Deutsch – C1");
      expect(full.descriptions, surface).toContain("Verhandlungssicher");
      expect(full.dots, surface).toBe(2);
      const noWords = sectionOf(templateId, profileWith({ dots: true, level: true, description: false }), surface);
      expect(noWords.text, surface).toContain("Deutsch – C1");
      expect(noWords.text, surface).not.toContain("Verhandlungssicher");
      expect(sectionOf(templateId, profileWith({ dots: true, level: false, description: false }), surface).text, surface).not.toMatch(/C1|C2/);
    }
  });
});

describe("older and special stored languages", () => {
  const stored = ["Deutsch – C1 (Verhandlungssicher)", "Englisch – Verhandlungssicher", "Türkisch – Muttersprache"];
  it.each(["pehlione_white", ...languageDotTemplates])("%s shows them once and naturally", (templateId) => {
    for (const surface of surfaces) {
      const section = sectionOf(templateId, profileWith(on, stored), surface);
      expect(section.text, surface).not.toMatch(/C1 · C1|Verhandlungssicher · Verhandlungssicher|\(C1\) – C1|Verhandlungssicher\)/);
      expect((section.text.match(/Verhandlungssicher/g) ?? []).length, `${surface}: once per language`).toBeLessThanOrEqual(2);
      expect(section.text, surface).not.toContain("C2 · Muttersprache");
      expect(section.text, surface).toContain("Muttersprache");
      expect(section.text, surface).not.toMatch(/(?:–|·)\s*(?:–|·)|(?:–|·)\s*$/);
    }
  });
});
