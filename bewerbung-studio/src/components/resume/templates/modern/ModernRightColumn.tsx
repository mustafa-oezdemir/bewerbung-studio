/**
 * ModernRightColumn component
 * Renders right column: Contact, Summary, Strengths, Languages
 */

import type { ModernRightColumnProps } from "./modern.types";
import {
  getTemplateKnowledge,
  uniqueTemplateValues,
} from "../resume-template-data";
import { ModernStrengthsSection } from "./ModernStrengthsSection";
import { ModernLanguagesSection } from "./ModernLanguagesSection";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function ModernRightColumn({
  profile,
  accentColor,
  atsMode,
  showStrengths,
}: ModernRightColumnProps) {
  const knowledge = getTemplateKnowledge(profile);
  const achievements = uniqueTemplateValues(profile?.certifications ?? []);

  return (
    <div
      className="modern-resume-right-column"
      data-ats-mode={atsMode}
    >
      {showStrengths ? <ModernStrengthsSection profile={profile} /> : null}
      <ModernLanguagesSection
        profile={profile}
        accentColor={accentColor}
        atsMode={atsMode}
      />
      {knowledge.length ? (
        <section className="modern-section modern-knowledge">
          <h2 className="modern-section__title">{getResumeSectionTitle(profile, "knowledge")}</h2>
          <div className="modern-knowledge__list">
            {knowledge.map((item) => (
              <span className="modern-knowledge__item" key={item}>
                {item}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {achievements.length ? (
        <section className="modern-section modern-achievements">
          <h2 className="modern-section__title">{getResumeSectionTitle(profile, "certifications")}</h2>
          <div className="modern-achievements__list">
            {achievements.map((item) => (
              <div className="modern-achievements__item" key={item}>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
