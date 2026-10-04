import { parseTemplateStrengths } from "../resume-template-data";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import type { ElegantStrengthsProps } from "./elegant.types";
import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";

export function ElegantStrengths({
  profile,
  variant,
}: ElegantStrengthsProps) {
  const strengths = parseTemplateStrengths(profile, 3);

  if (!strengths.length) return null;

  if (variant === "ats") {
    return (
      <section
        className="elegant-section elegant-ats-list"
        data-element-id="elegant.strengths"
      >
        <h2 className="elegant-section__title">{getResumeSectionTitle(profile, "strengths")}</h2>
        <ul>
          {strengths.map((strength) => (
            <li key={strength.title}>
              <strong>{strength.title}</strong>
              {strength.description ? ` – ${strength.description}` : ""}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      className="elegant-sidebar__section elegant-strengths"
      data-element-id="elegant.strengths"
    >
      <h2 className="elegant-sidebar__title">{getResumeSectionTitle(profile, "strengths")}</h2>
      <div className="elegant-strengths__list">
        {strengths.map((strength) => (
          <article className="elegant-strength" key={strength.title}>
            <TechnologyBrandIcon
              technology={strength.title} iconId={strength.iconId}
              className="elegant-strength__icon"
            />
            <div>
              <h3>{strength.title}</h3>
              {strength.description ? <p>{strength.description}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
