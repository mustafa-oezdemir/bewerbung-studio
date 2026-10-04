import { formatKreativDateRange } from "./kreativ.model";
import type { KreativCareerSectionProps } from "./kreativ.types";
import { KreativSectionHeading } from "./KreativSectionHeading";

export function KreativCareerSection({
  kind,
  title,
  items,
  continuation = false,
  atsMode = false,
}: KreativCareerSectionProps) {
  if (!items.length) return null;

  return (
    <section
      className="kreativ-section kreativ-career"
      data-element-id={`kreativ.${kind}`}
    >
      <KreativSectionHeading
        title={title}
        continuation={continuation}
      />
      <div className="kreativ-career__list">
        {items.map((item) => (
          <article className="kreativ-career-entry" key={item.id}>
            <div className="kreativ-career-entry__heading">
              <h3>{item.title}</h3>
              <p className="kreativ-career-entry__meta">
                {formatKreativDateRange(item.from, item.to)}
              </p>
            </div>
            <div className="kreativ-career-entry__subheading">
              <h4>{item.organization}</h4>
              {item.city ? (
                <p className="kreativ-career-entry__location">{item.city}</p>
              ) : null}
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
