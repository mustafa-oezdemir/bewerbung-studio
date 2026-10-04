import type { ApplicantProfile } from "../../../../shared/schema";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import {
  parseIvyLeagueLanguage,
  uniqueIvyLeagueValues,
} from "./ivy-league.model";
import { IvyLeagueSectionHeading } from "./IvyLeagueSectionHeading";
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";

export function IvyLeagueLanguagesSection({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const languages = uniqueIvyLeagueValues(profile?.languages ?? []).map(
    parseIvyLeagueLanguage,
  );
  if (!languages.length) return null;
  const columnCount = Math.min(3, languages.length);

  return (
    <section
      className="ivy-league-section ivy-league-languages-section"
      data-element-id="ivy-league.languages"
    >
      <IvyLeagueSectionHeading>{getResumeSectionTitle(profile, "languages")}</IvyLeagueSectionHeading>
      {atsMode ? (
        <ul className="ivy-league-languages--ats">
          {languages.map((entry) => (
            <li key={entry.raw}>
              {presentLanguage(entry.raw, profile?.resumeLanguageDisplay, { dots: true, atsMode }).primaryText}
            </li>
          ))}
        </ul>
      ) : (
        <div className={`ivy-league-languages ivy-league-languages--columns-${columnCount}`}>
          {languages.map((entry) => {
            const language = presentLanguage(entry.raw, profile?.resumeLanguageDisplay, { dots: true, atsMode });
            return (
              <article className="ivy-league-language" key={entry.raw}>
                <strong>{language.name}<LanguageLevelText presentation={language} /></strong>
                {language.showDots ? (
                  <span className="ivy-league-language__dots" aria-label={languageDotsLabel(language)} role="img">
                    {Array.from({ length: 6 }, (_, index) => (
                      <i
                        className={
                          index < language.score
                            ? "ivy-league-language__dot--active"
                            : ""
                        }
                        key={index}
                      />
                    ))}
                  </span>
                ) : null}
                <LanguageDescriptionText presentation={language} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
