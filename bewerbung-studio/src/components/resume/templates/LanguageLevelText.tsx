import { describeLanguageLevel } from "../../../features/languages/language-levels";

/** The level of a language in words, next to the dots of the visual templates (the PDF uses `languageLevelMarkup`). */
export function LanguageLevelText({ level }: { level: string }) {
  const text = describeLanguageLevel(level);
  return text ? <small className="resume-language-level"> {text}</small> : null;
}
