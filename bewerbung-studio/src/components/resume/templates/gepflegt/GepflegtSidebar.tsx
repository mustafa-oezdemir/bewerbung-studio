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
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { LanguageLevelText } from "../LanguageLevelText";

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
    const contact = profile?.email || profile?.phone || profile?.linkedin;
    return (
      <aside className="gepflegt-sidebar gepflegt-sidebar--continuation">
        <div className="gepflegt-sidebar__continuation">
          <p>{resolveResumeHeading(profile).kicker}</p>
          <h2>{name}</h2>
          {profile?.title ? <span>{profile.title}</span> : null}
          <i aria-hidden="true" />
          <small>
            Fortsetzung · Seite {pageNumber} von {totalPages}
          </small>
          {contact ? <span>{contact}</span> : null}
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
            {languages.map((language) => (
              <li key={language.raw}>
                <div>
                  <strong>{language.name}<LanguageLevelText level={language.level} /></strong>
                  {atsMode ? <span>{language.level}</span> : null}
                </div>
                {!atsMode ? (
                  <span className="gepflegt-language-dots" aria-label={`${language.name}: ${language.level}`} role="img">
                    {Array.from({ length: 6 }, (_, index) => (
                      <i
                        className={index < language.score ? "is-filled" : ""}
                        key={index}
                      />
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
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
