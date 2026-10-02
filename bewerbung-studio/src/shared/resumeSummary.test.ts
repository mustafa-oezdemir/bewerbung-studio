import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getManagerSections } from "../features/resume-sections/resume-manager";
import { getResumeSectionTitle, setResumeSectionTitle } from "../features/resume-sections/resume-sections";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { resolveCvDocument } from "./resolveCvDocument";
import { separateResumeDraft } from "./resumePresentation";
import {
  countSummarySentences,
  countSummaryWords,
  getResumeSummarySource,
  getSummaryGuidance,
  isResumeSummaryVisible,
  normalizeSummaryText,
  resolveResumeSummary,
  setResumeSummaryVisible,
} from "./resumeSummary";
import { profileSchema } from "./schema";
import { templates } from "./templates";

const profile = (change: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: "89000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mustafa", lastName: "Özdemir",
    summary: "Allgemeines Kurzprofil", updatedAt: "2026-10-02T00:00:00.000Z", ...change,
  });

describe("effective Kurzprofil", () => {
  it("A. takes the profile text when the Bewerbung has none", () => {
    expect(resolveResumeSummary(profile(), "")).toBe("Allgemeines Kurzprofil");
    expect(resolveResumeSummary(profile(), undefined)).toBe("Allgemeines Kurzprofil");
    expect(resolveResumeSummary(profile(), "   \n ")).toBe("Allgemeines Kurzprofil");
    expect(getResumeSummarySource(profile(), "")).toBe("profile");
  });

  it("B. keeps the profile text when archived Bewerbung text exists", () => {
    expect(resolveResumeSummary(profile(), "Stellenspezifisches Kurzprofil")).toBe("Allgemeines Kurzprofil");
    expect(resolveResumeSummary(profile(), "  Stellenspezifisch  ")).toBe("Allgemeines Kurzprofil");
    expect(getResumeSummarySource(profile(), "Stellenspezifisches Kurzprofil")).toBe("profile");
  });

  it("C. returns to the profile text when the Bewerbung text is cleared, and the profile text was never touched", () => {
    const own = profile();
    const withOverride = resolveResumeSummary(own, "Stellenspezifisches Kurzprofil");
    const afterReset = resolveResumeSummary(own, "");
    expect(withOverride).toBe("Allgemeines Kurzprofil");
    expect(afterReset).toBe("Allgemeines Kurzprofil");
    expect(own.summary).toBe("Allgemeines Kurzprofil");
  });

  it("E. follows a change of the profile text for every Bewerbung without an own text", () => {
    const changed = profile({ summary: "Neues allgemeines Kurzprofil" });
    expect(resolveResumeSummary(changed, "")).toBe("Neues allgemeines Kurzprofil");
    expect(resolveResumeSummary(changed, "Stellenspezifisches Kurzprofil")).toBe("Neues allgemeines Kurzprofil");
  });

  it("is empty when neither text exists: nothing is drawn, no placeholder", () => {
    expect(resolveResumeSummary(profile({ summary: "" }), "")).toBe("");
    expect(resolveResumeSummary(undefined, undefined)).toBe("");
    expect(getResumeSummarySource(profile({ summary: "" }), "")).toBe("none");
  });

  it("is the same for every template, the planner and the preview/PDF resolver", () => {
    const source = profile();
    for (const { id } of templates) {
      expect(resolveCvDocument({ profile: source, templateId: id }).summary, id).toBe("Allgemeines Kurzprofil");
      expect(resolveCvDocument({ profile: source, templateId: id, resumeProfile: "Eigener Text" }).summary, id).toBe("Allgemeines Kurzprofil");
      expect(resolveCvDocument({ profile: profile({ summary: "" }), templateId: id }).summary, id).toBe("");
    }
  });

  it("is not changed by the Deckblatt text or the job: a Deckblatt statement never becomes the Kurzprofil", () => {
    const resolved = resolveCvDocument({ profile: profile(), templateId: "pehlione_white", ...({ deckblattStatement: "Deckblatt-Aussage", jobTitle: "Kundenservice" } as object) });
    expect(resolved.summary).toBe("Allgemeines Kurzprofil");
    expect(resolveCvDocument({ profile: profile({ summary: "" }), templateId: "pehlione_white_blue", ...({ deckblattStatement: "Deckblatt-Aussage" } as object) }).summary).toBe("");
  });
});

describe("D. Profil and Lebenslauf edit one summary", () => {
  it("is written to the document only: saving the section panel keeps profile.summary", () => {
    const original = profile();
    // The panel edits `documents.resumeProfile`; its draft of the profile still holds the profile's own text.
    const draft = { ...original, resumeColumnRatio: 33 };
    const { profile: saved } = separateResumeDraft(original, draft, "modern");
    expect(saved.summary).toBe("Allgemeines Kurzprofil");
  });

  it("uses the shared summary editor in the panel", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/resume/ResumeSectionsPanel.tsx"), "utf8");
    expect(source).toContain("<SummaryEditor profile={draft} onChange={setDraft} />");
    expect(source).toContain("legacySummary");
  });

  it("is also true for the editor of the profile data: no second editor of profile.summary outside Profil → 4.", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/components/resume/ResumeDataEditor.tsx"), "utf8");
    expect(editor).not.toMatch(/summary:\s*event\.target\.value/);
  });
});

