import type { ApplicantProfile } from "../../../../shared/schema";
import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";
import { parseTemplateStrengths } from "../resume-template-data";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function TabellarischStrengths({
  profile,
  atsMode,
}: {
  profile: ApplicantProfile | undefined;
  atsMode: boolean;
}) {
  const strengths = parseTemplateStrengths(profile, 2);

  if (!strengths.length) return null;

  return (
    <section
      className={`tabellarisch-section tabellarisch-strengths-section ${atsMode ? "tabellarisch-strengths-section--ats" : ""}`}
      data-element-id="tabellarisch.strengths"
    >
      <h2 className="tabellarisch-section__title">{getResumeSectionTitle(profile, "strengths")}</h2>
      {atsMode ? (
        <ul className="tabellarisch-strengths-ats">
          {strengths.map((strength) => (
            <li key={strength.title}>
              <strong>{strength.title}</strong>
              {strength.description.trim()
                ? ` - ${strength.description}`
                : ""}
            </li>
          ))}
        </ul>
      ) : (
        <div className="tabellarisch-strengths">
          {strengths.map((strength) => (
              <article className="tabellarisch-strength" key={strength.title}>
                <TechnologyBrandIcon technology={strength.title} iconId={strength.iconId} />
                <div>
                  <h3>{strength.title}</h3>
                  {strength.description.trim() ? (
                    <p>{strength.description}</p>
                  ) : null}
                </div>
              </article>
          ))}
        </div>
      )}
    </section>
  );
}
