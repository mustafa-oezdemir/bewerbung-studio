import type { ReactNode } from "react";
import type { ApplicantProfile } from "../../../../shared/schema";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";
import {
  formatTemplateDateRange,
  getTemplateKnowledge,
  parseTemplateStrengths,
  uniqueTemplateValues,
  type TemplateCareerItem,
} from "../resume-template-data";
import { wideLanguageLineChars } from "../../../../features/languages/language-levels";
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";

export function KlassischHeading({ children }: { children: ReactNode }) {
  return <h2 className="klassisch-section__title">{children}</h2>;
}

export function KlassischStrengths({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const strengths = parseTemplateStrengths(profile, 3);
  if (!strengths.length) return null;
  return (
    <section
      className={`klassisch-section klassisch-strengths ${atsMode ? "klassisch-strengths--ats" : ""}`}
      data-element-id="klassisch.strengths"
    >
      <KlassischHeading>{getResumeSectionTitle(profile, "strengths")}</KlassischHeading>
      <div>
        {strengths.map((strength) => (
          <article key={`${strength.title}-${strength.description}`}>
            {!atsMode ? <TechnologyBrandIcon technology={strength.title} iconId={strength.iconId} /> : null}
            <div>
              <h3>{strength.title}</h3>
              {strength.description ? <p>{strength.description}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function KlassischCareer({
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
  const isEducation = kind === "education";
  return (
    <section
      className={`klassisch-section klassisch-career ${isEducation ? "klassisch-career--education" : ""}`}
      data-element-id={`klassisch.${isEducation ? "education" : "experience"}`}
    >
      <KlassischHeading>
        {title}
        {continuation ? " · Fortsetzung" : ""}
      </KlassischHeading>
      <div>
        {items.map((item) => (
          <article key={item.id}>
            <div className="klassisch-career__heading">
              <div>
                <h3>{item.title}</h3>
                <h4>{item.organization}</h4>
              </div>
              <p>
                {item.city ? <span>{item.city}</span> : null}
                <time>{formatTemplateDateRange(item.from, item.to)}</time>
              </p>
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

export function KlassischKnowledge({
  profile,
}: {
  profile: ApplicantProfile | undefined;
}) {
  const promotedStrengths = new Set(
    profile?.strengths.length
      ? []
      : uniqueTemplateValues(profile?.skills ?? []).slice(0, 3),
  );
  const knowledge = getTemplateKnowledge(profile).filter(
    (item) => !promotedStrengths.has(item),
  );
  if (!knowledge.length) return null;
  return (
    <section className="klassisch-section" data-element-id="klassisch.skills">
      <KlassischHeading>{getResumeSectionTitle(profile, "knowledge")}</KlassischHeading>
      <p className="klassisch-knowledge">{knowledge.join(" · ")}</p>
    </section>
  );
}

export function KlassischLanguages({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const languages = uniqueTemplateValues(profile?.languages ?? []).map(
    (raw) => presentLanguage(raw, profile?.resumeLanguageDisplay, { dots: true, atsMode }),
  );
  if (!languages.length) return null;
  const wide = languages.some((language) => language.primaryText.length > wideLanguageLineChars);
  return (
    <section
      className={`klassisch-section klassisch-languages ${atsMode ? "klassisch-languages--ats" : ""}${wide ? " klassisch-languages--wide" : ""}`}
      data-element-id="klassisch.languages"
    >
      <KlassischHeading>{getResumeSectionTitle(profile, "languages")}</KlassischHeading>
      <div>
        {languages.map((language) => (
          <p key={language.raw}>
            <span className="klassisch-language__name">
              <strong>{language.name}</strong>
              <LanguageLevelText presentation={language} />
            </span>
            {language.showDots ? (
              <span className="klassisch-language__dots" aria-label={languageDotsLabel(language)} role="img">
                {Array.from({ length: 6 }, (_, index) => (
                  <i className={index < language.score ? "is-filled" : ""} key={index} />
                ))}
              </span>
            ) : null}
            <LanguageDescriptionText presentation={language} />
          </p>
        ))}
      </div>
    </section>
  );
}

export function KlassischCertifications({
  profile,
}: {
  profile: ApplicantProfile | undefined;
}) {
  const certifications = uniqueTemplateValues(profile?.certifications ?? []);
  if (!certifications.length) return null;
  return (
    <section className="klassisch-section" data-element-id="klassisch.certifications">
      <KlassischHeading>{getResumeSectionTitle(profile, "certifications")}</KlassischHeading>
      <ul>
        {certifications.map((certification) => (
          <li key={certification}>{certification}</li>
        ))}
      </ul>
    </section>
  );
}
