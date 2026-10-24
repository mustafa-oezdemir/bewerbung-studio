import { describe, expect, it } from "vitest";
import {
  hasBlockingIssues,
  hasInterviewHistory,
  compareInterviewNoteNames,
  interviewCompanySlug,
  nextInterviewNoteFileName,
  parseInterviewNoteFileName,
  interviewNoteFileName,
  interviewNoteLimits,
  parseInterviewQuestions,
  serializeInterviewQuestions,
  showsInterviewPreparation,
} from "./interviewQuestions";

const pasted = `Frage 1: Was wissen Sie über unser Unternehmen?

Erklärung:
Der Arbeitgeber möchte herausfinden,
ob ich mich mit dem Unternehmen beschäftigt habe.

Antwort:
Ich habe mich über Ihr Unternehmen informiert.
Besonders interessant finde ich Ihre Produkte
und die eingesetzten Technologien.

Frage 2: Warum möchten Sie bei uns arbeiten?

Erklärung:
Hier werden Motivation und Interesse geprüft.

Antwort:
Die ausgeschriebene Stelle passt zu meinen
Kenntnissen und beruflichen Zielen.

Frage 3: Was sind Ihre Stärken?

Erklärung:
Der Interviewer möchte konkrete Stärken verstehen.

Antwort:
Zu meinen Stärken gehören analytisches Denken,
strukturiertes Arbeiten und Lernbereitschaft.
`;

const tenQuestions = Array.from({ length: 10 }, (_, index) => [
  `Frage ${index + 1}: Testfrage Nummer ${index + 1} – Größe & Übung?`,
  "",
  "Erklärung:",
  `Erklärung ${index + 1}, Zeile 1`,
  `Erklärung ${index + 1}, Zeile 2`,
  "",
  "Antwort:",
  `Antwort ${index + 1}: Ich bringe Erfahrung mit.`,
  "",
  `- Punkt A${index + 1}`,
  `- Punkt B${index + 1}`,
  "",
].join("\n")).join("\n");

const messages = (text: string) => parseInterviewQuestions(text).issues.map((issue) => issue.message);

