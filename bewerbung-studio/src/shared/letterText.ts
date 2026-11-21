// Word's soft breaks (including U+2028) belong to the current paragraph.
const normalizeLineEndings = (text: string) => text.replace(/\r\n?/g, "\n").replaceAll("\u2029", "\n\n");

export const splitLetterParagraphs = (text: string) => normalizeLineEndings(text)
  .split(/\n[^\S\n\v\u2028]*\n/)
  .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
  .filter(Boolean);

export const letterSectionWarning = "Die automatische Abschnittszuordnung ist nicht eindeutig.";

type LetterSection = "introduction" | "mainBody" | "companyFit" | "closing";
export type LetterTextKind = "anschreiben" | "motivation";

export const letterTextSections = {
  anschreiben: ["introduction", "mainBody", "companyFit", "closing"],
  motivation: ["introduction", "mainBody", "closing"],
} as const;

const headingPattern = /^\s*(?:(?:\(\d+\)|\d+[.):–-]|\d+\s)\s*)?(Einleitung|Hauptteil|Unternehmensbezug|Schlussteil|Schluss)\s*(?::[ \t]*([\s\S]*))?$/iu;
const sectionByHeading: Record<string, LetterSection> = {
  einleitung: "introduction", hauptteil: "mainBody", unternehmensbezug: "companyFit", schlussteil: "closing", schluss: "closing",
};
const headingBySection = {
  introduction: "Einleitung", mainBody: "Hauptteil", companyFit: "Unternehmensbezug", closing: "Schlussteil",
};

export type LetterSections = Record<LetterSection, string>;
const emptySections = (): LetterSections => ({ introduction: "", mainBody: "", companyFit: "", closing: "" });

type LetterTextResult = { sections: LetterSections; unresolved: null } | { sections: null; unresolved: string[] };

export function parseLetterText(kind: LetterTextKind, input: string, stored: LetterSections): LetterTextResult {
  const order: readonly LetterSection[] = letterTextSections[kind];
  const parts = emptySections();
  const paragraphs = splitLetterParagraphs(input);
  if (!paragraphs.length) return { sections: parts, unresolved: null };

  const lines = normalizeLineEndings(input).split("\n");
  const headings = lines.map((line) => line.match(headingPattern));
  if (headings.some(Boolean)) {
    const unassigned: string[] = [];
    const body: string[] = [];
    let current: LetterSection | undefined;
    let previousIndex = -1;
    let ambiguous = false;
    lines.forEach((line, index) => {
      const heading = headings[index];
      if (!heading) {
        (current ? body : unassigned).push(line);
        return;
      }
      if (current) parts[current] = splitLetterParagraphs(body.splice(0).join("\n")).join("\n\n");
      current = sectionByHeading[heading[1].toLowerCase()];
      const rank = order.indexOf(current);
      if (rank <= previousIndex) ambiguous = true;
      previousIndex = rank;
      if (heading[2]) body.push(heading[2]);
    });
    if (current) parts[current] = splitLetterParagraphs(body.join("\n")).join("\n\n");
    if (!ambiguous && !unassigned.join("").trim()) return { sections: parts, unresolved: null };
    return { sections: null, unresolved: paragraphs };
  }

  if (paragraphs.length < order.length) return { sections: null, unresolved: paragraphs };
  parts.introduction = paragraphs[0];
  parts.closing = paragraphs.at(-1)!;
  if (kind === "anschreiben") parts.companyFit = paragraphs.at(-2)!;
  parts.mainBody = paragraphs.slice(1, kind === "anschreiben" ? -2 : -1).join("\n\n");

  // Existing unique paragraphs act as anchors. A positional guess must not move one to another section.
  const previous = order.flatMap((section) => splitLetterParagraphs(stored[section]).map((text) => ({ section, text })));
  for (const section of order) {
    for (const paragraph of splitLetterParagraphs(parts[section])) {
      const matches = previous.filter(({ text }) => text === paragraph);
      if (matches.length === 1 && matches[0].section !== section) return { sections: null, unresolved: paragraphs };
    }
  }
  return { sections: parts, unresolved: null };
}

export function formatLetterText(kind: LetterTextKind, sections: LetterSections) {
  const order: readonly LetterSection[] = letterTextSections[kind];
  const plain = order.map((section) => sections[section]).filter(Boolean).join("\n\n");
  if (!plain) return "";
  const parsed = parseLetterText(kind, plain, sections).sections;
  if (parsed && order.every((section) => parsed[section] === sections[section])) return plain;

  // Show the saved boundaries when blank lines alone cannot describe them.
  return order.map((section) => {
    const heading = kind === "motivation" && section === "closing" ? "Schluss" : headingBySection[section];
    return `${heading}:\n${sections[section]}`.trimEnd();
  }).join("\n\n");
}
