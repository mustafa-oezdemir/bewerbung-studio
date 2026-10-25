import { CalendarDays, MapPin } from "lucide-react";
import { formatZweispaltigDateRange } from "./zweispaltig.model";
import type { ZweispaltigCareerSectionProps } from "./zweispaltig.types";
import { cvRole } from "../../../../shared/resumeTextRoles";

export function ZweispaltigCareerSection({
  kind,
  title,
  items,
  continuation = false,
}: ZweispaltigCareerSectionProps) {
  if (!items.length) return null;

  return (
    <section
      className="zweispaltig-section zweispaltig-career"
      data-element-id={`zweispaltig.${kind}`}
    >
      <h2 className="zweispaltig-section__title">
        {title}
        {continuation ? <small>Fortsetzung</small> : null}
      </h2>
      <div className="zweispaltig-career__list">
        {items.map((item) => (
          <article className="zweispaltig-career-entry" key={item.id}>
            <h3 {...cvRole("entry-title")}>{item.title}</h3>
            <p className="zweispaltig-career-entry__organization" {...cvRole("organization")} data-cv-employer={kind === "experience" ? "true" : undefined}>
              {item.organization}
            </p>
            <p className="zweispaltig-career-entry__meta">
              <span {...cvRole("period")}>
                <CalendarDays aria-hidden="true" />
                {formatZweispaltigDateRange(item.from, item.to)}
              </span>
              {item.city ? (
                <span {...cvRole("location")}>
                  <MapPin aria-hidden="true" />
                  {item.city}
                </span>
              ) : null}
            </p>
            {item.achievements?.length ? (
              <ul>
                {item.achievements.map((achievement) => (
                  <li key={achievement}>{achievement}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
