import { describe, expect, it } from "vitest";
import { hyphenateGermanWord, hyphenateResumeSummary, summaryWordEnds, summaryWrappedLines } from "./resumeSummaryHyphenation";

const softHyphen = "\u00ad";

describe("display-only German Kurzprofil hyphenation", () => {
  it.each([
    "Donaudampfschifffahrtsgesellschaft",
    "Arbeitslosenversicherung",
    "Produktionssteuerung",
  ])("finds German break points in %s without changing the word", (word) => {
    const display = hyphenateGermanWord(word);
    expect(display).toContain(softHyphen);
    expect(display.replaceAll(softHyphen, "")).toBe(word);
    for (const part of display.split(softHyphen)) expect(part.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps technical URLs intact and is stable when output is projected twice", () => {
    const source = "Erfahrung mit Produktionssteuerung und https://example.org/verylongpathwithoutbreakpoints im Team.";
    const display = hyphenateResumeSummary(source);
    expect(display).toContain("https://example.org/verylongpathwithoutbreakpoints");
    expect(display.replaceAll(softHyphen, "")).toBe(source);
    expect(hyphenateResumeSummary(display)).toBe(display);
  });

  it("reflows with the available column width and the selected font size", () => {
    const source = Array.from({ length: 9 }, () => "Produktionssteuerung und Arbeitslosenversicherung").join(" ");
    expect(summaryWrappedLines(source, 42, 3.5)).toBeGreaterThan(summaryWrappedLines(source, 80, 3.5));
    expect(summaryWrappedLines(source, 42, 4.2)).toBeGreaterThanOrEqual(summaryWrappedLines(source, 42, 3.5));
    const ends = summaryWordEnds(source);
    expect(ends.at(-1)).toBe(source.length);
    expect(source.slice(0, ends[0]) + source.slice(ends[0])).toBe(source);
  });
});
