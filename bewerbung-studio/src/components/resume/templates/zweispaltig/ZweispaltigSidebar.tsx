import {
  parseZweispaltigLanguage,
  uniqueZweispaltigValues,
} from "./zweispaltig.model";
import type { ZweispaltigSidebarProps } from "./zweispaltig.types";
import { ZweispaltigKnowledge } from "./ZweispaltigKnowledge";
import { ZweispaltigStrengths } from "./ZweispaltigStrengths";
import { LanguageLevelText } from "../LanguageLevelText";

export function ZweispaltigSidebar({
  profile,
  sections,
  order,
  summary,
}: ZweispaltigSidebarProps) {
  return (
    <aside className="zweispaltig-sidebar">
      <ZweispaltigSupplementalSections
        order={order}
        profile={profile}
        sections={sections}
        summary={summary}
        variant="sidebar"
      />
    </aside>
  );
}

export function ZweispaltigSupplementalSections({
  profile,
  sections,
  order = ["strengths", "knowledge", "languages", "certifications"],
  summary,
  variant,
}: ZweispaltigSidebarProps & {
  variant: "sidebar" | "ats";
}) {
  const languages = uniqueZweispaltigValues(
    profile?.languages ?? [],
  ).map(parseZweispaltigLanguage);
  const certifications = uniqueZweispaltigValues(
    profile?.certifications ?? [],
  );

  const renderSection = (type: ResumeSectionType) => {
    if (type === "summary") {
      return sections.profile && summary ? (
        <section className="zweispaltig-section" data-element-id="zweispaltig.summary">
          <h2 className="zweispaltig-section__title">{getResumeSectionTitle(profile, "summary")}</h2>
          <p className="zweispaltig-summary">{summary}</p>
        </section>
      ) : null;
    }
    if (type === "strengths") {
      return sections.strengths ? <ZweispaltigStrengths profile={profile} variant={variant} /> : null;
    }
    if (type === "knowledge") {
      return sections.skills ? <ZweispaltigKnowledge profile={profile} variant={variant} /> : null;
    }
    if (type === "languages") {
      if (!sections.languages || !languages.length) return null;
      return (
        <section className="zweispaltig-section" data-element-id="zweispaltig.languages">
          <h2 className="zweispaltig-section__title">{getResumeSectionTitle(profile, "languages")}</h2>
          {variant === "ats" ? (
            <ul>{languages.map((language) => <li key={language.raw}>{language.raw}</li>)}</ul>
          ) : (
            <div className="zweispaltig-languages__list">
              {languages.map((language) => (
                <article className="zweispaltig-language" key={language.raw}>
                  <div><h3>{language.name}<LanguageLevelText level={language.level} /></h3></div>
                  <span className="zweispaltig-language__dots" aria-label={`${language.name}: ${language.level}`} role="img">
                    {Array.from({ length: 6 }, (_, index) => <i className={index < language.score ? "is-filled" : ""} key={index} />)}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }
    if (type === "certifications") {
      if (!sections.certifications || !certifications.length) return null;
      return (
        <section className="zweispaltig-section" data-element-id="zweispaltig.certifications">
          <h2 className="zweispaltig-section__title">{getResumeSectionTitle(profile, "certifications")}</h2>
          <ul className="zweispaltig-sidebar__list zweispaltig-sidebar__list--accent">
            {certifications.map((certification) => <li key={certification}>{certification}</li>)}
          </ul>
        </section>
      );
    }
    return null;
  };

  return <>{order.map((type) => <Fragment key={type}>{renderSection(type)}</Fragment>)}</>;
}
import { Fragment } from "react";
import {
  getResumeSectionTitle,
  type ResumeSectionType,
} from "../../../../features/resume-sections/resume-sections";
