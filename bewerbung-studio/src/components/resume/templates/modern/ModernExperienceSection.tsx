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
        {profile.experiences.map(
          (exp: ApplicantProfile["experiences"][number]) => (
            <li key={exp.id} className="modern-experience-entry">
              <h3 className="modern-experience-entry__role">{exp.role}</h3>
              <div className="modern-experience-entry__meta">
                <span className="modern-experience-entry__company">
                  {exp.company}
                </span>
                <span className="modern-experience-entry__date">
                  <ContactIcon kind="calendar" />
                  {exp.from} – {exp.to}
                </span>
                {exp.city && (
                  <span className="modern-experience-entry__location">
                    <ContactIcon kind="location" />
                    {exp.city}
                  </span>
                )}
              </div>
              {exp.achievements && exp.achievements.length > 0 && (
                <ul className="modern-experience-entry__achievements">
                  {exp.achievements.map((achievement: string, idx: number) => (
                    <li key={idx}>{achievement}</li>
                  ))}
                </ul>
              )}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
