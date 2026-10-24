import type { Application, ApplicationStatus } from "./schema";

/**
 * Vorstellungsgespräch – Fragen & Antworten: one deterministic rule that reads the pasted text and the Markdown the
 * app writes, and one serializer. The Markdown files in the interview folder are the only copy of the questions.
 */

export type InterviewQuestion = {
  /** The number the text gave the question ("Frage 3:" → 3); `null` for "Frage:" without a number. */
  number: number | null;
  question: string;
  /** `undefined`: the block has no "Erklärung" label; `""`: the label is there without text. */
  explanation?: string;
  answer?: string;
  /** 1-based line of the "Frage" line in the parsed text. */
  line: number;
  /** Heading level of the "Frage" line (`### Frage 1:` → 3); absent for a plain "Frage 1:" line. */
  level?: number;
  /**
   * Document text after the question that belongs to no question: it starts with a heading above the question's own
   * level (`## 9. Stressfragen` after `### Frage 10:`) and is shown as text between the question cards.
   */
  following?: string;
};

export type InterviewParseIssue = {
  /** Errors block saving (content would be lost or is ambiguous); warnings are shown and may be saved. */
  severity: "error" | "warning";
  line: number;
  message: string;
  /**
   * Hints only shown while typing, not for a saved file: "nested-label" ("Erklärung:"/"Antwort:" again inside an open
   * section, kept as its text) and "missing-explanation" (a question without "Erklärung:").
   */
  code?: "nested-label" | "missing-explanation";
};

export type InterviewParseResult = {
  /** The first line when it is a `# Titel` heading. */
  title?: string;
  /** Document text before the first question (shown above the questions). */
  intro?: string;
  questions: InterviewQuestion[];
  issues: InterviewParseIssue[];
};

/** Hints that a saved file does not repeat (see `InterviewParseIssue.code`). */
export const isTypingHint = (issue: InterviewParseIssue) => issue.code !== undefined;

/**
 * Limits of one Fragen & Antworten text (checked in the renderer and again in the main process):
 * - `maxTextLength`: characters of one pasted text or one saved file (≈ 200 long answers),
 * - `maxQuestions`: questions in one file,
 * - `maxFileBytes`: bytes of one file read from disk (the encrypted file is slightly larger, see `maxStoredFileBytes`),
 * - `maxFiles`: Markdown files listed in one interview folder.
 */
export const interviewNoteLimits = {
  maxTextLength: 400_000,
  maxQuestions: 300,
  maxFileBytes: 2 * 1024 * 1024,
  maxStoredFileBytes: 3 * 1024 * 1024,
  maxFiles: 200,
} as const;

export const interviewNoteTitle = "Vorstellungsgespräch";
export const interviewNoteBaseName = "Vorstellungsgespräch";

/** Legal forms and joining words that are left out of the company part of a file name ("Seidel GmbH & Co. KG" → "Seidel"). */
const legalFormWords = new Set([
  "gmbh", "mbh", "ag", "se", "kg", "kgaa", "ohg", "gbr", "ug", "haftungsbeschränkt", "ek", "ekfm", "ekfr", "ev", "eg",
  "co", "und", "ltd", "inc", "llc", "corp", "plc", "sa", "sas", "sarl", "bv", "nv", "spa", "srl", "gesmbh",
]);
const companyPart = /^[\p{L}\p{N}][\p{L}\p{N}-]*(?:_[\p{L}\p{N}][\p{L}\p{N}-]*)*$/u;
const isCompanyPart = (value: string) =>
  value.length <= 60 && companyPart.test(value) && /\p{L}/u.test(value) && !/_\d+$/.test(value);

/**
 * The company part of a note's file name: the words of the company name without its legal form, joined by `_`
 * (umlauts kept, anything else that is no letter, digit or `-` dropped), at most 40 characters. A trailing number is
 * joined with `-` ("Studio 54" → "Studio-54") so it is never read as the file's own number. `null` when nothing is left.
 */
