/**
 * Tabellarisch Template - Timeline Entry Component
 * Single timeline entry with date, timeline rail, and content
 */

import type { TabellarischTimelineEntryProps } from "./tabellarisch.types";
import { formatTabellarischDateRange } from "./tabellarisch.model";
import { cvRole } from "../../../../shared/resumeTextRoles";

export function TabellarischTimelineEntry({
  from,
  to,
  role,
  organization,
  city,
  summary,
  achievements,
  atsMode,
}: TabellarischTimelineEntryProps) {
  const dateRange = formatTabellarischDateRange(from, to);
  const uniqueAchievements = Array.from(
    new Set((achievements ?? []).map((item) => item.trim()).filter(Boolean)),
  );

  if (atsMode) {
    return (
      <article className="tabellarisch-timeline-entry tabellarisch-timeline-entry--ats">
        <h3 className="tabellarisch-timeline-entry__role" {...cvRole("entry-title")}>{role}</h3>
        <p className="tabellarisch-timeline-entry__organization" {...cvRole("organization")}>
          {organization}
        </p>
        {(dateRange || city) && (
          <p className="tabellarisch-timeline-entry__ats-meta">
            {dateRange ? <span {...cvRole("period")}>{dateRange}</span> : null}
            {dateRange && city ? " · " : null}
            {city ? <span {...cvRole("location")}>{city}</span> : null}
          </p>
        )}
        {summary ? (
          <p className="tabellarisch-timeline-entry__summary">{summary}</p>
        ) : null}
        {uniqueAchievements.length > 0 ? (
          <ul className="tabellarisch-timeline-entry__achievements">
            {uniqueAchievements.map((achievement) => (
              <li key={achievement}>{achievement}</li>
            ))}
          </ul>
        ) : null}
      </article>
    );
  }

  return (
    <article className="tabellarisch-timeline-entry">
      <div className="tabellarisch-timeline-entry__meta">
        <p className="tabellarisch-timeline-entry__date" {...cvRole("period")}>{dateRange}</p>
        {city && (
          <p className="tabellarisch-timeline-entry__location" {...cvRole("location")}>
            {city}
          </p>
        )}
      </div>

      <span className="tabellarisch-timeline-entry__rail" aria-hidden="true" />

      <div className="tabellarisch-timeline-entry__content">
        <h3 className="tabellarisch-timeline-entry__role" {...cvRole("entry-title")}>
          {role}
        </h3>
        <p className="tabellarisch-timeline-entry__organization" {...cvRole("organization")}>
          {organization}
        </p>

        {summary && (
          <p className="tabellarisch-timeline-entry__summary">
            {summary}
          </p>
        )}

        {uniqueAchievements.length > 0 && (
          <ul className="tabellarisch-timeline-entry__achievements">
            {uniqueAchievements.map((achievement) => (
              <li key={achievement}>{achievement}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
