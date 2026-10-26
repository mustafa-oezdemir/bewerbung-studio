import { describe, expect, it } from "vitest";
import { textWidthMm, wrappedLines } from "./textMetrics";

const body = 11 * 0.3528;

describe("measured text wrapping", () => {
  it("adds the measured advances (equal to Chromium's width of the whole string)", () => {
    // canvas measureText at 1000 px: 13380.4 px for the whole string.
    expect(textWidthMm("Entwicklung von Schnittstellen", 1000, 400)).toBeCloseTo(13381, 0);
    expect(textWidthMm("ABC", body, 700)).toBeGreaterThan(textWidthMm("ABC", body, 400));
    expect(textWidthMm("AB", body, 400, 0.04)).toBeCloseTo(textWidthMm("AB", body, 400) + 2 * 0.04 * body);
  });

  it("breaks at spaces and after a hyphen, cuts a word wider than the line, and counts no line for no text", () => {
    expect(wrappedLines("", 50, body)).toBe(0);
    expect(wrappedLines("Kurz", 50, body)).toBe(1);
    // Measured in the Gepflegt PDF (107 mm bullet column at 11 pt): three lines each.
    expect(wrappedLines("Entwicklung eines Grafana-Datasource-Plugins für PRTG zur Integration von Monitoring-Daten in bestehende Observability-Prozesse", 107.2, body)).toBe(3);
    expect(wrappedLines("Konzeption und Implementierung zentraler Funktionen wie Authentifizierung, Logging und Monitoring, um eine stabile und sichere Nutzung der Schnittstelle zu gewährleisten", 107.2, body)).toBe(3);
    const hyphenated = "Grafana-Datasource-Plugin-Entwicklung";
    expect(wrappedLines(hyphenated, textWidthMm("Grafana-Datasource-", body) + 1, body)).toBe(2);
    expect(wrappedLines("x".repeat(80), 20, body)).toBe(Math.ceil(80 / Math.floor(20 / textWidthMm("x", body))));
  });

  it("cuts a word wider than the line after the last character that fits, like Chromium", () => {
    // Türkis Profil's hero (24 pt capitals, 0.025 em apart, 49.8 mm) in the PDF: "MUSTAFA-" | "ALEXANDE" | "R " | "ÖZDEMIR-" |
    // "SCHMIDT-" | "WOLKENST" | "EIN". The cut-off "R" leaves no room for "ÖZDEMIR-" behind it.
    expect(wrappedLines("MUSTAFA-ALEXANDER ÖZDEMIR-SCHMIDT-WOLKENSTEIN", 49.8, 24 * 0.3528, 750, 0.025)).toBe(7);
  });
});
