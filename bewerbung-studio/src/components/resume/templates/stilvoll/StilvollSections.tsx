import type { ReactNode } from "react";
import type { ApplicantProfile } from "../../../../shared/schema";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";
import {
  formatTemplateDateRange,
  getTemplateKnowledge,
  parseTemplateLanguage,
  parseTemplateStrengths,
  uniqueTemplateValues,
  type TemplateCareerItem,
} from "../resume-template-data";
import { LanguageLevelText } from "../LanguageLevelText";

export function StilvollHeading({
  children,
}: {
  children: ReactNode;
}) {
  return <h2 className="stilvoll-section__title">{children}</h2>;
}

export function StilvollCareer({
  kind,
  title,
  items,
  continuation = false,
}: {
  kind: "experience" | "education";
  title: string;
  items: TemplateCareerItem[];
  continuation?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section
      className="stilvoll-section stilvoll-career"
      data-element-id={`stilvoll.${kind}`}
    >
      <StilvollHeading>
        {title}
        {continuation ? " · Fortsetzung" : ""}
      </StilvollHeading>
      <div className="stilvoll-career__list">
        {items.map((item) => (
          <article key={item.id}>
            <div className="stilvoll-career__heading">
              <h3>{item.title}</h3>
              <time>{formatTemplateDateRange(item.from, item.to)}</time>
            </div>
            <div className="stilvoll-career__meta">
              <strong>{item.organization}</strong>
              {item.city ? <span>{item.city}</span> : null}
            </div>
            {item.achievements.length ? (
              <ul>
                {item.achievements.map((achievement, index) => (
                  <li key={`${item.id}-${index}`}>{achievement}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function StilvollLeftColumn({
  profile,
  summary,
  sections,
}: {
  profile: ApplicantProfile | undefined;
  summary: string;
  sections: ApplicantProfile["resumeSections"];
}) {
  const strengths = parseTemplateStrengths(profile, 4);
  const languages = uniqueTemplateValues(
    profile?.languages ?? [],
  ).map(parseTemplateLanguage);
  return (
    <aside className="stilvoll-left">
      {sections.profile && summary ? (
        <section
          className="stilvoll-section"
          data-element-id="stilvoll.summary"
        >
          <StilvollHeading>{getResumeSectionTitle(profile, "summary")}</StilvollHeading>
          <p className="stilvoll-summary">{summary}</p>
        </section>
      ) : null}
      {sections.strengths && strengths.length ? (
        <section
          className="stilvoll-section stilvoll-strengths"
          data-element-id="stilvoll.strengths"
        >
          <StilvollHeading>{getResumeSectionTitle(profile, "strengths")}</StilvollHeading>
          {strengths.map((strength) => (
            <article key={strength.title}>
              <TechnologyBrandIcon technology={strength.title} iconId={strength.iconId} />
              <div>
                <h3>{strength.title}</h3>
                {strength.description ? (
                  <p>{strength.description}</p>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}
      {sections.languages && languages.length ? (
        <section
          className="stilvoll-section stilvoll-languages"
          data-element-id="stilvoll.languages"
        >
          <StilvollHeading>{getResumeSectionTitle(profile, "languages")}</StilvollHeading>
          {languages.map((language) => (
            <article key={language.raw}>
              <strong>{language.name}<LanguageLevelText level={language.level} /></strong>
              <span aria-label={`${language.name}: ${language.level}`} role="img">
                {Array.from({ length: 6 }, (_, index) => (
                  <i
                    className={index < language.score ? "filled" : ""}
                    key={index}
                  />
                ))}
              </span>
            </article>
          ))}
        </section>
      ) : null}
    </aside>
  );
}

export function StilvollAtsExtras({
  profile,
  sections,
}: {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
}) {
  const knowledge = getTemplateKnowledge(profile);
  const languages = uniqueTemplateValues(profile?.languages ?? []);
  const strengths = parseTemplateStrengths(profile, 4);
  const certifications = uniqueTemplateValues(
    profile?.certifications ?? [],
  );
  return (
    <>
      {sections.skills && knowledge.length ? (
        <section className="stilvoll-section">
          <StilvollHeading>{getResumeSectionTitle(profile, "knowledge")}</StilvollHeading>
          <p>{knowledge.join(" · ")}</p>
        </section>
      ) : null}
      {sections.languages && languages.length ? (
        <section className="stilvoll-section">
          <StilvollHeading>{getResumeSectionTitle(profile, "languages")}</StilvollHeading>
          <ul>
            {languages.map((language) => (
              <li key={language}>{language}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {sections.strengths && strengths.length ? (
        <section className="stilvoll-section">
          <StilvollHeading>{getResumeSectionTitle(profile, "strengths")}</StilvollHeading>
          <ul>
            {strengths.map((strength) => (
              <li key={strength.title}>
                <strong>{strength.title}</strong>
                {strength.description
                  ? ` – ${strength.description}`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sections.certifications && certifications.length ? (
        <section className="stilvoll-section">
          <StilvollHeading>{getResumeSectionTitle(profile, "certifications")}</StilvollHeading>
          <ul>
            {certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
