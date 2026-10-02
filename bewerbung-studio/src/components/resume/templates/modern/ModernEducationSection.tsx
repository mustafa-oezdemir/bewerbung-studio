/**
 * ModernEducationSection component
 * Renders education/training entries
 */

import type { ModernEducationSectionProps } from "./modern.types";
import { resolveEducationPresentation } from "../../../../shared/resumeEducation";
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
        {profile.education.map((edu) => {
          const item = resolveEducationPresentation(edu);
          return <li key={edu.id} className="modern-education-entry">
            <h3 className="modern-education-entry__degree">{item.title}</h3>
            <div className="modern-education-entry__meta">
              <span className="modern-education-entry__institution">
                {item.institution}
              </span>
              <span className="modern-education-entry__date">
                <ContactIcon kind="calendar" />
                {item.dateRange}
              </span>
              {item.location && (
                <span className="modern-education-entry__location">
                  <ContactIcon kind="location" />
                  {item.location}
                </span>
              )}
            </div>
            {item.details.length ? <ul>{item.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul> : null}
          </li>;
        })}
      </ul>
    </section>
  );
}