describe("counting", () => {
  const words = (text: string) => countSummaryWords(text);
  it("counts words as a reader does", () => {
    expect(words("")).toBe(0);
    expect(words("   \n ")).toBe(0);
    expect(words("Ein Wort")).toBe(2);
    expect(words("Entwickelt  Anwendungen,\nbetreut Teams – und liefert.")).toBe(6);
    expect(words("– … !")).toBe(0);
    expect(words("Java 17 und C++")).toBe(4);
  });

  it("counts sentences by their marks", () => {
    const sentences = (text: string) => countSummarySentences(text);
    expect(sentences("")).toBe(0);
    expect(sentences("Kein Satzzeichen")).toBe(1);
    expect(sentences("Eins. Zwei! Drei?")).toBe(3);
    expect(sentences("Eins. Zwei")).toBe(2);
    expect(sentences("Wirklich?! Ja...")).toBe(2);
    expect(sentences("Erster Satz.\n\nZweiter Satz.")).toBe(2);
  });

  it("does not end a sentence at an abbreviation, an ordinal, a date or a decimal", () => {
    const sentences = (text: string) => countSummarySentences(text);
    expect(sentences("Ich arbeite z. B. mit TypeScript, u. a. mit React. Zweiter Satz.")).toBe(2);
    expect(sentences("Ca. 5 Jahre Erfahrung bei Dr. Müller. Danach Teamleitung.")).toBe(2);
    expect(sentences("Seit 07.2023 verantwortlich für 3.5 Mio. Nutzer. Ziel ist Wachstum.")).toBe(2);
    expect(sentences("Im 3. Quartal automatisiert. Ergebnis gemessen.")).toBe(2);
    expect(sentences("Abschluss 2019. Danach Berufseinstieg.")).toBe(2);
  });
});

describe("soft guidance", () => {
  const text = (words: number, sentences: number) => {
    const per = Math.floor(words / sentences);
    return Array.from({ length: sentences }, (_, index) => `${Array.from({ length: index === sentences - 1 ? words - per * (sentences - 1) : per }, () => "Wort").join(" ")}.`).join(" ");
  };

  it("H. recommends 50 to 100 words, and is only a hint outside", () => {
    expect(getSummaryGuidance(text(72, 4))).toMatchObject({ words: 72, sentences: 4, wordRange: "ok", sentenceRange: "ok", recommended: true });
    expect(getSummaryGuidance(text(50, 3)).recommended).toBe(true);
    expect(getSummaryGuidance(text(100, 5)).recommended).toBe(true);
    expect(getSummaryGuidance(text(48, 4))).toMatchObject({ wordRange: "short", recommended: false });
    expect(getSummaryGuidance(text(105, 4))).toMatchObject({ wordRange: "long", recommended: false });
  });

  it("I. recommends 3 to 5 sentences", () => {
    expect(getSummaryGuidance(text(60, 2))).toMatchObject({ sentenceRange: "short", recommended: false });
    expect(getSummaryGuidance(text(60, 3)).sentenceRange).toBe("ok");
    expect(getSummaryGuidance(text(60, 5)).sentenceRange).toBe("ok");
    expect(getSummaryGuidance(text(60, 6))).toMatchObject({ sentenceRange: "long", recommended: false });
    expect(getSummaryGuidance("")).toMatchObject({ words: 0, sentences: 0, wordRange: "empty", recommended: false });
  });

  it("never rejects a text: a short or long one is saved as it is (only spaces are tidied)", () => {
    for (const value of ["Kurz.", text(105, 4), text(300, 12), "Ohne Satzzeichen"]) {
      expect(normalizeSummaryText(value)).toBe(value.trim());
      expect(profileSchema.parse({ id: "89000000-0000-4000-8000-000000000001", isDefault: true, firstName: "A", lastName: "B", summary: value, updatedAt: "2026-10-02T00:00:00.000Z" }).summary).toBe(value);
    }
  });
});

describe("saving a text", () => {
  it("only tidies spaces: wording, punctuation and paragraphs stay", () => {
    expect(normalizeSummaryText("  Erster   Satz.  \r\n\r\n\r\n\r\n  Zweiter Satz,  mit  Komma!  ")).toBe("Erster Satz.\n\nZweiter Satz, mit Komma!");
    expect(normalizeSummaryText("Zeile eins\nZeile zwei")).toBe("Zeile eins\nZeile zwei");
    expect(normalizeSummaryText("ich entwickle …")).toBe("ich entwickle …");
    expect(normalizeSummaryText(undefined)).toBe("");
  });

  it("does not invent anything: no text in, no text out", () => {
    expect(normalizeSummaryText("")).toBe("");
    expect(normalizeSummaryText("  \n  ")).toBe("");
  });
});

