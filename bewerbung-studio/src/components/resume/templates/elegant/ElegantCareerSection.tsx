import { formatElegantDateRange } from "./elegant.model";
import type { ElegantCareerSectionProps } from "./elegant.types";

export function ElegantCareerSection({
  kind,
  title,
  items,
  continuation = false,
}: ElegantCareerSectionProps) {
  if (items.length === 0) return null;

  return (
    <section
      className="elegant-section elegant-career"
      data-element-id={`elegant.${kind}`}
    >
      <h2 className="elegant-section__title">
        {title}
        {continuation ? <small>Fortsetzung</small> : null}
      </h2>
      <div className="elegant-career__list">
        {items.map((item) => (
          <article className="elegant-career-entry" key={item.id}>
            <div className="elegant-career-entry__heading">
              <div>
                <h3>{item.title}</h3>
                <p>{item.organization}</p>
              </div>
              <p className="elegant-career-entry__meta">
                <strong>{formatElegantDateRange(item.from, item.to)}</strong>
                {item.city ? <span>{item.city}</span> : null}
              </p>
            </div>
            {item.achievements?.length ? (
              <ul className="elegant-career-entry__achievements">
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
