/**
 * ModernEducationSection component
 * Renders education/training entries
 */

import type { ModernEducationSectionProps } from "./modern.types";
import type { ApplicantProfile } from "../../../../shared/schema";
import { ContactIcon } from "../ContactIcon";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function ModernEducationSection({
  profile,
}: ModernEducationSectionProps) {
  if (!profile?.education || profile.education.length === 0) {
    return null;
  }

  return (
    <section className="modern-section">
      <h2 className="modern-section__title">{getResumeSectionTitle(profile, "education")}</h2>
      <ul className="modern-education-list">
        {profile.education.map((edu: ApplicantProfile["education"][number]) => (
          <li key={edu.id} className="modern-education-entry">
            <h3 className="modern-education-entry__degree">{edu.degree}</h3>
            <div className="modern-education-entry__meta">
              <span className="modern-education-entry__institution">
                {edu.institution}
              </span>
              <span className="modern-education-entry__date">
                <ContactIcon kind="calendar" />
                {edu.from} – {edu.to}
              </span>
              {edu.city && (
                <span className="modern-education-entry__location">
                  <ContactIcon kind="location" />
                  {edu.city}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
