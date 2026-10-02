import type { ApplicantProfile } from "../../../../shared/schema";
import {
  parseKreativLanguage,
  uniqueKreativValues,
} from "./kreativ.model";
import { KreativSectionHeading } from "./KreativSectionHeading";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { LanguageLevelText } from "../LanguageLevelText";

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
        {languages.map((language) => (
          <article className="kreativ-language" key={language.raw}>
            {atsMode ? (
              <p>{language.raw}</p>
            ) : (
              <>
                <h3>{language.name}<LanguageLevelText level={language.level} /></h3>
                <span
                  className="kreativ-language__dots"
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
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
