import { describe, expect, it } from "vitest";
import { languageDotTemplates, resolveLanguagePresentation, type LanguageLevelDisplay } from "../features/languages/language-levels";
import { languageBlockHeight } from "./languageBlockHeight";

const stored = ["Deutsch – C1", "Englisch – B2", "Türkisch – C2", "Französisch – A2", "Spanisch – B1", "Italienisch – C1"];
const rowsOf = (templateId: string, display: LanguageLevelDisplay, count = stored.length) =>
  stored.slice(0, count).map((raw) => resolveLanguagePresentation(raw, display, { dots: languageDotTemplates.includes(templateId as never) }));
const high = (templateId: string, display: LanguageLevelDisplay, column: number, count?: number) =>
  languageBlockHeight(templateId, rowsOf(templateId, display, count), { column, font: 1, textHeight: 1 }) as number;
const flags = (dots: boolean, level: boolean, description: boolean): LanguageLevelDisplay => ({ dots, level, description });

describe("language block height follows what is printed", () => {
  it("has a model for every active template", () => {
    for (const id of [...languageDotTemplates, "klassisch", "tabellarisch", "pehlione_white", "pehlione_white_blue"])
      expect(languageBlockHeight(id, rowsOf(id, flags(true, true, true)), { column: 60, font: 1, textHeight: 1 }), id).toBeGreaterThan(0);
    expect(languageBlockHeight("unbekannt", rowsOf("unbekannt", flags(true, true, true)), { column: 60, font: 1, textHeight: 1 })).toBeUndefined();
    expect(languageBlockHeight("modern", [], { column: 60, font: 1, textHeight: 1 })).toBe(0);
  });

  it("adds a description line only where the Beschreibung is shown behind the dots", () => {
    // Zweispaltig sidebar (65.74 mm): six languages measured in the PDF – 42.9 mm without, 64.0 mm with the description.
    expect(high("zweispaltig", flags(true, true, false), 65.74)).toBeCloseTo(42.9, 0);
    expect(high("zweispaltig", flags(true, true, true), 65.74)).toBeCloseTo(64, 0);
    expect(high("zweispaltig", flags(true, false, true), 65.74)).toBeCloseTo(64, 0);
    expect(high("zweispaltig", flags(true, false, false), 65.74)).toBeCloseTo(42.9, 0);
  });

  it("draws no extra dot row: the dots stand in the row of the name", () => {
    for (const id of ["zweispaltig", "modern", "kreativ", "stilvoll"])
      expect(high(id, flags(false, false, false), 66), id).toBeCloseTo(high(id, flags(true, false, false), 66), 1);
  });

  it("lets long one-line texts wrap in a narrow sidebar and not in a wide column", () => {
    const narrowShort = high("elegant", flags(false, true, false), 46);
    const narrowLong = high("elegant", flags(false, true, true), 46);
    expect(narrowLong).toBeGreaterThan(narrowShort + 6);
    const wideShort = high("kreativ", flags(false, true, false), 66.27);
    const wideLong = high("kreativ", flags(false, true, true), 66.27);
    expect(wideLong).toBeCloseTo(wideShort, 1);
  });

  it("sets grid templates in rows", () => {
    // Einspaltig: three languages per row; Ivy-League: up to three; Kompakt: two.
    const einspaltig = (count: number) => high("einspaltig", flags(true, true, false), 180, count);
    expect(einspaltig(3)).toBeCloseTo(einspaltig(1), 5);
    expect(einspaltig(4)).toBeGreaterThan(einspaltig(3) + 6);
    expect(einspaltig(6)).toBeCloseTo(einspaltig(4), 5);
    const kompakt = (count: number) => high("kompakt", flags(true, true, false), 108, count);
    expect(kompakt(2)).toBeCloseTo(kompakt(1), 5);
    expect(kompakt(3)).toBeGreaterThan(kompakt(2) + 5);
  });

  it("measures Tabellarisch as wrapping items, Klassisch as two columns", () => {
    // Tabellarisch (180 mm column, 84 mm list): short names fill one line, long lines of text one line each.
    expect(high("tabellarisch", flags(false, false, false), 180, 4)).toBeCloseTo(13.5, 0);
    expect(high("tabellarisch", flags(false, true, true), 180, 4)).toBeCloseTo(29.9, 0);
    // Klassisch (two columns, 11 pt): six names are three rows (title 8.43 mm, rows 4.85 mm, 1.5 mm apart).
    expect(high("klassisch", flags(false, false, false), 180)).toBeCloseTo(26, 0);
    // ... long lines span the page (no 112 mm cap any more); at 11 pt the longest still wraps once in its half-page cell.
    expect(high("klassisch", flags(false, true, true), 180)).toBeCloseTo(30.8, 0);
  });

  it("scales with the design", () => {
    const base = high("modern", flags(true, true, true), 67);
    const scaled = languageBlockHeight("modern", rowsOf("modern", flags(true, true, true)), { column: 67, font: 1, textHeight: 1.2 }) as number;
    expect(scaled).toBeCloseTo(base * 1.2, 5);
  });
});