export const interviewCompanySlug = (companyName: string): string | null => {
  const words = companyName.normalize("NFC")
    .split(/[\s_/\\|,;:+&]+/u)
    .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, "").replace(/^-+|-+$/g, ""))
    .filter((word) => word && !legalFormWords.has(word.toLowerCase().replace(/-/g, "")));
  let slug = "";
  for (const word of words) {
    const next = slug ? `${slug}_${word}` : word;
    if (next.length > 40) break;
    slug = next;
  }
  slug = slug.replace(/_(\d+)$/, "-$1");
  return slug && isCompanyPart(slug) ? slug : null;
};

export type InterviewNoteName = { company: string | null; index: number };

/**
 * The allowed note names: `Vorstellungsgespräch_<Firma>.md`, `Vorstellungsgespräch_<Firma>_<n>.md` and the older
 * `Vorstellungsgespräch.md`, `Vorstellungsgespräch_<n>.md`. Anything else → `null`. `ignoreCase` is for checking
 * which names are taken on a case-insensitive file system.
 */
export const parseInterviewNoteFileName = (fileName: string, { ignoreCase = false } = {}): InterviewNoteName | null => {
  const name = fileName.normalize("NFC");
  const prefix = name.slice(0, interviewNoteBaseName.length);
  if (ignoreCase ? prefix.toLowerCase() !== interviewNoteBaseName.toLowerCase() : prefix !== interviewNoteBaseName) return null;
  const extension = name.slice(-3);
  if (ignoreCase ? extension.toLowerCase() !== ".md" : extension !== ".md") return null;
  const middle = name.slice(interviewNoteBaseName.length, -3);
  if (!middle) return { company: null, index: 0 };
  if (!middle.startsWith("_")) return null;
  const rest = middle.slice(1);
  if (/^[1-9]\d{0,3}$/.test(rest)) return { company: null, index: Number(rest) };
  const numbered = /^(.+)_([1-9]\d{0,3})$/u.exec(rest);
  const company = numbered ? numbered[1] : rest;
  return isCompanyPart(company) ? { company, index: numbered ? Number(numbered[2]) : 0 } : null;
};

export const interviewNoteFileName = (company: string | null, index: number) =>
  `${interviewNoteBaseName}${company ? `_${company}` : ""}${index ? `_${index}` : ""}.md`;

/** Older names first (base, _1, _2 …), then per company part, each in its own numeric order. */
export const compareInterviewNoteNames = (left: string, right: string) => {
  const a = parseInterviewNoteFileName(left);
  const b = parseInterviewNoteFileName(right);
  if (!a || !b) return left.localeCompare(right);
  if ((a.company === null) !== (b.company === null)) return a.company === null ? -1 : 1;
  return (a.company ?? "").localeCompare(b.company ?? "", "de") || a.index - b.index || left.localeCompare(right);
};

/** The next free name for this company part: the base name when none is taken, else one above the highest number. */
export const nextInterviewNoteFileName = (company: string | null, takenNames: readonly string[]) => {
  const indices = takenNames
    .map((name) => parseInterviewNoteFileName(name, { ignoreCase: true }))
    .filter((parsed): parsed is InterviewNoteName =>
      parsed !== null && (parsed.company ?? "").toLowerCase() === (company ?? "").toLowerCase())
    .map((parsed) => parsed.index);
  return interviewNoteFileName(company, indices.length ? Math.max(...indices) + 1 : 0);
};

export const interviewStages: readonly ApplicationStatus[] = ["Vorstellungsgespräch", "Zweites Gespräch"];
export const isInterviewStage = (status: ApplicationStatus | undefined) =>
  Boolean(status && interviewStages.includes(status));

const closedStatuses: readonly ApplicationStatus[] = ["Absage", "Zurückgezogen", "Archiviert"];

/** The button shows in the interview stages and for an active Bewerbung with a saved interview date. */
export const showsInterviewPreparation = (
  application: Pick<Application, "status" | "interviewAt" | "secondInterviewAt">,
) =>
  isInterviewStage(application.status) ||
  (!closedStatuses.includes(application.status) &&
    Boolean(application.interviewAt || application.secondInterviewAt));

/**
 * A Bewerbung that has (or had) an interview: its interview folder belongs to it. Used to detect a folder that two
 * Bewerbungen would share (same company, same interview day).
 */
