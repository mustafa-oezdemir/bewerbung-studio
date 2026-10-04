import type { ApplicantProfile } from "../../../../shared/schema";
import {
  parseKreativLanguage,
  uniqueKreativValues,
} from "./kreativ.model";
import { KreativSectionHeading } from "./KreativSectionHeading";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";

export function KreativLanguagesSection({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const languages = uniqueKreativValues(profile?.languages ?? []).map(
    parseKreativLanguage,
  );
  if (!languages.length) return null;

  return (
    <section
      className={`kreativ-section kreativ-languages ${atsMode ? "kreativ-languages--ats" : ""}`}
      data-element-id="kreativ.languages"
    >
      <KreativSectionHeading title={getResumeSectionTitle(profile, "languages")} />
      <div className="kreativ-languages__list">
        {languages.map((entry) => {
          const language = presentLanguage(entry.raw, profile?.resumeLanguageDisplay, { dots: true, atsMode });
          return (
            <article className="kreativ-language" key={entry.raw}>
              {atsMode ? (
                <p>{language.primaryText}</p>
              ) : (
                <>
                  <h3>{language.name}<LanguageLevelText presentation={language} /></h3>
                  {language.showDots ? (
                    <span
                      className="kreativ-language__dots"
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
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
