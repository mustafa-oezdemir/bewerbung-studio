import type { ApplicantProfile } from "../../../../shared/schema";
import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";
import { parseTemplateStrengths } from "../resume-template-data";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export interface GepflegtStrengthsSectionProps {
  profile: ApplicantProfile | undefined;
  atsMode: boolean;
}

export function GepflegtStrengthsSection({
  profile,
  atsMode,
}: GepflegtStrengthsSectionProps) {
  const strengths = parseTemplateStrengths(profile, 3);
  if (!strengths.length) return null;

  return (
    <section className="gepflegt-sidebar__section">
      <h2 className="gepflegt-sidebar__title">{getResumeSectionTitle(profile, "strengths")}</h2>
      <div className="gepflegt-strengths">
        {strengths.map((strength, index) => (
            <article className="gepflegt-strength" key={`${strength.title}-${index}`}>
              {!atsMode ? <TechnologyBrandIcon technology={strength.title} iconId={strength.iconId} /> : null}
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
