import { uniqueElegantValues } from "./elegant.model";
import { parseTemplateLanguage } from "../resume-template-data";
import type { ElegantSidebarProps } from "./elegant.types";
import { ElegantKnowledge } from "./ElegantKnowledge";
import { ElegantStrengths } from "./ElegantStrengths";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";

export function ElegantSidebar({
  profile,
  name,
  photoSource,
  summary,
  sections,
  isContinuation,
  pageNumber,
  totalPages,
}: ElegantSidebarProps) {
  const languages = uniqueElegantValues(profile?.languages ?? []).map(
    parseTemplateLanguage,
  );
  const certifications = uniqueElegantValues(profile?.certifications ?? []);

  return (
    <aside
      className={`elegant-sidebar ${isContinuation ? "elegant-sidebar--continuation" : ""}`}
      data-element-id="elegant.sidebar"
    >
      {isContinuation ? (
        <div className="elegant-sidebar__continuation">
          <p>{resolveResumeHeading(profile).kicker}</p>
          <h2>{name}</h2>
          {profile?.title ? <span>{profile.title}</span> : null}
          <i aria-hidden="true" />
          <small>
            Fortsetzung · Seite {pageNumber} von {totalPages}
          </small>
          {profile?.resumeContinuationContactVisibility.email && profile.email ? (
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
          ) : null}
          {profile?.resumeContinuationContactVisibility.phone && profile.phone ? (
            <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>
              {profile.phone}
            </a>
          ) : null}
        </div>
      ) : (
        <>
          {photoSource ? (
            <figure
              className="elegant-sidebar__photo"
              data-element-id="elegant.photo"
            >
              <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
            </figure>
          ) : null}

          {sections.profile && summary ? (
            <section
              className="elegant-sidebar__section"
              data-element-id="elegant.summary"
            >
              <h2 className="elegant-sidebar__title">{getResumeSectionTitle(profile, "summary")}</h2>
              <p className="elegant-sidebar__summary">{summary}</p>
            </section>
          ) : null}

          {sections.strengths ? (
            <ElegantStrengths profile={profile} variant="sidebar" />
          ) : null}

          {sections.skills ? (
            <ElegantKnowledge profile={profile} variant="sidebar" />
          ) : null}

          {sections.languages && languages.length ? (
            <section
              className="elegant-sidebar__section"
              data-element-id="elegant.languages"
            >
              <h2 className="elegant-sidebar__title">{getResumeSectionTitle(profile, "languages")}</h2>
              <div className="elegant-languages">
                {languages.map((entry) => {
                  const language = presentLanguage(entry.raw, profile?.resumeLanguageDisplay, { dots: true });
                  return (
                    <article className="elegant-language" key={entry.raw}>
                      <strong>{language.name}<LanguageLevelText presentation={language} /></strong>
                      {language.showDots ? (
                        <span className="elegant-language__dots" aria-label={languageDotsLabel(language)} role="img">
                          {Array.from({ length: 6 }, (_, index) => (
                            <i
                              className={index < language.score ? "filled" : ""}
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
            </section>
          ) : null}

          {sections.certifications && certifications.length ? (
            <section
              className="elegant-sidebar__section"
              data-element-id="elegant.certifications"
            >
              <h2 className="elegant-sidebar__title">{getResumeSectionTitle(profile, "certifications")}</h2>
              <ul className="elegant-sidebar__list">
                {certifications.map((certification) => (
                  <li key={certification}>{certification}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </aside>
  );
}
