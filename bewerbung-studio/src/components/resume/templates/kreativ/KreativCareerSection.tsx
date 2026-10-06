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
          <article className="kreativ-career-entry" key={item.id}
            data-resume-entry-id={item.id}
            data-resume-entry-range={item.bullets ? `${item.bullets.from}:${item.bullets.to}` : undefined}
            data-resume-entry-continued={item.bullets && item.bullets.from > 0 ? "" : undefined}
            data-resume-entry-continues={item.bullets && item.bullets.to < item.bullets.total ? "" : undefined}>
            <div className="kreativ-career-entry__heading">
              <h3>{item.title}{item.bullets && item.bullets.from > 0 ? <span data-resume-entry-marker="">· Fortsetzung</span> : null}</h3>
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