export const hasInterviewHistory = (
  application: Pick<Application, "status" | "interviewAt" | "secondInterviewAt" | "statusHistory">,
) =>
  isInterviewStage(application.status) ||
  Boolean(application.interviewAt || application.secondInterviewAt) ||
  application.statusHistory.some((entry) => isInterviewStage(entry.to));

type SectionKind = "explanation" | "answer";

const sectionLabels: Record<SectionKind, string> = {
  explanation: "Erklärung",
  answer: "Antwort",
};

type LabelMatch =
  | { kind: "question"; number: number | null; text: string; level: number | null }
  /** `heading`: a heading with more words ("### Antwort A – kurz"); it opens the section and stays its content. */
  | { kind: SectionKind; text: string; plain: boolean; heading: string | null };

const fencePattern = /^ {0,3}(`{3,}|~{3,})/;
const thematicBreakPattern = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const notWordCharacter = "(?![\\p{L}\\p{N}])";
const questionLabel = new RegExp(`^frage${notWordCharacter}[ \\t]*(\\d{1,4})?[ \\t]*(?:\\*\\*|__)?[ \\t]*([:.)])?`, "iu");
const sectionLabel = new RegExp(`^(erklärung|erklaerung|antwort)${notWordCharacter}[ \\t]*(?:\\*\\*|__)?[ \\t]*(:)?`, "iu");

/** Removes a closing `**` / `__` that belongs to a bold label ("**Frage 1:** Text"). */
const stripBoldRemainder = (text: string, bold: string | undefined) => {
  let rest = text.trim();
  if (bold && rest.startsWith(bold)) rest = rest.slice(bold.length).trim();
  if (bold && rest.endsWith(bold) && !rest.slice(0, -bold.length).includes(bold)) rest = rest.slice(0, -bold.length).trim();
  return rest;
};

/** A line that starts a question or a section: at the line start, optionally as Markdown heading or bold. */
const matchLabel = (line: string): LabelMatch | null => {
  let rest = line;
  const heading = /^ {0,3}(#{1,6})[ \t]+/.exec(rest);
  if (heading) rest = rest.slice(heading[0].length);
  else {
    const indent = /^ {0,3}/.exec(rest)?.[0] ?? "";
    rest = rest.slice(indent.length);
  }
  const bold = /^(\*\*|__)/.exec(rest)?.[1];
  if (bold) rest = rest.slice(bold.length);

  const question = questionLabel.exec(rest);
  if (question) {
    const punctuation = question[2];
    // A plain line needs the colon ("Frage 2 wäre …" in an answer stays text); a heading may omit it.
    if (heading ? question[1] || punctuation || !rest.slice(question[0].length).trim() : punctuation === ":") {
      return {
        kind: "question",
        number: question[1] ? Number(question[1]) : null,
        text: stripBoldRemainder(rest.slice(question[0].length), bold),
        level: heading ? heading[1].length : null,
      };
    }
  }
  const section = sectionLabel.exec(rest);
  // "Antwort – ausführliche Version:" names its section like a heading: the label with a dash, ending in a colon.
  const namedLine = Boolean(section && !heading && section[2] !== ":" &&
    /^[–—-][ \t]*\S.*:[ \t]*(?:\*\*|__)?[ \t]*$/u.test(rest.slice(section[0].length).trim()));
  if (section && (heading || section[2] === ":" || namedLine)) {
    const remainder = stripBoldRemainder(rest.slice(section[0].length), bold);
    // "### Antwort" / "### Antwort: Text" is the label; "### Antwort A – 60 Sekunden" is a heading of the answer.
    const keepsHeading = Boolean((heading && section[2] !== ":" && remainder) || namedLine);
    return {
      kind: section[1].toLowerCase() === "antwort" ? "answer" : "explanation",
      text: keepsHeading ? "" : remainder,
      plain: !heading,
      heading: keepsHeading ? line.trim() : null,
    };
  }
  return null;
};

const trimBlankLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
};

type DraftBlock = {
  number: number | null;
  question: string;
  line: number;
  level: number | null;
  sections: Partial<Record<SectionKind, string[]>>;
  order: SectionKind[];
  current: SectionKind | "following" | null;
  /** The question text comes on the next line ("Frage 1:" alone). */
  awaitingQuestionText: boolean;
  /** Text between the question and its first label: the Antwort (or the Erklärung) when that label is absent. */
  lead: string[];
  leadLine: number;
  following: string[] | null;
  /** First line of a repeated plain label inside an open section (reported once per question). */
  nestedLabelLine?: number;
};

const headingLevel = (line: string) => /^ {0,3}(#{1,6})[ \t]+\S/.exec(line)?.[1].length ?? 0;

export const normalizeInterviewText = (text: string) =>
  text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").normalize("NFC");

/**
 * Splits pasted text or a saved Markdown file into questions. Labels are recognised at the line start
 * ("Frage 1:", "Erklärung:", "Antwort:", also as `##`/`###` headings, bold or in other letter case); lines inside
 * fenced code blocks are content. Nothing is dropped silently: text that belongs to no section is an error.
 */
