import type { ApplicantProfile } from "../../../../shared/schema";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import {
  parseIvyLeagueLanguage,
  uniqueIvyLeagueValues,
} from "./ivy-league.model";
import { IvyLeagueSectionHeading } from "./IvyLeagueSectionHeading";
import { LanguageLevelText } from "../LanguageLevelText";

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
          {languages.map((language) => (
            <li key={language.raw}>
              {language.name}
              {language.level ? ` – ${language.level}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <div className={`ivy-league-languages ivy-league-languages--columns-${columnCount}`}>
          {languages.map((language) => (
            <article className="ivy-league-language" key={language.raw}>
              <strong>{language.name}<LanguageLevelText level={language.level} /></strong>
              <span className="ivy-league-language__dots" aria-label={`${language.name}: ${language.level}`} role="img">
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
