import { formatZeitgenoessischDateRange } from "./zeitgenoessisch.model";
import type { ZeitgenoessischCareerSectionProps } from "./zeitgenoessisch.types";
import { ZeitgenoessischSectionHeading } from "./ZeitgenoessischSectionHeading";

export function ZeitgenoessischCareerSection({
  kind,
  title,
  items,
  continuation = false,
  atsMode = false,
}: ZeitgenoessischCareerSectionProps) {
  if (!items.length) return null;
  const isEducation = kind === "education";

  return (
    <section
      className="zeitgenoessisch-section zeitgenoessisch-career"
      data-element-id={`zeitgenoessisch.${isEducation ? "education" : "experience"}`}
    >
      <ZeitgenoessischSectionHeading
        title={title}
        icon={isEducation ? "education" : "experience"}
        continuation={continuation}
      />
      <div className="zeitgenoessisch-career__list">
        {items.map((item) => (
          <article className="zeitgenoessisch-career-entry" key={item.id}>
            <div className="zeitgenoessisch-career-entry__top">
              <h3>{item.organization}</h3>
              {item.city ? <span>{item.city}</span> : <span />}
            </div>
            <div className="zeitgenoessisch-career-entry__role-row">
              <h4>{item.title}</h4>
              <span>
                {formatZeitgenoessischDateRange(item.from, item.to)}
              </span>
            </div>
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