export const parseInterviewQuestions = (input: string): InterviewParseResult => {
  const issues: InterviewParseIssue[] = [];
  const text = normalizeInterviewText(input);
  if (!text.trim()) {
    return { questions: [], issues: [{ severity: "error", line: 1, message: "Bitte fügen Sie Fragen, Erklärungen und Antworten ein." }] };
  }
  if (text.length > interviewNoteLimits.maxTextLength) {
    return {
      questions: [],
      issues: [{
        severity: "error",
        line: 1,
        message: `Der Text ist zu lang (höchstens ${interviewNoteLimits.maxTextLength.toLocaleString("de-DE")} Zeichen).`,
      }],
    };
  }

  const lines = text.split("\n");
  const blocks: DraftBlock[] = [];
  let block: DraftBlock | null = null;
  let title: string | undefined;
  const intro: string[] = [];
  let fence: { marker: string; line: number } | null = null;

  const addContent = (line: string, lineNumber: number) => {
    if (!block) {
      // The first line as "# Titel" is the document title; everything else before the first question is its intro.
      if (title === undefined && !intro.some((entry) => entry.trim()) && !fence && /^ {0,3}#[ \t]+\S/.test(line)) {
        title = line.replace(/^ {0,3}#[ \t]+/, "").replace(/[ \t]+#+[ \t]*$/, "").trim();
        return;
      }
      intro.push(line);
      return;
    }
    if (block.current === "following") {
      block.following!.push(line);
      return;
    }
    if (!block.current) {
      if (!block.lead.length) {
        // Blank lines and the "---" separator after a question without sections carry no content.
        if (!line.trim() || (!fence && thematicBreakPattern.test(line))) return;
        if (block.awaitingQuestionText && !fence) {
          block.question = line.trim();
          block.awaitingQuestionText = false;
          return;
        }
        block.leadLine = lineNumber;
      }
      block.lead.push(line);
      return;
    }
    block.sections[block.current]!.push(line);
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (fence) {
      addContent(line, lineNumber);
      const closing = fencePattern.exec(line);
      if (closing && closing[1][0] === fence.marker[0] && closing[1].length >= fence.marker.length &&
          !line.trim().slice(closing[1].length).trim()) {
        fence = null;
      }
      return;
    }
    const opening = fencePattern.exec(line);
    if (opening) {
      fence = { marker: opening[1], line: lineNumber };
      addContent(line, lineNumber);
      return;
    }
    const label = matchLabel(line);
    if (label?.kind === "question") {
      block = {
        number: label.number,
        question: label.text,
        line: lineNumber,
        level: label.level,
        sections: {},
        order: [],
        current: null,
        awaitingQuestionText: !label.text,
        lead: [],
        leadLine: lineNumber,
        following: null,
      };
      blocks.push(block);
      return;
    }
    if (label && block && block.current !== "following") {
      // A label whose section is already open is part of that section's text: answers with variants
      // ("### Antwort A", "### Antwort B") or sub-questions with their own "Erklärung:"/"Antwort:" lines.
      if (block.sections[label.kind]) {
        if (label.plain && !block.nestedLabelLine) {
          block.nestedLabelLine = lineNumber;
          issues.push({
            severity: "warning",
            code: "nested-label",
            line: lineNumber,
            message: `${questionName(block)}: „${sectionLabels[label.kind]}:“ steht ab Zeile ${lineNumber} ein weiteres Mal und wird als Text des Abschnitts „${sectionLabels[block.current!]}“ übernommen.`,
          });
        }
        addContent(line, lineNumber);
        return;
      }
      block.sections[label.kind] = [];
      block.order.push(label.kind);
      block.current = label.kind;
      block.awaitingQuestionText = false;
      if (label.heading) block.sections[label.kind]!.push(label.heading);
      else if (label.text) block.sections[label.kind]!.push(label.text);
      return;
    }
    // A heading on the question's own level or above ends the question, as in any Markdown outline: "## 9.
    // Stressfragen" after "### Frage 10:", or "## Phase 5 – Abschluss" after "## Frage 8:", is document text again
    // and is shown at the start of the next question. Directly under "### Antwort" (nothing written yet) it is the
    // answer's own title ("## Mein persönlicher Spickzettel") and stays in it.
    const level = headingLevel(line);
    const written = block === null ? [] : block.current === null ? block.lead
      : block.current === "following" ? [] : block.sections[block.current]!;
    if (block && block.current !== "following" && block.level !== null && level >= 1 && level <= block.level &&
        written.some((entry) => entry.trim())) {
      block.current = "following";
      block.following = [line];
      return;
    }
    addContent(line, lineNumber);
  });

  const openFence = fence as { marker: string; line: number } | null;
  if (openFence) {
    issues.push({
      severity: "warning",
      line: openFence.line,
      message: `Zeile ${openFence.line}: Der Codeblock wird nicht geschlossen.`,
    });
  }

  if (!blocks.length) {
    // Without any question, the per-line messages would only repeat this one.
    return {
      questions: [],
      issues: [{
        severity: "error",
        line: 1,
        message: "Es wurde keine Frage erkannt. Jede Frage beginnt am Zeilenanfang mit „Frage 1:“, „Frage 2:“ usw.",
      }],
    };
  }
  if (blocks.length > interviewNoteLimits.maxQuestions) {
    issues.push({
      severity: "error",
      line: blocks[interviewNoteLimits.maxQuestions].line,
      message: `Es sind höchstens ${interviewNoteLimits.maxQuestions} Fragen pro Datei möglich.`,
    });
  }

  const questions = blocks.map((draft, index): InterviewQuestion => {
    // Text before the first label is the Antwort when there is no "Antwort:", else the Erklärung when there is no
    // "Erklärung:"; only with both labels it belongs to nothing.
    const lead = trimBlankLines(draft.lead);
    if (lead.length) {
      const kind = !draft.sections.answer ? "answer" : !draft.sections.explanation ? "explanation" : null;
      if (kind) {
        draft.sections[kind] = lead;
        draft.order.unshift(kind);
      } else {
        issues.push({
          severity: "error",
          line: draft.leadLine,
          message: `${questionName(draft)}: Zeile ${draft.leadLine} steht vor „Erklärung:“ und „Antwort:“ und gehört zu keinem der beiden Abschnitte.`,
        });
      }
    }
    // The separator the serializer writes after a question ("---") is not content of its last part.
    if (index < blocks.length - 1) {
      const lastPart = draft.following ?? (draft.order.length ? draft.sections[draft.order.at(-1)!]! : null);
      if (lastPart) {
        const content = trimBlankLines(lastPart);
        if (content.length && thematicBreakPattern.test(content.at(-1)!)) content.pop();
        lastPart.splice(0, lastPart.length, ...content);
      }
    }
    const joined = (content: string[] | null | undefined) => content ? trimBlankLines(content).join("\n") : undefined;
    return {
      number: draft.number,
      question: draft.question,
      explanation: joined(draft.sections.explanation),
      answer: joined(draft.sections.answer),
      line: draft.line,
      // Level 2 is what the serializer writes anyway; only another level is kept.
      ...(draft.level !== null && draft.level !== 2 ? { level: draft.level } : {}),
      ...(joined(draft.following) ? { following: joined(draft.following) } : {}),
    };
  });

  questions.forEach((question, index) => {
    const name = questionName(question, index);
    if (!question.question) {
      issues.push({ severity: "error", line: question.line, message: `${name}: Der Fragetext fehlt.` });
    }
    for (const kind of ["explanation", "answer"] as const) {
      const value = question[kind];
      if (value === undefined) {
        issues.push({
          severity: "warning",
          line: question.line,
          message: `${name}: „${sectionLabels[kind]}:“ fehlt.`,
          ...(kind === "explanation" ? { code: "missing-explanation" as const } : {}),
        });
      } else if (!value.trim()) {
        issues.push({
          severity: "warning",
          line: question.line,
          message: `${name}: „${sectionLabels[kind]}:“ ist leer.`,
        });
      }
    }
  });
  issues.push(...numberingIssues(questions));
  const introText = trimBlankLines(intro).join("\n");
  return {
    ...(title !== undefined ? { title } : {}),
    ...(introText ? { intro: introText } : {}),
    questions,
    issues: sortIssues(issues),
  };
};