describe("visibility", () => {
  it("G. hides and shows the Kurzprofil without touching the text", () => {
    const visible = profile();
    expect(isResumeSummaryVisible(visible)).toBe(true);
    const hidden = setResumeSummaryVisible(visible, false);
    expect(isResumeSummaryVisible(hidden)).toBe(false);
    expect(hidden.summary).toBe("Allgemeines Kurzprofil");
    const shown = setResumeSummaryVisible(hidden, true);
    expect(isResumeSummaryVisible(shown)).toBe(true);
    expect(shown.summary).toBe("Allgemeines Kurzprofil");
  });

  it("writes the three places that describe it, like the eye of the section panel", () => {
    const hidden = setResumeSummaryVisible(profile(), false);
    expect(hidden.resumeSections.profile).toBe(false);
    expect(hidden.resumeSemanticSections.find((section) => section.semanticType === "summary")).toMatchObject({ visible: false, enabled: false });
    expect(getManagerSections(hidden, "modern").find((entry) => entry.id === "summary")?.visible).toBe(false);
  });
});

describe("J. title", () => {
  it("is Kurzprofil by default, for new and for older profiles", () => {
    expect(getResumeSectionTitle(profile(), "summary")).toBe("Kurzprofil");
    expect(getManagerSections(profile(), "modern").find((entry) => entry.id === "summary")?.title).toBe("Kurzprofil");
  });

  it("treats the title older profiles stored as their default as no own title", () => {
    const legacy = profile({ resumeSectionTitles: { summary: "Zusammenfassung" } });
    expect(legacy.resumeSectionTitles.summary).toBe("Zusammenfassung");
    expect(getResumeSectionTitle(legacy, "summary")).toBe("Kurzprofil");
  });

  it("keeps a title the user chose, from every place that stored one", () => {
    expect(getResumeSectionTitle(setResumeSectionTitle(profile(), "summary", "Über mich"), "summary")).toBe("Über mich");
    expect(getResumeSectionTitle(profile({ resumeSectionTitles: { summary: "Mein Profil" } }), "summary")).toBe("Mein Profil");
    expect(getResumeSectionTitle(profile({ resumeSemanticSections: [{ semanticType: "summary", customTitle: "Persönliches Profil", visible: true, enabled: true, order: 3 }] }), "summary")).toBe("Persönliches Profil");
    expect(getResumeSectionTitle(profile({ resumeManagerOverrides: { summary: { title: "Profil" } } }), "summary")).toBe("Profil");
  });

  it("is restored by choosing the default again", () => {
    const renamed = setResumeSectionTitle(profile(), "summary", "Über mich");
    expect(getResumeSectionTitle(setResumeSectionTitle(renamed, "summary", "Kurzprofil"), "summary")).toBe("Kurzprofil");
    expect(getResumeSectionTitle(setResumeSectionTitle(renamed, "summary", ""), "summary")).toBe("Kurzprofil");
  });
});

describe("M. pagination measures the effective text", () => {
  const longText = Array.from({ length: 40 }, (_, index) => `Satz ${index} beschreibt eine konkrete Aufgabe mit messbarem Ergebnis im Team.`).join(" ");
  const experiences = Array.from({ length: 6 }, (_, index) => ({
    id: `8a000000-0000-4000-8000-00000000000${index}`, from: `${2010 + index}`, to: `${2011 + index}`, role: `Rolle ${index}`, company: `Firma ${index}`, city: "Berlin",
    achievements: Array.from({ length: 6 }, (_, item) => `Ergebnis ${item} mit messbarer Verbesserung der Abläufe in der Abteilung ${index}.`),
  }));
  const plan = (source: ReturnType<typeof profile>, resumeProfile = "", id = "einspaltig") =>
    resolveCvDocument({ profile: source, templateId: id, settings: getTemplateDocumentDesignDefaults(id), resumeProfile }).pagePlan;

  it("uses the profile text to plan page one", () => {
    const short = profile({ summary: "Kurz.", experiences });
    const withLong = JSON.stringify(plan(short, longText));
    expect(withLong).toBe(JSON.stringify(plan(short, "")));
  });

  it("ignores archived Bewerbung text in pagination", () => {
    const asOverride = profile({ summary: "Anderer Text", experiences });
    for (const id of ["einspaltig", "modern", "pehlione_white", "zweispaltig"]) {
      expect(JSON.stringify(plan(asOverride, longText, id)), id).toBe(JSON.stringify(plan(asOverride, "", id)));
    }
  });

  it("measures the profile text when the Bewerbung has none, and nothing when both are empty", () => {
    const empty = profile({ summary: "", experiences });
    expect(JSON.stringify(plan(profile({ summary: longText, experiences }), ""))).not.toBe(JSON.stringify(plan(empty, "")));
  });
});
