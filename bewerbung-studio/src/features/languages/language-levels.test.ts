import { describe, expect, it } from "vitest";
import {
  formatLanguageEntry,
  formatLanguageForAts,
  getCefrLanguageLevel,
  getCefrLevelByScore,
  getLanguageLevelScore,
  parseLanguageEntry,
} from "./language-levels";

describe("language levels", () => {
  it("maps every GER level to one of six graphic steps", () => {
    expect(["A1", "A2", "B1", "B2", "C1", "C2"].map(getLanguageLevelScore))
      .toEqual([1, 2, 3, 4, 5, 6]);
    expect(getCefrLevelByScore(4)).toBe("B2");
  });

  it("keeps legacy language descriptions compatible", () => {
    expect(getCefrLanguageLevel("Grundkenntnisse")).toBe("A2");
    expect(getCefrLanguageLevel("fließend")).toBe("C1");
    expect(getCefrLanguageLevel("Muttersprache")).toBe("C2");
    expect(formatLanguageForAts("Deutsch – Muttersprache")).toBe("Deutsch – Muttersprache");
    expect(formatLanguageForAts("Englisch – B2")).toBe("Englisch – B2 (fließend)");
    expect(formatLanguageForAts("Französisch – C1")).toBe("Französisch – C1 (verhandlungssicher)");
  });

  it("parses and formats the existing profile storage format", () => {
    expect(parseLanguageEntry("Deutsch – B2")).toEqual({
      raw: "Deutsch – B2",
      name: "Deutsch",
      level: "B2",
    });
    expect(formatLanguageEntry(" Englisch ", "C1")).toBe("Englisch – C1");
  });
});
