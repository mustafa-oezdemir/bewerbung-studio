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
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";

export function EinfachHeading({
  children,
}: {
  children: ReactNode;
}) {
  return <h2 className="einfach-section__title">{children}</h2>;
}

export function EinfachStrengths({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const strengths = parseTemplateStrengths(profile, 4);
  if (!strengths.length) return null;
  return (
    <section
      className={`einfach-section einfach-strengths ${atsMode ? "einfach-strengths--ats" : ""}`}
      data-element-id="einspaltig.strengths"
    >
      <EinfachHeading>{getResumeSectionTitle(profile, "strengths")}</EinfachHeading>
      <div>
        {strengths.map((strength) =>
          atsMode ? (
            <p key={strength.title}>
              <strong>{strength.title}</strong>
              {strength.description ? ` – ${strength.description}` : ""}
            </p>
          ) : (
            <article key={strength.title}>
              <TechnologyBrandIcon technology={strength.title} iconId={strength.iconId} />
              <div>
                <h3>{strength.title}</h3>
                {strength.description ? (
                  <p>{strength.description}</p>
                ) : null}
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  );
}

export function EinfachCareer({
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
      className="einfach-section einfach-career"
      data-element-id={`einspaltig.${kind}`}
    >
      <EinfachHeading>
        {title}
        {continuation ? " · Fortsetzung" : ""}
      </EinfachHeading>
      <div>
        {items.map((item) => (
          <article key={item.id}>
            <div className="einfach-career__heading">
              <h3>{item.title}</h3>
              <time>{formatTemplateDateRange(item.from, item.to)}</time>
            </div>
            <div className="einfach-career__organization">
              <h4>{item.organization}</h4>
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

export function EinfachLanguages({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const languages = uniqueTemplateValues(
    profile?.languages ?? [],
  ).map(parseTemplateLanguage);
  if (!languages.length) return null;
  return (
    <section
      className={`einfach-section einfach-languages ${atsMode ? "einfach-languages--ats" : ""}`}
      data-element-id="einspaltig.languages"
    >
      <EinfachHeading>{getResumeSectionTitle(profile, "languages")}</EinfachHeading>
      <div>
        {languages.map((entry) => {
          const language = presentLanguage(entry.raw, profile?.resumeLanguageDisplay, { dots: true, atsMode });
          return (
            <article key={entry.raw}>
              {atsMode ? (
                <p>{language.primaryText}</p>
              ) : (
                <>
                  <strong>{language.name}<LanguageLevelText presentation={language} /></strong>
                  {language.showDots ? (
                    <span aria-label={languageDotsLabel(language)} role="img">
                      {Array.from({ length: 6 }, (_, index) => (
                        <i
                          className={index < language.score ? "filled" : ""}
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

export function EinfachKnowledge({
  profile,
}: {
  profile: ApplicantProfile | undefined;
}) {
  const knowledge = getTemplateKnowledge(profile);
  if (!knowledge.length) return null;
  return (
    <section className="einfach-section" data-element-id="einspaltig.skills">
      <EinfachHeading>{getResumeSectionTitle(profile, "knowledge")}</EinfachHeading>
      <p className="einfach-knowledge">{knowledge.join(" · ")}</p>
    </section>
  );
}

export function EinfachCertifications({
  profile,
}: {
  profile: ApplicantProfile | undefined;
}) {
  const certifications = uniqueTemplateValues(
    profile?.certifications ?? [],
  );
  if (!certifications.length) return null;
  return (
    <section className="einfach-section">
      <EinfachHeading>{getResumeSectionTitle(profile, "certifications")}</EinfachHeading>
      <ul>
        {certifications.map((certification) => (
          <li key={certification}>{certification}</li>
        ))}
      </ul>
    </section>
  );
}
