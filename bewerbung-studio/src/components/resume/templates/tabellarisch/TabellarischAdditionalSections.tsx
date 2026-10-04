import type { ApplicantProfile } from "../../../../shared/schema";
import { TabellarischKnowledge } from "./TabellarischKnowledge";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";

export function TabellarischAdditionalSections({
  profile,
  sections,
  atsMode,
}: {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
  atsMode: boolean;
}) {
  const languages = Array.from(
    new Set((profile?.languages ?? []).map((item) => item.trim()).filter(Boolean)),
  );
  const certifications = Array.from(
    new Set(
      (profile?.certifications ?? [])
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  return (
    <div className="tabellarisch-additional">
      {sections.skills && atsMode ? (
        <TabellarischKnowledge profile={profile} atsMode={atsMode} />
      ) : null}

      {sections.certifications && certifications.length > 0 ? (
        <section
          className="tabellarisch-section tabellarisch-list-section"
          data-element-id="tabellarisch.certifications"
        >
          <h2 className="tabellarisch-section__title">{getResumeSectionTitle(profile, "certifications")}</h2>
          <ul>
            {certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.languages && languages.length > 0 ? (
        <section
          className="tabellarisch-section tabellarisch-list-section"
          data-element-id="tabellarisch.languages"
        >
          <h2 className="tabellarisch-section__title">{getResumeSectionTitle(profile, "languages")}</h2>
          <ul className="tabellarisch-list-section__inline">
            {languages.map((entry) => {
              const language = presentLanguage(entry, profile?.resumeLanguageDisplay, { dots: true, atsMode });
              // With dots the item is name (and level), the dots and – in a line of its own – the description.
              return language.showDots ? (
                <li className="tabellarisch-language tabellarisch-language--dotted" key={entry}>
                  <span>{language.name}<LanguageLevelText presentation={language} /></span>
                  <span className="tabellarisch-language__dots" aria-label={languageDotsLabel(language)} role="img">
                    {Array.from({ length: 6 }, (_, index) => (
                      <i className={index < language.score ? "is-filled" : ""} key={index} />
                    ))}
                  </span>
                  <LanguageDescriptionText presentation={language} />
                </li>
              ) : (
                <li key={entry}>{language.name}<LanguageLevelText presentation={language} /></li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