describe("parseInterviewQuestions", () => {
  it("splits the defined input format into questions with multi-line explanations and answers", () => {
    const result = parseInterviewQuestions(pasted);
    expect(result.issues).toEqual([]);
    expect(result.questions).toEqual([
      {
        number: 1,
        question: "Was wissen Sie über unser Unternehmen?",
        explanation: "Der Arbeitgeber möchte herausfinden,\nob ich mich mit dem Unternehmen beschäftigt habe.",
        answer:
          "Ich habe mich über Ihr Unternehmen informiert.\nBesonders interessant finde ich Ihre Produkte\nund die eingesetzten Technologien.",
        line: 1,
      },
      {
        number: 2,
        question: "Warum möchten Sie bei uns arbeiten?",
        explanation: "Hier werden Motivation und Interesse geprüft.",
        answer: "Die ausgeschriebene Stelle passt zu meinen\nKenntnissen und beruflichen Zielen.",
        line: 12,
      },
      {
        number: 3,
        question: "Was sind Ihre Stärken?",
        explanation: "Der Interviewer möchte konkrete Stärken verstehen.",
        answer: "Zu meinen Stärken gehören analytisches Denken,\nstrukturiertes Arbeiten und Lernbereitschaft.",
        line: 21,
      },
    ]);
  });

  it("separates ten questions pasted at once", () => {
    const result = parseInterviewQuestions(tenQuestions);
    expect(result.issues).toEqual([]);
    expect(result.questions).toHaveLength(10);
    expect(result.questions.map((question) => question.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.questions[9]).toMatchObject({
      question: "Testfrage Nummer 10 – Größe & Übung?",
      explanation: "Erklärung 10, Zeile 1\nErklärung 10, Zeile 2",
      answer: "Antwort 10: Ich bringe Erfahrung mit.\n\n- Punkt A10\n- Punkt B10",
    });
  });

  it("keeps Markdown lists, blank lines, special characters and code blocks", () => {
    const text = [
      "Frage 1: Wie testen Sie Code?",
      "Erklärung: Fachwissen <script>alert(1)</script> & „Praxis“ – 100 %",
      "Antwort:",
      "Ich nutze:",
      "",
      "1. Unit-Tests",
      "   - mit **Vitest**",
      "",
      "```ts",
      "// Frage 2: kein neuer Block",
      "Antwort: bleibt Code",
      "const ä = 'ß';",
      "```",
      "",
      "Danach    Leerzeichen bleiben.",
    ].join("\r\n");
    const result = parseInterviewQuestions(text);
    expect(result.issues).toEqual([]);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].explanation).toBe("Fachwissen <script>alert(1)</script> & „Praxis“ – 100 %");
    expect(result.questions[0].answer).toBe([
      "Ich nutze:",
      "",
      "1. Unit-Tests",
      "   - mit **Vitest**",
      "",
      "```ts",
      "// Frage 2: kein neuer Block",
      "Antwort: bleibt Code",
      "const ä = 'ß';",
      "```",
      "",
      "Danach    Leerzeichen bleiben.",
    ].join("\n"));
  });

  it("recognises labels as headings, in bold and in any letter case", () => {
    const text = [
      "## FRAGE 1: Was motiviert Sie?",
      "### erklärung",
      "Motivation.",
      "**Antwort:** Neugier.",
      "",
      "**Frage 2:** Ihre Schwächen?",
      "ERKLAERUNG: Selbstreflexion.",
      "### Antwort",
      "Ungeduld.",
    ].join("\n");
    const result = parseInterviewQuestions(text);
    expect(result.issues).toEqual([]);
    expect(result.questions).toMatchObject([
      { number: 1, question: "Was motiviert Sie?", explanation: "Motivation.", answer: "Neugier." },
      { number: 2, question: "Ihre Schwächen?", explanation: "Selbstreflexion.", answer: "Ungeduld." },
    ]);
  });

  it("does not take words that only start like a label for a new section", () => {
    const result = parseInterviewQuestions([
      "Frage 1: Was ist wichtig?",
      "Antwort:",
      "Fragen stelle ich gern.",
      "Frage 2 wäre eine andere.",
      "Antworten sind kurz.",
      "Erklärung folgt.",
    ].join("\n"));
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].answer).toBe(
      "Fragen stelle ich gern.\nFrage 2 wäre eine andere.\nAntworten sind kurz.\nErklärung folgt.",
    );
  });

  it("reports missing and empty sections and keeps valid blocks without inventing answers", () => {
    const result = parseInterviewQuestions([
      "Frage 1: Ohne Antwort?",
      "Erklärung:",
      "Nur eine Erklärung.",
      "",
      "Frage 2: Leere Erklärung?",
      "Erklärung:",
      "Antwort: Vorhanden.",
    ].join("\n"));
    expect(result.questions).toEqual([
      { number: 1, question: "Ohne Antwort?", explanation: "Nur eine Erklärung.", answer: undefined, line: 1 },
      { number: 2, question: "Leere Erklärung?", explanation: "", answer: "Vorhanden.", line: 5 },
    ]);
    expect(result.issues.map((issue) => [issue.severity, issue.message])).toEqual([
      ["warning", "Frage 1: „Antwort:“ fehlt."],
      ["warning", "Frage 2: „Erklärung:“ ist leer."],
    ]);
    expect(hasBlockingIssues(result)).toBe(false);
  });

  it("keeps the title and the text before the first question as the document's intro", () => {
    const result = parseInterviewQuestions([
      "# Vorstellungsgespräch – Seidel GmbH & Co. KG",
      "",
      "Position: Produktionsmitarbeiter",
      "",
      "## 1. Analyse der Stellenanzeige",
      "Antwort: kein Abschnitt, nur Text der Einleitung",
      "---",
      "",
      "Frage 1: Warum Seidel?",
      "Antwort: Weil …",
    ].join("\n"));
    expect(result.title).toBe("Vorstellungsgespräch – Seidel GmbH & Co. KG");
    expect(result.intro).toBe(
      "Position: Produktionsmitarbeiter\n\n## 1. Analyse der Stellenanzeige\nAntwort: kein Abschnitt, nur Text der Einleitung\n---",
    );
    expect(result.questions).toHaveLength(1);
    expect(hasBlockingIssues(result)).toBe(false);
  });

  it("takes text without labels as the Antwort, or as the Erklärung when an Antwort label follows", () => {
    const result = parseInterviewQuestions([
      "### Frage 1: Warum möchten Sie bei Seidel arbeiten?",
      "",
      "> „Ich habe mich über Ihr Unternehmen informiert.“",
      "",
      "Diese Antwort solltest du ehrlich meinen.",
      "",
      "Frage 2: Mit Erklärung ohne Label?",
      "Der Arbeitgeber prüft die Motivation.",
      "Antwort: Motiviert.",
      "",
      "Frage 3: Beides vorhanden?",
      "Ohne Abschnitt",
      "Erklärung: E",
      "Antwort: A",
    ].join("\n"));
    expect(result.questions[0]).toMatchObject({
      level: 3,
      explanation: undefined,
      answer: "> „Ich habe mich über Ihr Unternehmen informiert.“\n\nDiese Antwort solltest du ehrlich meinen.",
    });
    expect(result.questions[1]).toMatchObject({ explanation: "Der Arbeitgeber prüft die Motivation.", answer: "Motiviert." });
    expect(result.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message)).toEqual([
      "Frage 3: Zeile 12 steht vor „Erklärung:“ und „Antwort:“ und gehört zu keinem der beiden Abschnitte.",
    ]);
    // "Erklärung fehlt" is only a hint while typing.
    expect(result.issues.find((issue) => issue.message === "Frage 1: „Erklärung:“ fehlt.")?.code).toBe("missing-explanation");
  });

  it("starts a phase heading on the questions' own level before the next question, not inside the last answer", () => {
    const text = [
      "## Frage 8: Welche Rückfragen?",
      "### Erklärung",
      "Interesse zeigen.",
      "### Antwort",
      "| Frage | Alternative |",
      "|---|---|",
      "| A | B |",
      "",
      "## Phase 5 – Abschluss",
      "",
      "---",
      "",
      "## Frage 9: Wie beende ich das Gespräch?",
      "### Erklärung",
      "Für eine längere Vorstellung:",
      "",
      "- Punkt",
      "",
      "Antwort – ausführliche Version:",
      "",
      "Vielen Dank.",
      "",
      "## Frage 10: Spickzettel?",
      "### Antwort",
      "## Mein persönlicher Spickzettel",
      "Wer bin ich?",
    ].join("\n");
    const result = parseInterviewQuestions(text);
    expect(hasBlockingIssues(result)).toBe(false);
    expect(result.questions[0].answer).toBe("| Frage | Alternative |\n|---|---|\n| A | B |");
    expect(result.questions[0].following).toBe("## Phase 5 – Abschluss");
    expect(result.questions[1]).toMatchObject({
      explanation: "Für eine längere Vorstellung:\n\n- Punkt",
      answer: "Antwort – ausführliche Version:\n\nVielen Dank.",
    });
    // Directly under "### Antwort" the same-level heading is the answer's own title.
    expect(result.questions[2]).toMatchObject({ answer: "## Mein persönlicher Spickzettel\nWer bin ich?" });
    expect(result.questions[2].following).toBeUndefined();
    const markdown = serializeInterviewQuestions(result.questions, result);
    const again = parseInterviewQuestions(markdown);
    expect(again.questions.map(({ line: _line, ...rest }) => rest)).toEqual(result.questions.map(({ line: _line, ...rest }) => rest));
    expect(serializeInterviewQuestions(again.questions, again)).toBe(markdown);
  });

  it("ends a nested question at a higher heading and keeps the rest as document text", () => {
    const text = [
      "# Vorbereitung",
      "",
      "## 8. Typische Fragen",
      "",
      "### Frage 1: Stärken?",
      "> „Analyse.“",
      "",
      "### Frage 2: Schwächen?",
      "> „Ungeduld.“",
      "",
      "## 9. Stressfragen",
      "",
      "| Frage | Prüfung |",
      "|---|---|",
      "| „Überqualifiziert?“ | Motivation |",
      "",
      "Antwort:",
      "> „Ich verstehe Ihre Frage.“",
      "",
      "### Frage 3: Wieder eine Frage?",
      "#### Antwort",
      "Ja.",
    ].join("\n");
    const result = parseInterviewQuestions(text);
    expect(hasBlockingIssues(result)).toBe(false);
    expect(result.intro).toBe("## 8. Typische Fragen");
    expect(result.questions.map((question) => question.answer)).toEqual(["> „Analyse.“", "> „Ungeduld.“", "Ja."]);
    expect(result.questions[1].following).toBe([
      "## 9. Stressfragen",
      "",
      "| Frage | Prüfung |",
      "|---|---|",
      "| „Überqualifiziert?“ | Motivation |",
      "",
      "Antwort:",
      "> „Ich verstehe Ihre Frage.“",
    ].join("\n"));
    // Saved and read again: the same document.
    const markdown = serializeInterviewQuestions(result.questions, result);
    expect(markdown.startsWith("# Vorbereitung\n\n## 8. Typische Fragen\n\n### Frage 1: Stärken?\n\n#### Antwort\n> „Analyse.“")).toBe(true);
    const again = parseInterviewQuestions(markdown);
    expect({ ...again, issues: [], questions: again.questions.map(({ line: _line, ...rest }) => rest) })
      .toEqual({ ...result, issues: [], questions: result.questions.map(({ line: _line, ...rest }) => rest) });
    expect(serializeInterviewQuestions(again.questions, again)).toBe(markdown);
  });

  it("keeps repeated labels inside an open section as its text (answer variants, sub-questions)", () => {
    const text = [
      "## Frage 4: Wie stelle ich mich vor?",
      "Erklärung:",
      "Drei Längen üben.",
      "### Antwort A – 60 Sekunden",
      "Kurz.",
      "### Antwort B – 2 Minuten",
      "Mittel.",
      "",
      "## Frage 7: Welche technischen Fragen?",
      "Erklärung:",
      "Fachfragen.",
      "Antwort: Die wichtigsten Fragen",
      "### 1. Was ist eine automatisierte Anlage?",
      "Erklärung: Sie arbeitet selbstständig.",
      "Antwort: „Ich bediene sie nach Einweisung.“",
      "### 2. Was tun bei Fehlern?",
      "Erklärung: Melden.",
      "Antwort: „Ich informiere sofort.“",
    ].join("\n");
    const result = parseInterviewQuestions(text);
    expect(hasBlockingIssues(result)).toBe(false);
    expect(result.questions[0]).toMatchObject({
      explanation: "Drei Längen üben.",
      answer: "### Antwort A – 60 Sekunden\nKurz.\n### Antwort B – 2 Minuten\nMittel.",
    });
    expect(result.questions[1].answer).toBe([
      "Die wichtigsten Fragen",
      "### 1. Was ist eine automatisierte Anlage?",
      "Erklärung: Sie arbeitet selbstständig.",
      "Antwort: „Ich bediene sie nach Einweisung.“",
      "### 2. Was tun bei Fehlern?",
      "Erklärung: Melden.",
      "Antwort: „Ich informiere sofort.“",
    ].join("\n"));
    // One hint per question while typing; headings like "### Antwort B" need none.
    expect(result.issues.filter((issue) => !issue.message.includes("Nummerierung") && !issue.message.includes("folgt auf"))).toEqual([{
      severity: "warning",
      code: "nested-label",
      line: 14,
      message: "Frage 7: „Erklärung:“ steht ab Zeile 14 ein weiteres Mal und wird als Text des Abschnitts „Antwort“ übernommen.",
    }]);
    // Saved and read again: the same questions, no blocking issue.
    const markdown = serializeInterviewQuestions(result.questions);
    const again = parseInterviewQuestions(markdown);
    expect(again.questions.map(({ line: _line, ...rest }) => rest)).toEqual(result.questions.map(({ line: _line, ...rest }) => rest));
    expect(serializeInterviewQuestions(again.questions)).toBe(markdown);
  });

  it("reports faulty numbering but keeps the numbers of the text", () => {
    const result = parseInterviewQuestions([
      "Frage 2: A?", "Antwort: a", "Frage 3: B?", "Antwort: b", "Frage 3: C?", "Antwort: c",
      "Frage 7: D?", "Antwort: d", "Frage: E?", "Antwort: e",
    ].join("\n"));
    expect(result.questions.map((question) => question.number)).toEqual([2, 3, 3, 7, null]);
    expect(result.issues.filter((issue) => !issue.message.includes("Erklärung")).map((issue) => issue.message)).toEqual([
      "Zeile 1: Die Nummerierung beginnt mit Frage 2 statt mit Frage 1.",
      "Zeile 5: Die Nummer „Frage 3“ kommt mehrfach vor.",
      "Zeile 7: Frage 7 folgt auf Frage 3 – erwartet wurde Frage 4.",
      "Zeile 9: Die 5. Frage hat keine Nummer.",
    ]);
    expect(hasBlockingIssues(result)).toBe(false);
  });

  it("takes the question text from the next line and reports a question without text", () => {
    expect(parseInterviewQuestions("Frage 1:\nWas ist Ihr Ziel?\nAntwort: Wachsen.").questions[0]).toMatchObject({
      question: "Was ist Ihr Ziel?",
      answer: "Wachsen.",
    });
    expect(messages("Frage 1:\nAntwort: Ja.")).toContain("Frage 1: Der Fragetext fehlt.");
  });

  it("refuses empty, unrecognisable and oversized text", () => {
    expect(messages("   \n")).toEqual(["Bitte fügen Sie Fragen, Erklärungen und Antworten ein."]);
    expect(messages("Nur ein Absatz.")).toContain(
      "Es wurde keine Frage erkannt. Jede Frage beginnt am Zeilenanfang mit „Frage 1:“, „Frage 2:“ usw.",
    );
    expect(hasBlockingIssues(parseInterviewQuestions("x".repeat(interviewNoteLimits.maxTextLength + 1)))).toBe(true);
  });

  it("reports an unclosed code block", () => {
    expect(messages("Frage 1: Code?\nAntwort:\n```\nnoch offen")).toContain("Zeile 3: Der Codeblock wird nicht geschlossen.");
  });
});

