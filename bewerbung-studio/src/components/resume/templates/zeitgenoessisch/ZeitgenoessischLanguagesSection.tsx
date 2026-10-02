import type { ApplicantProfile } from "../../../../shared/schema";
import {
  parseZeitgenoessischLanguage,
  uniqueZeitgenoessischValues,
} from "./zeitgenoessisch.model";
import { ZeitgenoessischSectionHeading } from "./ZeitgenoessischSectionHeading";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { LanguageLevelText } from "../LanguageLevelText";

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
        {languages.map((language) => (
          <article
            className="zeitgenoessisch-language"
            key={language.raw}
          >
            {atsMode ? (
              <p>{language.raw}</p>
            ) : (
              <div>
                <h3>{language.name}<LanguageLevelText level={language.level} /></h3>
                <span
                  className="zeitgenoessisch-language__dots"
                  aria-label={`${language.name}: ${language.level}`}
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
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
