import { describe, expect, it } from "vitest";
import {
  languageDotTemplates,
  resolveLanguagePresentation,
  templateDrawsLanguageDots,
  type LanguageLevelDisplay,
} from "./language-levels";

const display = (dots: boolean, level: boolean, description: boolean): LanguageLevelDisplay => ({ dots, level, description });
const text = (raw: string, d: LanguageLevelDisplay) => resolveLanguagePresentation(raw, d).primaryText;
const dotted = (raw: string, d: LanguageLevelDisplay) => resolveLanguagePresentation(raw, d, { dots: true });

describe("shared language presentation (Punkte, Niveau, Beschreibung)", () => {
  it("writes one line without dots: Sprache – Niveau · Beschreibung", () => {
    // A) Niveau only
    expect(text("Deutsch – C1", display(false, true, false))).toBe("Deutsch – C1");
    expect(text("Türkisch – C2", display(false, true, false))).toBe("Türkisch – C2");
    // B) Niveau and Beschreibung
    expect(text("Deutsch – C1", display(false, true, true))).toBe("Deutsch – C1 · Verhandlungssicher");
    expect(text("Türkisch – C2", display(false, true, true))).toBe("Türkisch – C2 · Annähernd muttersprachlich");
    // C) Beschreibung only: no GER code in the visual output
    expect(text("Deutsch – C1", display(false, false, true))).toBe("Deutsch – Verhandlungssicher");
    expect(text("Türkisch – C2", display(false, false, true))).toBe("Türkisch – Annähernd muttersprachlich");
    // D) nothing chosen: the name stays, without separators
    expect(text("Deutsch – C1", display(false, false, false))).toBe("Deutsch");
    expect(text("Türkisch – C2", display(false, false, false))).toBe("Türkisch");
  });

  it("uses the GER terms of the language editor for every level", () => {
    const words = ["Anfänger", "Grundlegende Kenntnisse", "Gute Kenntnisse", "Fließend", "Verhandlungssicher", "Annähernd muttersprachlich"];
    ["A1", "A2", "B1", "B2", "C1", "C2"].forEach((code, index) => {
      const language = resolveLanguagePresentation(`Englisch – ${code}`, display(false, true, true));
      expect(language.cefrLevel).toBe(code);
      expect(language.description).toBe(words[index]);
      expect(language.score).toBe(index + 1);
      expect(language.primaryText).toBe(`Englisch – ${code} · ${words[index]}`);
    });
  });

  it("with dots: name and level stay together, the dots are separate and the description follows them", () => {
    // E) Punkte + Niveau
    expect(dotted("Deutsch – C1", display(true, true, false))).toMatchObject({ showDots: true, primaryText: "Deutsch – C1", secondaryText: "", score: 5 });
    // F) Punkte + Niveau + Beschreibung
    expect(dotted("Deutsch – C1", display(true, true, true))).toMatchObject({ showDots: true, primaryText: "Deutsch – C1", secondaryText: "Verhandlungssicher" });
    // G) Punkte + Beschreibung: no C1
    expect(dotted("Deutsch – C1", display(true, false, true))).toMatchObject({ showDots: true, primaryText: "Deutsch", secondaryText: "Verhandlungssicher" });
    // H) only Punkte
    expect(dotted("Deutsch – C1", display(true, false, false))).toMatchObject({ showDots: true, primaryText: "Deutsch", secondaryText: "" });
    expect(dotted("Türkisch – C2", display(true, true, true))).toMatchObject({ primaryText: "Türkisch – C2", secondaryText: "Annähernd muttersprachlich", score: 6 });
  });

  it("draws dots only where the template has them and Punkte is ticked", () => {
    expect(resolveLanguagePresentation("Deutsch – C1", display(true, true, true), { dots: false }).showDots).toBe(false);
    expect(resolveLanguagePresentation("Deutsch – C1", display(false, true, true), { dots: true }).showDots).toBe(false);
    // A template without dots (Pehlione) shows Niveau and Beschreibung in one line whatever Punkte says.
    expect(resolveLanguagePresentation("Deutsch – C1", display(true, true, true), { dots: false }).primaryText).toBe("Deutsch – C1 · Verhandlungssicher");
    expect(languageDotTemplates).toHaveLength(12);
    ["pehlione_white", "pehlione_white_blue"].forEach((id) => expect(templateDrawsLanguageDots(id)).toBe(false));
    ["klassisch", "tabellarisch"].forEach((id) => expect(templateDrawsLanguageDots(id)).toBe(true));
    languageDotTemplates.forEach((id) => expect(templateDrawsLanguageDots(id)).toBe(true));
  });

  it("never repeats a level that the stored text already carries", () => {
    for (const stored of ["Deutsch – C1 (Verhandlungssicher)", "Deutsch – Verhandlungssicher", "Deutsch – C1 (verhandlungssicher)", "Deutsch – C1"]) {
      const both = text(stored, display(false, true, true));
      expect(both, stored).not.toMatch(/C1 · C1/);
      expect(both, stored).not.toMatch(/Verhandlungssicher · Verhandlungssicher/i);
      expect(both, stored).not.toMatch(/\(C1\) – C1/);
      expect(both, stored).not.toMatch(/\(/);
      expect((both.match(/verhandlungssicher/gi) ?? []).length, stored).toBeLessThanOrEqual(1);
      expect((both.match(/C1/g) ?? []).length, stored).toBeLessThanOrEqual(1);
    }
    expect(text("Deutsch – C1 (Verhandlungssicher)", display(false, true, true))).toBe("Deutsch – C1 · Verhandlungssicher");
    expect(text("Deutsch – C1 (Verhandlungssicher)", display(false, true, false))).toBe("Deutsch – C1");
    expect(text("Deutsch – C1 (Verhandlungssicher)", display(false, false, true))).toBe("Deutsch – Verhandlungssicher");
    // A level in words only has no GER code to show or to hide: it is shown once, as written.
    expect(text("Deutsch – Verhandlungssicher", display(false, true, true))).toBe("Deutsch – Verhandlungssicher");
    expect(text("Deutsch – Verhandlungssicher", display(false, true, false))).toBe("Deutsch – Verhandlungssicher");
    expect(text("Deutsch – Verhandlungssicher", display(false, false, false))).toBe("Deutsch");
  });

  it("keeps a native language natural: no forced C2", () => {
    expect(text("Deutsch – Muttersprache", display(false, true, true))).toBe("Deutsch – Muttersprache");
    expect(text("Deutsch – Muttersprache", display(false, true, false))).toBe("Deutsch – Muttersprache");
    expect(text("Deutsch – Muttersprache", display(false, false, true))).toBe("Deutsch – Muttersprache");
    expect(text("Deutsch – Muttersprache", display(false, false, false))).toBe("Deutsch");
    const withDots = dotted("Deutsch – Muttersprache", display(true, true, true));
    expect(withDots).toMatchObject({ primaryText: "Deutsch", secondaryText: "Muttersprache", score: 6, native: true });
    expect(dotted("Deutsch – Muttersprache", display(true, true, false)).primaryText).toBe("Deutsch – Muttersprache");
    // An explicit C2 is a GER level of its own.
    expect(text("Türkisch – C2", display(false, true, true))).toBe("Türkisch – C2 · Annähernd muttersprachlich");
  });

  it("does not invent anything for a level in own words and never rewrites the stored text", () => {
    expect(text("Deutsch – gute Kenntnisse", display(false, true, true))).toBe("Deutsch – gute Kenntnisse");
    expect(text("Deutsch – gute Kenntnisse", display(false, false, true))).toBe("Deutsch – gute Kenntnisse");
    expect(text("Deutsch – gute Kenntnisse", display(false, false, false))).toBe("Deutsch");
    expect(text("Deutsch", display(false, true, true))).toBe("Deutsch");
    const raw = "Deutsch – C1 (Verhandlungssicher)";
    expect(resolveLanguagePresentation(raw, display(false, true, true)).raw).toBe(raw);
    // An older profile without the setting shows everything.
    expect(resolveLanguagePresentation("Deutsch – C1", undefined, { dots: true })).toMatchObject({ showDots: true, primaryText: "Deutsch – C1", secondaryText: "Verhandlungssicher" });
  });

  it("writes the level as text and never draws dots in the ATS layout", () => {
    for (const d of [display(true, false, false), display(true, true, true), display(false, false, false)]) {
      const ats = resolveLanguagePresentation("Deutsch – C1", d, { dots: true, ats: true });
      expect(ats.showDots).toBe(false);
      expect(ats.secondaryText).toBe("");
      expect(ats.primaryText).toBe("Deutsch – C1 (verhandlungssicher)");
    }
    expect(resolveLanguagePresentation("Englisch – B2", display(true, false, false), { ats: true }).primaryText).toBe("Englisch – B2 (fließend)");
    expect(resolveLanguagePresentation("Deutsch – Muttersprache", display(true, false, false), { ats: true }).primaryText).toBe("Deutsch – Muttersprache");
    // The text of an ATS profile (already written by formatLanguageForAts) stays as it is.
    expect(resolveLanguagePresentation("Deutsch – C1 (verhandlungssicher)", display(true, false, false), { ats: true }).primaryText).toBe("Deutsch – C1 (verhandlungssicher)");
  });
});
