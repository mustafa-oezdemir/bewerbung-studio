import type { ApplicantProfile } from "../../../../shared/schema";
import {
  parseZeitgenoessischLanguage,
  uniqueZeitgenoessischValues,
} from "./zeitgenoessisch.model";
import { ZeitgenoessischSectionHeading } from "./ZeitgenoessischSectionHeading";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";

export function ZeitgenoessischLanguagesSection({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const languages = uniqueZeitgenoessischValues(
    profile?.languages ?? [],
  ).map(parseZeitgenoessischLanguage);
  if (!languages.length) return null;

  return (
    <section
      className={`zeitgenoessisch-section zeitgenoessisch-languages ${atsMode ? "zeitgenoessisch-languages--ats" : ""}`}
      data-element-id="zeitgenoessisch.languages"
    >
      <ZeitgenoessischSectionHeading title={getResumeSectionTitle(profile, "languages")} icon="languages" />
      <div className="zeitgenoessisch-languages__list">
        {languages.map((entry) => {
          const language = presentLanguage(entry.raw, profile?.resumeLanguageDisplay, { dots: true, atsMode });
          return (
            <article
              className="zeitgenoessisch-language"
              key={entry.raw}
            >
              {atsMode ? (
                <p>{language.primaryText}</p>
              ) : (
                <div>
                  <h3>{language.name}<LanguageLevelText presentation={language} /></h3>
                  {language.showDots ? (
                    <span
                      className="zeitgenoessisch-language__dots"
                      aria-label={languageDotsLabel(language)}
                      role="img"
                    >
                      {Array.from({ length: 6 }, (_, index) => (
                        <i
                          className={
                            index < language.score ? "is-filled" : ""
                          }
                          key={index}
                        />
                      ))}
                    </span>
                  ) : null}
                  <LanguageDescriptionText presentation={language} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
