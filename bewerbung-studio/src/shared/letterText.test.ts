import { describe, expect, it } from "vitest";
import { coverLetterSectionPatch, coverLetterSections } from "./coverLetter";
import { formatLetterText, parseLetterText, splitLetterParagraphs } from "./letterText";
import { documentDraftSchema } from "./schema";

const blank = coverLetterSections(documentDraftSchema.parse({}));

describe("single letter text", () => {
  it("separates real paragraphs and flows CRLF, LF and Word soft breaks inside them", () => {
    expect(splitLetterParagraphs("  Öl\tund  Gas\r\nbei 30 °C.\u000bGröße\u2028& Maß.\r\n \r\nZwei.\u2029Drei.")).toEqual([
      "Öl und Gas bei 30 °C. Größe & Maß.", "Zwei.", "Drei.",
    ]);
  });

  it("assigns unlabelled introductions, closings, and several body paragraphs", () => {
    expect(parseLetterText("anschreiben", "Einstieg.\n\nA.\n\nB.\n\nFirma.\n\nGespräch.", blank).sections).toEqual({
      introduction: "Einstieg.", mainBody: "A.\n\nB.", companyFit: "Firma.", closing: "Gespräch.",
    });
    expect(parseLetterText("motivation", "Einstieg.\n\nA.\n\nB.\n\nGespräch.", blank).sections).toEqual({
      introduction: "Einstieg.", mainBody: "A.\n\nB.", companyFit: "", closing: "Gespräch.",
    });
  });

  it("uses numbered headings and does not fill omitted sections", () => {
    const parsed = parseLetterText("anschreiben", "4. Einleitung: Einstieg.\r\n5) Hauptteil:\r\nEins\r\nund zwei.\n\nDrei.\n(7) Schlussteil\nBis bald.", blank);
    expect(parsed.sections).toEqual({
      introduction: "Einstieg.", mainBody: "Eins und zwei.\n\nDrei.", companyFit: "", closing: "Bis bald.",
    });
    expect(parseLetterText("motivation", "5. Schluss:\nBis bald.", blank).sections?.closing).toBe("Bis bald.");
  });

  it("keeps unassigned text visible and rejects attempts to move known paragraphs by position", () => {
    const stored = { ...blank, introduction: "Ältere Einleitung.", closing: "Bekannter Schluss." };
    expect(parseLetterText("anschreiben", "Ein einzelner Absatz.", stored).unresolved).toEqual(["Ein einzelner Absatz."]);
    expect(parseLetterText("anschreiben", "Neuer Text.\n\nÄltere Einleitung.\n\nBeispiel.\n\nBekannter Schluss.", stored).sections).toBeNull();
    expect(parseLetterText("motivation", "Teil ohne Überschrift.\nHauptteil:\nWeiter.", stored).sections).toBeNull();
    expect(parseLetterText("motivation", "Schluss:\nEins.\nHauptteil:\nZwei.", stored).sections).toBeNull();
  });

  it("round trips incomplete records and preserves both the extra and distinct legacy cover paragraphs", () => {
    const original = documentDraftSchema.parse({
      coverIntroduction: "Hallo.\n\nWeiter.", coverMainBody: "Aktuell.", coverExtraParagraph: "Zusätzlich.",
      coverMotivation: "Alt.", coverQualification: "Aktuell.", motivationIntroduction: "Eigener Text.",
    });
    const sections = coverLetterSections(original);
    expect(sections.mainBody).toBe("Aktuell.\n\nAlt.\n\nZusätzlich.");
    const input = formatLetterText("anschreiben", sections).replace("Hallo.", "Guten Tag.");
    expect(input).toContain("Unternehmensbezug:");
    const patch = coverLetterSectionPatch(parseLetterText("anschreiben", input, sections).sections!);
    const saved = documentDraftSchema.parse({ ...original, ...patch });
    expect(saved).toMatchObject({
      coverIntroduction: "Guten Tag.\n\nWeiter.", coverMainBody: sections.mainBody,
      coverMotivation: "", coverQualification: "", coverExtraParagraph: "", coverCompanyFit: "", coverClosing: "",
      motivationIntroduction: "Eigener Text.",
    });
    const reloaded = coverLetterSections(saved);
    expect(coverLetterSectionPatch(parseLetterText("anschreiben", formatLetterText("anschreiben", reloaded), reloaded).sections!)).toEqual(patch);
  });
});
