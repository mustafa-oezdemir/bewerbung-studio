import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";
import {
  getTemplateKnowledge,
  parseTemplateLanguage,
  parseTemplateStrengths,
  uniqueTemplateValues,
} from "../resume-template-data";
import { GepflegtSidebarPhoto } from "./GepflegtSidebarPhoto";
import type { GepflegtSidebarProps } from "./gepflegt.types";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";
import { formatPhoneForDisplay } from "../../../../shared/contactPresentation";

export function GepflegtSidebar({
  profile,
  name,
  summary,
  sections,
  atsMode,
  photoSource,
  isContinuation,
  pageNumber,
  totalPages,
}: GepflegtSidebarProps) {
  const strengths = parseTemplateStrengths(profile, 3);
  const languages = uniqueTemplateValues(profile?.languages ?? []).map(
    parseTemplateLanguage,
  );
  const knowledge = getTemplateKnowledge(profile);
  const certifications = uniqueTemplateValues(
    profile?.certifications ?? [],
  );

  if (!atsMode && isContinuation) {
    // The header of the main column repeats name and Berufsbezeichnung: the sidebar keeps only the page cue and what
    // the user chose for later pages (Lebenslauf → Persönliche Daten), never the address or a link.
    const continuation = profile?.resumeContinuationContactVisibility;
    const email = continuation?.email ? profile?.email?.trim() : "";
    const phone = continuation?.phone ? profile?.phone?.trim() : "";
    return (
      <aside className="gepflegt-sidebar gepflegt-sidebar--continuation">
        <div className="gepflegt-sidebar__continuation">
          <small>
            Fortsetzung · Seite {pageNumber} von {totalPages}
          </small>
          {email ? <span>{email}</span> : null}
          {phone ? <span>{formatPhoneForDisplay(phone)}</span> : null}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`gepflegt-sidebar ${atsMode ? "gepflegt-sidebar--ats" : ""}`}
      data-element-id="gepflegt.sidebar"
    >
      {!atsMode ? (
        <GepflegtSidebarPhoto
          photoSource={photoSource}
          name={name}
          atsMode={false}
        />
      ) : null}

      {!atsMode && summary ? (
        <section
          className="gepflegt-sidebar__section"
          data-element-id="gepflegt.summary"
        >
          <h2 className="gepflegt-sidebar__title">{getResumeSectionTitle(profile, "summary")}</h2>
          <p className="gepflegt-sidebar__summary">{summary}</p>
        </section>
      ) : null}

      {sections.strengths && strengths.length ? (
        <section
          className="gepflegt-sidebar__section"
          data-element-id="gepflegt.strengths"
        >
          <h2 className="gepflegt-sidebar__title">{getResumeSectionTitle(profile, "strengths")}</h2>
          <div className="gepflegt-strengths">
            {strengths.map((strength, index) => (
                <article className="gepflegt-strength" key={`${strength.title}-${index}`}>
                  {!atsMode ? <TechnologyBrandIcon technology={strength.title} iconId={strength.iconId} /> : null}
                  <div>
                    <h3>{strength.title}</h3>
                    {strength.description ? <p>{strength.description}</p> : null}
                  </div>
                </article>
            ))}
          </div>
        </section>
      ) : null}

      {sections.languages && languages.length ? (
        <section
          className="gepflegt-sidebar__section"
          data-element-id="gepflegt.languages"
        >
          <h2 className="gepflegt-sidebar__title">{getResumeSectionTitle(profile, "languages")}</h2>
          <ul className="gepflegt-languages">
            {languages.map((entry) => {
              const language = presentLanguage(entry.raw, profile?.resumeLanguageDisplay, { dots: true, atsMode });
              return (
                <li key={entry.raw}>
                  <div>
                    <strong>{language.name}<LanguageLevelText presentation={language} /></strong>
                  </div>
                  {language.showDots ? (
                    <span className="gepflegt-language-dots" aria-label={languageDotsLabel(language)} role="img">
                      {Array.from({ length: 6 }, (_, index) => (
                        <i
                          className={index < language.score ? "is-filled" : ""}
                          key={index}
                        />
                      ))}
                    </span>
                  ) : null}
                  <LanguageDescriptionText presentation={language} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {sections.skills && knowledge.length ? (
        <section
          className="gepflegt-sidebar__section"
          data-element-id="gepflegt.skills"
        >
          <h2 className="gepflegt-sidebar__title">{getResumeSectionTitle(profile, "knowledge")}</h2>
          <p className="gepflegt-knowledge">{knowledge.join(" · ")}</p>
        </section>
      ) : null}

      {sections.certifications && certifications.length ? (
        <section
          className="gepflegt-sidebar__section"
          data-element-id="gepflegt.certifications"
        >
          <h2 className="gepflegt-sidebar__title">{getResumeSectionTitle(profile, "certifications")}</h2>
          <ul className="gepflegt-certifications">
            {certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
