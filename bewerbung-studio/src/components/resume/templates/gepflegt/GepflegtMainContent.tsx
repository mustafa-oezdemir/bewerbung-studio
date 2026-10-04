import {
  formatTemplateDateRange,
  type TemplateCareerItem,
} from "../resume-template-data";
import { toTemplateEducationItem } from "../../../../shared/resumeEducation";
import type { GepflegtMainContentProps } from "./gepflegt.types";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { toTemplateExperienceItem } from "../../../../shared/resumeCareer";

function GepflegtCareerEntry({ item }: { item: TemplateCareerItem }) {
  return (
    <article className="gepflegt-entry">
      <div className="gepflegt-entry__heading">
        <h3>{item.title}</h3>
        <span>{formatTemplateDateRange(item.from, item.to)}</span>
      </div>
      <div className="gepflegt-entry__subheading">
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
  );
}

export function GepflegtMainContent({
  profile,
  atsMode,
  isContinuation,
  children,
}: GepflegtMainContentProps) {
  const experiences: TemplateCareerItem[] = (profile?.experiences ?? []).map(toTemplateExperienceItem);
  const education: TemplateCareerItem[] = (profile?.education ?? []).map((entry) => toTemplateEducationItem(entry, profile?.resumeEducationFieldVisibility));

  return (
    <main className="gepflegt-main">
      {experiences.length ? (
        <section className="gepflegt-section" data-element-id="gepflegt.experience">
          <h2 className="gepflegt-section__title">
            {getResumeSectionTitle(profile, "experience")}
            {isContinuation ? " · Fortsetzung" : ""}
          </h2>
          <div className="gepflegt-entry-list">
            {experiences.map((item) => (
              <GepflegtCareerEntry item={item} key={item.id} />
            ))}
          </div>
        </section>
      ) : null}

      {education.length ? (
        <section className="gepflegt-section" data-element-id="gepflegt.education">
          <h2 className="gepflegt-section__title">{getResumeSectionTitle(profile, "education")}</h2>
          <div className="gepflegt-entry-list">
            {education.map((item) => (
              <GepflegtCareerEntry item={item} key={item.id} />
            ))}
          </div>
        </section>
      ) : null}

      {!experiences.length && !education.length ? (
        <p className="gepflegt-empty">
          Berufserfahrung und Ausbildung im Profil ergänzen.
        </p>
      ) : null}
      {children}
    </main>
  );
}
