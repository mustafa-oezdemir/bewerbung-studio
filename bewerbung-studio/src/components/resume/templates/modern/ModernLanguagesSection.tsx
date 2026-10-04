import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";
/**
 * ModernLanguagesSection component
 * Renders languages with proficiency levels (dots in visual mode, text in ATS mode)
 */

import type { ModernLanguagesSectionProps } from "./modern.types";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function ModernLanguagesSection({
  profile,
  accentColor,
  atsMode,
}: ModernLanguagesSectionProps) {
  if (!profile?.languages || profile.languages.length === 0) {
    return null;
  }

  return (
    <section className="modern-section">
      <h2 className="modern-section__title">{getResumeSectionTitle(profile, "languages")}</h2>
      <ul className="modern-languages-list">
        {profile.languages.map((lang: string, idx: number) => {
          const parsed = presentLanguage(lang, profile?.resumeLanguageDisplay, { dots: true, atsMode });

          return (
            <li key={idx} className="modern-languages-item">
              <div className="modern-languages-item__header">
                <span className="modern-languages-item__name">{parsed.name}<LanguageLevelText presentation={parsed} /></span>
              </div>
              {parsed.showDots && (
                <div
                  className="modern-languages-item__dots"
                  aria-label={languageDotsLabel(parsed)}
                  role="img"
                  style={{ color: accentColor }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span
                      className={i < parsed.score ? "is-filled" : ""}
                      key={i}
                    />
                  ))}
                </div>
              )}
              <LanguageDescriptionText presentation={parsed} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
