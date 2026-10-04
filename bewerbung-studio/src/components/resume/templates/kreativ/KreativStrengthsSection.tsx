import type { ApplicantProfile } from "../../../../shared/schema";
import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";
import { KreativSectionHeading } from "./KreativSectionHeading";
import { parseTemplateStrengths } from "../resume-template-data";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function KreativStrengthsSection({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const strengths = parseTemplateStrengths(profile, 3);
  if (!strengths.length) return null;

  return (
    <section
      className={`kreativ-section kreativ-strengths ${atsMode ? "kreativ-strengths--ats" : ""}`}
      data-element-id="kreativ.strengths"
    >
      <KreativSectionHeading title={getResumeSectionTitle(profile, "strengths")} />
      <div className="kreativ-strengths__list">
        {strengths.map((strength) => (
            <article className="kreativ-strength" key={strength.title}>
              {!atsMode ? (
                <TechnologyBrandIcon technology={strength.title} iconId={strength.iconId} />
              ) : null}
              <div>
                <h3>{strength.title}</h3>
                {strength.description.trim() ? (
                  <p>{strength.description}</p>
                ) : null}
              </div>
            </article>
        ))}
      </div>
    </section>
  );
}
