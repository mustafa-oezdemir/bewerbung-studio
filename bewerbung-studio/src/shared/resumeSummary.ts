import { updateManagerSection } from "../features/resume-sections/resume-manager";
import { getResumeSemanticSection } from "../features/resume-sections/resume-section-system";
import type { ApplicantProfile } from "./schema";

/** Kurzprofil is owned by ApplicantProfile. Old documents.resumeProfile text remains archived and readable in the editor. */
export type ResumeSummaryOverride = string | undefined;

export type ResumeSummarySource = "profile" | "none";

const text = (value: string | undefined) => value?.trim() ?? "";

/** The Kurzprofil shown by preview, PDF, Word and pagination. */
export const resolveResumeSummary = (
  profile: Pick<ApplicantProfile, "summary"> | undefined,
  _legacyResumeProfile?: ResumeSummaryOverride,
) => text(profile?.summary);

export const getResumeSummarySource = (
  profile: Pick<ApplicantProfile, "summary"> | undefined,
  _legacyResumeProfile?: ResumeSummaryOverride,
): ResumeSummarySource =>
  text(profile?.summary) ? "profile" : "none";

// --- counting and soft guidance -----------------------------------------------------------------------

/** Words as a reader counts them: runs of non-space characters that contain a letter or a digit. */
export const countSummaryWords = (value: string | undefined) =>
  (value ?? "").split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

const abbreviations = new Set([
  "bzw", "ca", "etc", "ggf", "vgl", "inkl", "sog", "usw", "bspw", "evtl", "nr", "dr", "prof", "str", "tel", "max",
  "min", "mind", "geb", "ehem", "mio", "mrd", "std", "bzgl", "zzgl", "abs", "ff",
]);
const hasContent = (value: string) => /[\p{L}\p{N}]/u.test(value);

/**
 * Sentences as a reader counts them: pieces ending in . ! ? … (a last piece without a mark counts too). A full
 * stop after an abbreviation ("z. B.", "ca.", "Dr."), a single letter or an ordinal number ("3. Quartal") does
 * not end one, and neither does a mark inside a date ("07.2023") or a decimal ("3.5").
 */
export const countSummarySentences = (value: string | undefined) => {
  const source = (value ?? "").trim();
  let count = 0;
  let last = 0;
  for (const match of source.matchAll(/[.!?…]+(?=\s|$)/g)) {
    const end = match.index ?? 0;
    const before = source.slice(last, end);
    if (!hasContent(before)) {
      last = end + match[0].length;
      continue;
    }
    if (match[0] === ".") {
      const word = /([\p{L}\p{N}]+)$/u.exec(before)?.[1] ?? "";
      const rest = source.slice(end + 1).trimStart();
      if (rest) {
        if (word.length === 1 && /\p{L}/u.test(word)) continue;
        if (abbreviations.has(word.toLowerCase())) continue;
        // "3. Quartal": a short number before a full stop is an ordinal; a year ("bis 2023.") ends the sentence.
        if (/^\d{1,2}$/.test(word)) continue;
      }
    }
    count++;
    last = end + match[0].length;
  }
  return hasContent(source.slice(last)) ? count + 1 : count;
};

export const summaryRecommendation = {
  sentences: { min: 3, max: 5 },
  words: { min: 50, max: 100 },
} as const;

export type SummaryRange = "empty" | "short" | "ok" | "long";
const rangeOf = (value: number, { min, max }: { min: number; max: number }): SummaryRange =>
  value === 0 ? "empty" : value < min ? "short" : value > max ? "long" : "ok";

export type SummaryGuidance = {
  words: number;
  sentences: number;
  wordRange: SummaryRange;
  sentenceRange: SummaryRange;
  /** Both counts inside the recommended range: 3–5 Sätze, ca. 50–100 Wörter. */
  recommended: boolean;
};

/** Soft guidance only: a short or long text is never an error and never stops a save. */
export const getSummaryGuidance = (value: string | undefined): SummaryGuidance => {
  const words = countSummaryWords(value);
  const sentences = countSummarySentences(value);
  const wordRange = rangeOf(words, summaryRecommendation.words);
  const sentenceRange = rangeOf(sentences, summaryRecommendation.sentences);
  return { words, sentences, wordRange, sentenceRange, recommended: wordRange === "ok" && sentenceRange === "ok" };
};

// --- saving ---------------------------------------------------------------------------------------------

/**
 * Tidies a text before it is saved: no spaces at the ends of the text or of a line, no run of spaces inside a
 * line, at most one empty line between paragraphs. Words, punctuation and wording stay exactly as written.
 */
export const normalizeSummaryText = (value: string | undefined) =>
  (value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// --- visibility -----------------------------------------------------------------------------------------

/**
 * Whether the Lebenslauf draws the Kurzprofil. The legacy switch (`resumeSections.profile`), the semantic section
 * and the section manager's override all describe it; turning it off or on writes all three (exactly what the
 * eye in the section panel does), and the text itself is never touched.
 */
export const isResumeSummaryVisible = (
  profile: Pick<ApplicantProfile, "resumeSections" | "resumeSemanticSections" | "resumeManagerOverrides">,
) => {
  const semantic = getResumeSemanticSection(profile.resumeSemanticSections, "summary");
  return (
    profile.resumeSections.profile &&
    semantic.visible &&
    semantic.enabled &&
    profile.resumeManagerOverrides?.summary?.visible !== false
  );
};

export const setResumeSummaryVisible = (profile: ApplicantProfile, visible: boolean): ApplicantProfile =>
  updateManagerSection(profile, "", "summary", { visible });
