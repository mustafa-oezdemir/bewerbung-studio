import { ContactIcon } from "../ContactIcon";
import type { ApplicantProfile } from "../../../../shared/schema";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";
import {
  formatTemplateDateRange,
  getTemplateKnowledge,
  parseTemplateLanguage,
  parseTemplateStrengths,
  toTemplateExternalHref,
  uniqueTemplateValues,
  type TemplateCareerItem,
} from "../resume-template-data";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails, getResumeLinkContacts } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";
import { LanguageDescriptionText, LanguageLevelText, languageDotsLabel, presentLanguage } from "../LanguageLevelText";

export function KompaktHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return <h2 className="kompakt-section__title">{children}</h2>;
}

export function KompaktCareer({
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
      className="kompakt-section kompakt-career"
      data-element-id={`kompakt.${kind}`}
    >
      <KompaktHeading>
        {title}
        {continuation ? " · Fortsetzung" : ""}
      </KompaktHeading>
      <div className="kompakt-career__list">
        {items.map((item) => (
          <article className="kompakt-career-entry" key={item.id}>
            <div className="kompakt-career-entry__heading">
              <h3>{item.title}</h3>
              <time>{formatTemplateDateRange(item.from, item.to)}</time>
            </div>
            <div className="kompakt-career-entry__meta">
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

const contactRows = (profile: ApplicantProfile | undefined) => {
  const location = formatResumeAddress(profile);
  const birth = formatResumeBirth(profile, { prefix: true });
  return [
    {
      icon: "☎",
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      icon: "✉",
      value: profile?.email,
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
...getResumeLinkContacts(profile).map((link) => ({ kind: link.kind, icon: link.kind === "website" ? "⌖" : "↗", value: link.value, href: link.href })),
    { icon: "◆", value: location, href: "" },
    { icon: "★", value: birth, href: "" },
    ...getResumePersonalDetails(profile).map((detail) => ({ icon: "★", kind: detail.kind, value: detail.text, href: detail.href })),
  ].filter((item) => item.value?.trim());
};

export function KompaktRightColumn({
  profile,
  summary,
  sections,
}: {
  profile: ApplicantProfile | undefined;
  summary: string;
  sections: ApplicantProfile["resumeSections"];
}) {
  const contacts = contactRows(profile);
  const strengths = parseTemplateStrengths(profile, 4);
  const achievements = uniqueTemplateValues(
    profile?.certifications ?? [],
  ).slice(0, 2);
  const skills = getTemplateKnowledge(profile);
  return (
    <aside className="kompakt-right">
      {contacts.length ? (
        <section
          className="kompakt-section kompakt-contacts"
          data-element-id="kompakt.contacts"
        >
          <KompaktHeading>Kontaktdaten</KompaktHeading>
          <address>
            {contacts.map((contact, index) => (
              <div key={`${contact.value}-${index}`}>
                <i aria-hidden="true"><ContactIcon {...contact} /></i>
                {contact.href ? (
                  <a href={contact.href}>{contact.value}</a>
                ) : (
                  <span>{contact.value}</span>
                )}
              </div>
            ))}
          </address>
        </section>
      ) : null}
      {sections.profile && summary ? (
        <section
          className="kompakt-section"
          data-element-id="kompakt.summary"
        >
          <KompaktHeading>{getResumeSectionTitle(profile, "summary")}</KompaktHeading>
          <p className="kompakt-summary">{summary}</p>
        </section>
      ) : null}
      {sections.strengths && strengths.length ? (
        <section
          className="kompakt-section kompakt-strengths"
          data-element-id="kompakt.strengths"
        >
          <KompaktHeading>{getResumeSectionTitle(profile, "strengths")}</KompaktHeading>
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
      {sections.certifications && achievements.length ? (
        <section
          className="kompakt-section kompakt-strengths"
          data-element-id="kompakt.achievements"
        >
          <KompaktHeading>{getResumeSectionTitle(profile, "certifications")}</KompaktHeading>
          {achievements.map((achievement) => (
            <article key={achievement}>
              <i aria-hidden="true">★</i>
              <div>
                <h3>{achievement}</h3>
              </div>
            </article>
          ))}
        </section>
      ) : null}
      {sections.skills && skills.length ? (
        <section
          className="kompakt-section"
          data-element-id="kompakt.skills"
        >
          <KompaktHeading>{getResumeSectionTitle(profile, "knowledge")}</KompaktHeading>
          <div className="kompakt-skills">
            {skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

export function KompaktLanguages({
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
      className="kompakt-section kompakt-languages"
      data-element-id="kompakt.languages"
    >
      <KompaktHeading>{getResumeSectionTitle(profile, "languages")}</KompaktHeading>
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
                    <span className="kompakt-language__dots" aria-label={languageDotsLabel(language)} role="img">
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

export function KompaktAtsExtras({
  profile,
  sections,
}: {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
}) {
  const skills = getTemplateKnowledge(profile);
  const strengths = parseTemplateStrengths(profile, 4);
  const achievements = uniqueTemplateValues(
    profile?.certifications ?? [],
  );
  return (
    <>
      {sections.skills && skills.length ? (
        <section className="kompakt-section">
          <KompaktHeading>{getResumeSectionTitle(profile, "knowledge")}</KompaktHeading>
          <p>{skills.join(" · ")}</p>
        </section>
      ) : null}
      {sections.languages ? (
        <KompaktLanguages profile={profile} atsMode />
      ) : null}
      {sections.strengths && strengths.length ? (
        <section className="kompakt-section">
          <KompaktHeading>{getResumeSectionTitle(profile, "strengths")}</KompaktHeading>
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
      {sections.certifications && achievements.length ? (
        <section className="kompakt-section">
          <KompaktHeading>{getResumeSectionTitle(profile, "certifications")}</KompaktHeading>
          <ul>
            {achievements.map((achievement) => (
              <li key={achievement}>{achievement}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