const questionName = (question: Pick<InterviewQuestion, "number" | "line">, index?: number) =>
  question.number !== null
    ? `Frage ${question.number}`
    : index !== undefined ? `Frage ohne Nummer (Position ${index + 1})` : `Frage ohne Nummer (Zeile ${question.line})`;

const numberingIssues = (questions: InterviewQuestion[]): InterviewParseIssue[] => {
  const issues: InterviewParseIssue[] = [];
  const seen = new Set<number>();
  let previous: number | null = null;
  questions.forEach((question, index) => {
    if (question.number === null) {
      issues.push({
        severity: "warning",
        line: question.line,
        message: `Zeile ${question.line}: Die ${index + 1}. Frage hat keine Nummer.`,
      });
      return;
    }
    if (seen.has(question.number)) {
      issues.push({
        severity: "warning",
        line: question.line,
        message: `Zeile ${question.line}: Die Nummer „Frage ${question.number}“ kommt mehrfach vor.`,
      });
    } else {
      const expected: number = previous === null ? 1 : previous + 1;
      if (question.number !== expected) {
        issues.push({
          severity: "warning",
          line: question.line,
          message: previous === null
            ? `Zeile ${question.line}: Die Nummerierung beginnt mit Frage ${question.number} statt mit Frage 1.`
            : `Zeile ${question.line}: Frage ${question.number} folgt auf Frage ${previous} – erwartet wurde Frage ${expected}.`,
        });
      }
    }
    seen.add(question.number);
    previous = question.number;
  });
  return issues;
};