describe("serializeInterviewQuestions", () => {
  it("writes the documented Markdown structure", () => {
    const markdown = serializeInterviewQuestions(parseInterviewQuestions(pasted).questions.slice(0, 2));
    expect(markdown).toBe(`# Vorstellungsgespräch

## Frage 1: Was wissen Sie über unser Unternehmen?

### Erklärung
Der Arbeitgeber möchte herausfinden,
ob ich mich mit dem Unternehmen beschäftigt habe.

### Antwort
Ich habe mich über Ihr Unternehmen informiert.
Besonders interessant finde ich Ihre Produkte
und die eingesetzten Technologien.

---

## Frage 2: Warum möchten Sie bei uns arbeiten?

### Erklärung
Hier werden Motivation und Interesse geprüft.

### Antwort
Die ausgeschriebene Stelle passt zu meinen
Kenntnissen und beruflichen Zielen.
`);
  });

  it.each([
    ["the pasted format", pasted],
    ["ten questions with lists", tenQuestions],
    ["missing sections and numbering gaps", "Frage 2: A?\nErklärung:\nNur Erklärung\n\nFrage: B?\n\nFrage 5: C?\nErklärung:\nAntwort:\n---\nbleibt"],
    ["code blocks and trailing separators", "Frage 1: X?\nAntwort:\n```\n---\nFrage 9: im Code\n```\n\n---\n\nFrage 2: Y?\nAntwort: z\n---"],
  ])("reads its own Markdown back unchanged (%s)", (_name, input) => {
    const first = parseInterviewQuestions(input);
    const markdown = serializeInterviewQuestions(first.questions);
    const second = parseInterviewQuestions(markdown);
    expect(second.questions.map(({ line: _line, ...rest }) => rest))
      .toEqual(first.questions.map(({ line: _line, ...rest }) => rest));
    expect(second.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    // Saving again changes nothing and duplicates nothing.
    expect(serializeInterviewQuestions(second.questions)).toBe(markdown);
    expect(serializeInterviewQuestions(parseInterviewQuestions(serializeInterviewQuestions(second.questions)).questions))
      .toBe(markdown);
  });
});

describe("interview note file names", () => {
  it("names new files after the company without its legal form", () => {
    expect(interviewCompanySlug("Seidel GmbH & Co. KG")).toBe("Seidel");
    expect(interviewCompanySlug("Temmler Pharma GmbH")).toBe("Temmler_Pharma");
    expect(interviewCompanySlug("TÜV Rheinland FSP")).toBe("TÜV_Rheinland_FSP");
    expect(interviewCompanySlug("Müller & Söhne GmbH")).toBe("Müller_Söhne");
    expect(interviewCompanySlug("ARAL-Tankstelle Daniela Moter")).toBe("ARAL-Tankstelle_Daniela_Moter");
    expect(interviewCompanySlug("Studio 54 GmbH")).toBe("Studio-54");
    expect(interviewCompanySlug("../<Böse>:Firma?")).toBe("Böse_Firma");
    expect(interviewCompanySlug("Eine sehr lange Firmenbezeichnung mit vielen einzelnen Wörtern GmbH")).toBe(
      "Eine_sehr_lange_Firmenbezeichnung_mit",
    );
    expect(interviewCompanySlug("GmbH & Co. KG")).toBeNull();
    expect(interviewCompanySlug("2024")).toBeNull();
    expect(interviewNoteFileName("Seidel", 0)).toBe("Vorstellungsgespräch_Seidel.md");
    expect(interviewNoteFileName("Seidel", 2)).toBe("Vorstellungsgespräch_Seidel_2.md");
    expect(interviewNoteFileName(null, 0)).toBe("Vorstellungsgespräch.md");
  });

  it("reads company names and the older names and refuses anything else", () => {
    expect(parseInterviewNoteFileName("Vorstellungsgespräch_Seidel.md")).toEqual({ company: "Seidel", index: 0 });
    expect(parseInterviewNoteFileName("Vorstellungsgespräch_Temmler_Pharma_3.md")).toEqual({ company: "Temmler_Pharma", index: 3 });
    expect(parseInterviewNoteFileName("Vorstellungsgespräch_Studio-54.md")).toEqual({ company: "Studio-54", index: 0 });
    expect(parseInterviewNoteFileName("Vorstellungsgespräch.md")).toEqual({ company: null, index: 0 });
    expect(parseInterviewNoteFileName("Vorstellungsgespräch_12.md")).toEqual({ company: null, index: 12 });
    expect(parseInterviewNoteFileName("Vorstellungsgespräch_2.md")).toEqual({ company: null, index: 2 });
    for (const name of [
      "Vorstellungsgespräch_0.md", "Vorstellungsgespräch_01.md", "Vorstellungsgespräch.txt", "../Vorstellungsgespräch.md",
      "Vorstellungsgespräch_1.md/..", "vorstellungsgespräch.md", "Vorstellungsgespräch_1.md.tmp", "Notizen.md",
      "Vorstellungsgespräch_Seidel_0.md", "Vorstellungsgespräch_../x.md", "Vorstellungsgespräch_Sei del.md",
      "Vorstellungsgespräch__Seidel.md", "Vorstellungsgespräch_Seidel_.md", "Vorstellungsgespräch_Seidel.md.md",
    ]) expect(parseInterviewNoteFileName(name)).toBeNull();
    expect(parseInterviewNoteFileName("vorstellungsgespräch_seidel.MD", { ignoreCase: true })).toEqual({ company: "seidel", index: 0 });
  });

  it("orders older names first, then per company by number, and finds the next free name", () => {
    const names = [
      "Vorstellungsgespräch_Seidel_10.md", "Vorstellungsgespräch_2.md", "Vorstellungsgespräch_Seidel.md",
      "Vorstellungsgespräch.md", "Vorstellungsgespräch_Seidel_2.md", "Vorstellungsgespräch_10.md",
    ];
    expect([...names].sort(compareInterviewNoteNames)).toEqual([
      "Vorstellungsgespräch.md", "Vorstellungsgespräch_2.md", "Vorstellungsgespräch_10.md",
      "Vorstellungsgespräch_Seidel.md", "Vorstellungsgespräch_Seidel_2.md", "Vorstellungsgespräch_Seidel_10.md",
    ]);
    expect(nextInterviewNoteFileName("Seidel", ["Vorstellungsgespräch.md", "Vorstellungsgespräch_4.md"])).toBe("Vorstellungsgespräch_Seidel.md");
    expect(nextInterviewNoteFileName("Seidel", names)).toBe("Vorstellungsgespräch_Seidel_11.md");
    expect(nextInterviewNoteFileName("Seidel", ["vorstellungsgespräch_SEIDEL.md"])).toBe("Vorstellungsgespräch_Seidel_1.md");
    expect(nextInterviewNoteFileName(null, ["Vorstellungsgespräch_Seidel.md"])).toBe("Vorstellungsgespräch.md");
  });
});

describe("interview visibility", () => {
  const base = { status: "Gesendet" as const, interviewAt: undefined, secondInterviewAt: undefined, statusHistory: [] };
  it("shows the button in the interview stages or with a saved date of an active Bewerbung", () => {
    expect(showsInterviewPreparation({ ...base, status: "Vorstellungsgespräch" })).toBe(true);
    expect(showsInterviewPreparation({ ...base, status: "Zweites Gespräch" })).toBe(true);
    expect(showsInterviewPreparation({ ...base, interviewAt: "2026-10-22T08:00:00.000Z" })).toBe(true);
    expect(showsInterviewPreparation({ ...base, secondInterviewAt: "2026-10-29T08:00:00.000Z" })).toBe(true);
    expect(showsInterviewPreparation(base)).toBe(false);
    expect(showsInterviewPreparation({ ...base, status: "Absage", interviewAt: "2026-10-22T08:00:00.000Z" })).toBe(false);
  });

  it("counts a Bewerbung that once had an interview as owner of its interview folder", () => {
    expect(hasInterviewHistory(base)).toBe(false);
    expect(hasInterviewHistory({
      ...base,
      status: "Absage",
      statusHistory: [{ at: "2026-10-01T00:00:00.000Z", from: "Gesendet", to: "Vorstellungsgespräch", note: "" }],
    })).toBe(true);
  });
});
