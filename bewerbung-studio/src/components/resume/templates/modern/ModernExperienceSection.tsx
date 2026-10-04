import { resolveExperience } from "../../../../shared/resumeCareer";
/**
 * ModernExperienceSection component
 * Renders professional work experience entries
 */

import type { ModernExperienceSectionProps } from "./modern.types";
import type { ApplicantProfile } from "../../../../shared/schema";
import { ContactIcon } from "../ContactIcon";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function ModernExperienceSection({
  profile,
}: ModernExperienceSectionProps) {
  if (!profile?.experiences || profile.experiences.length === 0) {
    return null;
  }

  return (
    <section className="modern-section">
      <h2 className="modern-section__title">{getResumeSectionTitle(profile, "experience")}</h2>
      <ul className="modern-experience-list">
        {profile.experiences.map((entry: ApplicantProfile["experiences"][number]) => {
          const exp = resolveExperience(entry);
          return (
            <li key={exp.id} className="modern-experience-entry">
              <h3 className="modern-experience-entry__role">{exp.role}</h3>
              <div className="modern-experience-entry__meta">
                <span className="modern-experience-entry__company">
                  {exp.organization}
                </span>
                {exp.period && (
                  <span className="modern-experience-entry__date">
                    <ContactIcon kind="calendar" />
                    {exp.period}
                  </span>
                )}
                {exp.location && (
                  <span className="modern-experience-entry__location">
                    <ContactIcon kind="location" />
                    {exp.location}
                  </span>
                )}
              </div>
              {exp.bullets.length > 0 && (
                <ul className="modern-experience-entry__achievements">
                  {exp.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