const sortIssues = (issues: InterviewParseIssue[]) =>
  [...issues].sort((a, b) => a.line - b.line || (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));

export const hasBlockingIssues = (result: InterviewParseResult) =>
  !result.questions.length || result.issues.some((issue) => issue.severity === "error");

/**
 * The Markdown the app saves: `# <Titel>` (default `Vorstellungsgespräch`), the intro, one `## Frage n: …` per
 * question (or the heading level the text used, e.g. `### Frage n:`) with `### Erklärung` and `### Antwort` one level
 * below, the question's following document text, questions separated by `---`. Absent sections are not invented;
 * `parseInterviewQuestions` reads it back unchanged.
 */
export const serializeInterviewQuestions = (
  questions: readonly InterviewQuestion[],
  document: Pick<InterviewParseResult, "title" | "intro"> = {},
) => {
  const blocks = questions.map((question) => {
    const level = question.level ?? 2;
    const lines = [`${"#".repeat(level)} Frage${question.number !== null ? ` ${question.number}` : ""}: ${question.question}`];
    for (const kind of ["explanation", "answer"] as const) {
      const value = question[kind];
      if (value === undefined) continue;
      lines.push("", `${"#".repeat(Math.min(level + 1, 6))} ${sectionLabels[kind]}`);
      if (value) lines.push(value);
    }
    if (question.following) lines.push("", question.following);
    return lines.join("\n");
  });
  const intro = document.intro ? `${document.intro}\n\n` : "";
  return `# ${document.title || interviewNoteTitle}\n\n${intro}${blocks.join("\n\n---\n\n")}\n`;
};
