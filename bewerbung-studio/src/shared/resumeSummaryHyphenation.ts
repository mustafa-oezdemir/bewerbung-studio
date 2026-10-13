import germanPatterns from "./hyphenation/hyph-de-1996.pat.txt?raw";
import { textWidthMm } from "./textMetrics";

const softHyphen = "\u00ad";
let patterns: Map<string, number[]> | undefined;
let longestPattern = 0;
const words = new Map<string, string>();

const patternTable = () => {
  if (patterns) return patterns;
  patterns = new Map();
  for (const source of germanPatterns.split(/\s+/)) {
    if (!source) continue;
    let letters = "";
    const values = [0];
    for (const char of source) {
      if (/^[0-9]$/.test(char)) values[letters.length] = Number(char);
      else { letters += char; values.push(0); }
    }
    patterns.set(letters, values);
    longestPattern = Math.max(longestPattern, letters.length);
  }
  return patterns;
};

/** TeX pattern scores: odd maxima are valid German break positions. The source string is never changed. */
export const hyphenateGermanWord = (word: string): string => {
  if (word.length < 5) return word;
  const cached = words.get(word);
  if (cached) return cached;
  const source = word.replaceAll(softHyphen, "");
  const lower = source.toLocaleLowerCase("de-DE");
  if (!/^[a-zäöüß]+$/u.test(lower)) return word;
  const padded = `.${lower}.`;
  const points = new Uint8Array(padded.length + 1);
  const table = patternTable();
  for (let start = 0; start < padded.length; start++) {
    for (let length = 1; length <= longestPattern && start + length <= padded.length; length++) {
      const values = table.get(padded.slice(start, start + length));
      if (!values) continue;
      for (let offset = 0; offset < values.length; offset++)
        points[start + offset] = Math.max(points[start + offset], values[offset]);
    }
  }
  let result = "";
  for (let index = 0; index < source.length; index++) {
    result += source[index];
    const position = index + 1;
    if (position >= 2 && position <= source.length - 2 && points[position + 1] % 2 === 1) result += softHyphen;
  }
  if (words.size > 4096) words.clear();
  words.set(word, result);
  return result;
};

/** A display-only projection. URLs and addresses retain their literal spelling and use CSS overflow fallback. */
export const hyphenateResumeSummary = (text: string): string => text.split(/(\s+)/u).map((token) => {
  if (/^(?:https?:\/\/|www\.)|@/iu.test(token)) return token;
  return token.replace(/[A-Za-zÄÖÜäöüß\u00ad]{5,}/gu, hyphenateGermanWord);
}).join("");

/** The page planner uses the same optional break points as the renderer, with its existing font advances. */
export const summaryWrappedLines = (text: string, widthMm: number, fontMm: number, weight = 400): number => {
  const tokens = hyphenateResumeSummary(text).trim().split(/\s+/u).filter(Boolean);
  if (!tokens.length) return 0;
  // The font metrics are a Segoe/Arial approximation; reserve the observed narrow-column delta.
  const width = Math.max(1, widthMm / 1.12);
  const measure = (value: string) => textWidthMm(value.replaceAll(softHyphen, ""), fontMm, weight);
  const space = measure(" ");
  const hyphen = measure("-");
  let lines = 1;
  let used = 0;
  for (const token of tokens) {
    let parts = token.split(softHyphen);
    const whole = measure(parts.join(""));
    if (used + (used ? space : 0) + whole <= width) {
      used += (used ? space : 0) + whole;
      continue;
    }
    if (used) used += space;
    while (parts.length) {
      let best = 0;
      let prefix = "";
      for (let index = 0; index < parts.length - 1; index++) {
        prefix += parts[index];
        if (used + measure(prefix) + hyphen <= width) best = index + 1;
      }
      if (best) {
        parts = parts.slice(best);
        lines++;
        used = 0;
        continue;
      }
      const rest = parts.join("");
      if (used && used + measure(rest) > width) {
        lines++;
        used = 0;
        continue;
      }
      if (measure(rest) > width) {
        // Only unbreakable technical text reaches this fallback (CSS overflow-wrap: break-word).
        const extra = Math.ceil(measure(rest) / width) - 1;
        lines += extra;
        used = measure(rest) - extra * width;
      } else used += measure(rest);
      break;
    }
  }
  return lines;
};

/** Character offsets after words; a continued paragraph never loses or duplicates source characters. */
export const summaryWordEnds = (text: string): number[] =>
  Array.from(text.matchAll(/\S+(?:\s+|$)/gu), (match) => (match.index ?? 0) + match[0].length);

/**
 * Lines of the hyphenated Kurzprofil as the browser breaks it: greedily at spaces and at the soft hyphens
 * `hyphenateResumeSummary` inserts (a hyphen is drawn at such a break), with the measured font advances and no reserve.
 * Used where a template's planner measures its Kurzprofil exactly (Elegant's sidebar).
 */
export const hyphenatedSummaryLines = (text: string, widthMm: number, fontMm: number, weight = 400): number => {
  const tokens = hyphenateResumeSummary(text).trim().split(/\s+/u).filter(Boolean);
  if (!tokens.length) return 0;
  const measure = (value: string) => textWidthMm(value.replaceAll(softHyphen, ""), fontMm, weight);
  const space = measure(" ");
  const hyphen = measure("-");
  let lines = 1;
  let used = 0;
  for (const token of tokens) {
    let parts = token.split(softHyphen);
    let gap = used ? space : 0;
    while (parts.length) {
      const rest = measure(parts.join(""));
      if (used + gap + rest <= widthMm) {
        used += gap + rest;
        break;
      }
      // The longest prefix that still fits this line with its hyphen; the rest goes on in the next line.
      let best = 0;
      let prefix = "";
      for (let index = 0; index < parts.length - 1; index++) {
        prefix += parts[index];
        if (used + gap + measure(prefix) + hyphen <= widthMm) best = index + 1;
      }
      if (best) parts = parts.slice(best);
      else if (!used) {
        // A piece wider than the whole line breaks anywhere (overflow-wrap).
        const extra = Math.ceil(rest / widthMm) - 1;
        lines += extra;
        used = rest - extra * widthMm;
        break;
      }
      lines += 1;
      used = 0;
      gap = 0;
    }
  }
  return lines;
};
