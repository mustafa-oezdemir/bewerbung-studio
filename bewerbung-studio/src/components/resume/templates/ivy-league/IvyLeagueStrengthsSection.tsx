import type { ApplicantProfile } from "../../../../shared/schema";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { parseIvyLeagueStrengths } from "./ivy-league.model";
import { IvyLeagueSectionHeading } from "./IvyLeagueSectionHeading";
import { TechnologyBrandIcon } from "../../TechnologyBrandIcon";

export function IvyLeagueStrengthsSection({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const strengths = parseIvyLeagueStrengths(profile);
  if (!strengths.length) return null;

  return (
    <section
      className="ivy-league-section ivy-league-strengths-section"
      data-element-id="ivy-league.strengths"
    >
      <IvyLeagueSectionHeading>{getResumeSectionTitle(profile, "strengths")}</IvyLeagueSectionHeading>
      {atsMode ? (
        <ul className="ivy-league-strengths--ats">
          {strengths.map((strength) => (
            <li key={`${strength.title}-${strength.description}`}>
              <strong>{strength.title}</strong>
              {strength.description ? ` – ${strength.description}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="ivy-league-strengths"
          data-count={Math.min(strengths.length, 3)}
        >
          {strengths.map((strength) => (
            <article
              className="ivy-league-strength"
              key={`${strength.title}-${strength.description}`}
            >
              <TechnologyBrandIcon technology={strength.title} iconId={profile?.strengths.find((entry) => entry.title.trim() === strength.title)?.iconId} />
              <div>
                <h3>{strength.title}</h3>
                {strength.description ? <p>{strength.description}</p> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
