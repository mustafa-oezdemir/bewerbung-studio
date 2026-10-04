import type { CSSProperties } from "react";
import { ivyLeagueDefaults } from "./ivy-league.defaults";
import type { IvyLeagueResumeProps } from "./ivy-league.types";
import { IvyLeaguePage } from "./IvyLeaguePage";
import "./ivy-league.css";

export function IvyLeagueResume({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  accentColor,
  secondaryColor,
  backgroundId,
  resumeProfile,
  sections,
}: IvyLeagueResumeProps) {
  const variables = {
    "--ivy-primary": accentColor || ivyLeagueDefaults.colors.primary,
    "--ivy-accent": secondaryColor || ivyLeagueDefaults.colors.accent,
  } as CSSProperties;

  return (
    <article
      className="ivy-league-template"
      data-ats-mode={atsMode}
      data-continuation={plan.pageNumber > 1}
      data-density={plan.density}
      lang="de"
      style={variables}
    >
      <IvyLeaguePage
        profile={profile}
        name={name}
        atsMode={atsMode}
        plan={plan}
        totalPages={totalPages}
        backgroundId={backgroundId}
        resumeProfile={resumeProfile}
        sections={sections}
      />
    </article>
  );
}

export default IvyLeagueResume;
