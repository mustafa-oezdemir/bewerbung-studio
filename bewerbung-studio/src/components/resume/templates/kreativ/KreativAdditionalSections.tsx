import type { ApplicantProfile } from "../../../../shared/schema";
import { uniqueKreativValues } from "./kreativ.model";
import { KreativLanguagesSection } from "./KreativLanguagesSection";
import { KreativSectionHeading } from "./KreativSectionHeading";
import { KreativSkillsSection } from "./KreativSkillsSection";
import { KreativStrengthsSection } from "./KreativStrengthsSection";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function KreativAdditionalSections({
  profile,
  sections,
  onPage,
}: {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
  /** Whether the section stands on this page (Sprachen, Stärken and Zertifikate where the page plan names them). */
  onPage: (id: "knowledge" | "languages" | "strengths" | "certifications") => boolean;
}) {
  const certifications = uniqueKreativValues(
    profile?.certifications ?? [],
  );

  return (
    <>
      {onPage("knowledge") && sections.skills ? (
        <KreativSkillsSection profile={profile} atsMode />
      ) : null}
      {onPage("languages") && sections.languages ? (
        <KreativLanguagesSection profile={profile} atsMode />
      ) : null}
      {onPage("strengths") && sections.strengths ? (
        <KreativStrengthsSection profile={profile} atsMode />
      ) : null}
      {onPage("certifications") && sections.certifications && certifications.length ? (
        <section
          className="kreativ-section kreativ-certifications"
          data-element-id="kreativ.certifications"
        >
          <KreativSectionHeading title={getResumeSectionTitle(profile, "certifications")} />
          <ul>
            {certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
