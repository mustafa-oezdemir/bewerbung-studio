import { languageDotsLabel, resolveLanguagePresentation, type LanguagePresentation } from "../../../features/languages/language-levels";

export { languageDotsLabel };

/**
 * One language as the Lebenslauf shows it (Lebenslauf → Sprachen: Punkte, Niveau, Beschreibung). Every template asks the
 * shared resolver instead of printing the stored text; `dots` says that the template draws level dots, `atsMode` that the
 * level is written as text. The PDF uses the same result in `languageLevelMarkup` / `languageDescriptionMarkup`.
 */
export const presentLanguage = (
  raw: string,
  display: unknown,
  { dots = false, atsMode = false }: { dots?: boolean; atsMode?: boolean } = {},
): LanguagePresentation => resolveLanguagePresentation(raw, display, { dots, ats: atsMode });

/** The part of the first line behind the language name: " – C1" or " – C1 · Verhandlungssicher". */
export function LanguageLevelText({ presentation }: { presentation: LanguagePresentation }) {
  if (!presentation.detail) return null;
  return <span className="resume-language-level">{" – "}{presentation.detail}</span>;
}

/** With dots: the words of the level in a line of their own behind the dots ("Verhandlungssicher"). */
export function LanguageDescriptionText({ presentation }: { presentation: LanguagePresentation }) {
  if (!presentation.secondaryText) return null;
  return <small className="resume-language-description">{presentation.secondaryText}</small>;
}
