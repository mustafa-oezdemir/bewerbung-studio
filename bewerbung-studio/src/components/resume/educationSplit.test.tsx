import { describe, expect, it } from "vitest";
import { maximalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";
import { applyEducationBreaks } from "../../shared/resumeEntrySplit";
import { educationDetailUnits, resolveEducationPresentation, sliceEducationDetails } from "../../shared/resumeEducation";
import { educationSplitTemplates, supportsEducationSplit } from "../../shared/resumeSectionPresentation";
import type { ResumePageItem } from "../../shared/documentPagination";

/**
 * An education entry that breaks between two pages is cut by the output both surfaces produce (`applyEducationBreaks`),
 * whatever markup a template draws it in: the entry is found by its title and its details. A template may only let the
 * planner split an entry (`educationSplitTemplates`) when this holds for its preview and its PDF.
 */
const sentences = [
  "Erste Beschreibung: Erfolgreich bestandene Abschlussprüfung mit Schwerpunkt auf der praktischen Umsetzung technischer Anforderungen.",
  "Zweite Beschreibung: Strukturierte Bearbeitung von Aufgabenstellungen im Team und Dokumentation der Ergebnisse.",
  "Dritte Beschreibung: Mitarbeit an Projekten der Fachbereiche und Abstimmung mit den beteiligten Personen.",
];
const education = {
  id: "9a000000-0000-4000-8000-000000000501", from: "07/2023", to: "2026", degree: "Fachinformatiker für Anwendungsentwicklung",
  institution: "Beispiel Akademie GmbH", city: "Marburg", country: "Deutschland", type: "", fieldOfStudy: "Systemintegration",
  grade: "2,3", status: "", description: sentences.join(" "),
};
const profile = maximalProfile({ education: [education], experiences: [] });
const entry = profile.education[0];
const view = resolveEducationPresentation(entry, profile.resumeEducationFieldVisibility);
const units = educationDetailUnits(view.details, view.descriptionIndex);

const text = (node: Element) => (node.textContent ?? "").replace(/\s+/g, " ");
const cut = (page: Element, from: number, to: number) => {
  const copy = page.cloneNode(true) as Element;
  const items: ResumePageItem[] = [{ kind: "education", id: entry.id, weight: 10, bullets: { from, to, total: units.length } }];
  applyEducationBreaks(Array.from(copy.querySelectorAll('[data-managed-section="education"]')), profile.education, profile.resumeEducationFieldVisibility, items);
  return copy;
};

describe("education units", () => {
  it("keeps Fachrichtung and Abschlussnote whole and cuts the description at its sentences", () => {
    expect(view.details).toEqual(["Fachrichtung: Systemintegration", "Abschlussnote: 2,3", sentences.join(" ")]);
    expect(units.map((unit) => unit.text)).toEqual(["Fachrichtung: Systemintegration", "Abschlussnote: 2,3", ...sentences]);
    expect(units.map((unit) => unit.detail)).toEqual([0, 1, 2, 2, 2]);
  });

  it("slices the details of a range: whole details, the sentences of the description joined into one paragraph", () => {
    expect(sliceEducationDetails(view.details, view.descriptionIndex, { from: 0, to: 3 })).toEqual(["Fachrichtung: Systemintegration", "Abschlussnote: 2,3", sentences[0]]);
    expect(sliceEducationDetails(view.details, view.descriptionIndex, { from: 3, to: 5 })).toEqual([`${sentences[1]} ${sentences[2]}`]);
    expect(sliceEducationDetails(view.details, view.descriptionIndex)).toEqual(view.details);
  });

  it("does not cut at an abbreviation and goes on at a word in a very long sentence", () => {
    const abbreviation = sliceEducationDetails(["Ausbildung z. B. in der Fertigung. Danach Weiterbildung."], 0, { from: 0, to: 1 });
    expect(abbreviation).toEqual(["Ausbildung z. B. in der Fertigung."]);
    const long = `${"Wort ".repeat(80)}Ende.`;
    const parts = educationDetailUnits([long], 0);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.map((part) => part.text).join(" ")).toBe(long);
    for (const part of parts) expect(part.text).not.toMatch(/^\s|\s$/);
  });
});

describe.each(resumeTemplateIds)("education break on the output of %s", (templateId) => {
  const rendered = renderCv(templateId, profile);
  const surfaces: Array<["preview" | "pdf", Element]> = [["preview", rendered.previewPages[0]], ["pdf", rendered.pdfPages[0]]];

  it.each(surfaces)("%s: the first part keeps the header and the first details, the second the rest, with a marker", (_surface, page) => {
    const first = text(cut(page, 0, 3));
    expect(first).toContain(entry.degree);
    expect(first).toContain("Abschlussnote");
    expect(first).toContain("Erste Beschreibung");
    expect(first).not.toContain("Zweite Beschreibung");
    expect(first).not.toContain("Dritte Beschreibung");
    expect(cut(page, 0, 3).querySelector("[data-resume-entry-marker]")).toBeNull();
    const second = cut(page, 3, 5);
    expect(text(second)).toContain(entry.degree);
    expect(text(second)).not.toContain("Abschlussnote");
    expect(text(second)).not.toContain("Erste Beschreibung");
    expect(text(second)).toContain("Zweite Beschreibung");
    expect(text(second)).toContain("Dritte Beschreibung");
    const marker = second.querySelector("[data-resume-entry-marker]");
    expect(marker?.parentElement?.textContent).toContain(entry.degree);
  });

  it.each(surfaces)("%s: every detail stays exactly once over the two parts", (_surface, page) => {
    const parts = [text(cut(page, 0, 3)), text(cut(page, 3, 5))].join(" ");
    for (const sentence of sentences) expect(parts.split(sentence.slice(0, 24)).length - 1).toBe(1);
    expect(parts.split("Abschlussnote: 2,3").length - 1).toBe(1);
  });
});

describe("which templates the planner may split an education entry in", () => {
  it("lists only templates whose preview and PDF pass the break above", () => {
    expect(educationSplitTemplates.length).toBeGreaterThan(0);
    for (const id of educationSplitTemplates) expect(resumeTemplateIds, id).toContain(id);
    expect(supportsEducationSplit("zweispaltig")).toBe(true);
    expect(supportsEducationSplit(undefined)).toBe(false);
  });
});
