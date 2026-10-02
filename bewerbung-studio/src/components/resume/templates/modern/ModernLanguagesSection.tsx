import { LanguageLevelText } from "../LanguageLevelText";
/**
 * ModernLanguagesSection component
 * Renders languages with proficiency levels (dots in visual mode, text in ATS mode)
 */

import type { ModernLanguagesSectionProps } from "./modern.types";
import { parseTemplateLanguage } from "../resume-template-data";
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
          const parsed = parseTemplateLanguage(lang);

          return (
            <li key={idx} className="modern-languages-item">
              <div className="modern-languages-item__header">
                <span className="modern-languages-item__name">{parsed.name}{!atsMode ? <LanguageLevelText level={parsed.level} /> : null}</span>
              </div>
              {!atsMode && (
                <div
                  className="modern-languages-item__dots"
                  aria-label={`${parsed.name}: ${parsed.level}`}
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
              {atsMode && (
                <span className="modern-languages-item__level">
                  {parsed.level}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
