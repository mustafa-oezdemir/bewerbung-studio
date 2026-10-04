import type { ApplicantProfile } from "../../../../shared/schema";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { getIvyLeagueKnowledge } from "./ivy-league.model";
import { IvyLeagueSectionHeading } from "./IvyLeagueSectionHeading";

export function IvyLeagueKnowledgeSection({
  profile,
}: {
  profile: ApplicantProfile | undefined;
}) {
  const knowledge = getIvyLeagueKnowledge(profile);
  if (!knowledge.length) return null;
  return (
    <section
      className="ivy-league-section ivy-league-knowledge"
      data-element-id="ivy-league.skills"
    >
      <IvyLeagueSectionHeading>{getResumeSectionTitle(profile, "knowledge")}</IvyLeagueSectionHeading>
      <p>{knowledge.join(" · ")}</p>
    </section>
  );
}
