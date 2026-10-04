/**
 * ModernLeftColumn component
 * Renders left column: Experience and Education
 */

import type { ModernLeftColumnProps } from "./modern.types";
import { ModernExperienceSection } from "./ModernExperienceSection";
import { ModernEducationSection } from "./ModernEducationSection";
import { ModernSummarySection } from "./ModernSummarySection";

export function ModernLeftColumn({
  profile,
  atsMode,
  showSummary = false,
}: ModernLeftColumnProps) {
  return (
    <div
      className="modern-resume-left-column"
      data-ats-mode={atsMode}
    >
      {showSummary ? <ModernSummarySection profile={profile} /> : null}
      <ModernExperienceSection profile={profile} />
      <ModernEducationSection profile={profile} />
    </div>
  );
}
