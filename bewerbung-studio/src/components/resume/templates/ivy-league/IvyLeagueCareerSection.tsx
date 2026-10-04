import { formatIvyLeagueDateRange } from "./ivy-league.model";
import type { IvyLeagueCareerItem } from "./ivy-league.types";
import { IvyLeagueSectionHeading } from "./IvyLeagueSectionHeading";

export function IvyLeagueCareerSection({
  kind,
  title,
  items,
  continuation = false,
  atsMode = false,
}: {
  kind: "experience" | "education";
  title: string;
  items: IvyLeagueCareerItem[];
  continuation?: boolean;
  atsMode?: boolean;
}) {
  if (!items.length) return null;
  const displayTitle = title;

  return (
    <section
      className={`ivy-league-section ivy-league-career ivy-league-career--${kind}`}
      data-element-id={`ivy-league.${kind}`}
    >
      <IvyLeagueSectionHeading continuation={continuation}>
        {displayTitle}
      </IvyLeagueSectionHeading>
      <div className="ivy-league-career__list">
        {items.map((item) => (
          <article className="ivy-league-career-entry" key={item.id}>
            <div className="ivy-league-career-entry__role">
              <h4>{item.title}</h4>
              <time>{formatIvyLeagueDateRange(item.from, item.to)}</time>
            </div>
            <div className="ivy-league-career-entry__top">
              <h3>{item.organization}</h3>
              {item.city ? <span>{item.city}</span> : null}
            </div>
            {item.achievements.length ? (
              <ul>
                {item.achievements.map((achievement, index) => (
                  <li key={`${item.id}-${index}`}>{achievement}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
