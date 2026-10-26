import type { ApplicantProfile } from "../../../../shared/schema";
import { uniqueZeitgenoessischValues } from "./zeitgenoessisch.model";
import { ZeitgenoessischKnowledge } from "./ZeitgenoessischKnowledge";
import { ZeitgenoessischLanguagesSection } from "./ZeitgenoessischLanguagesSection";
import { ZeitgenoessischSectionHeading } from "./ZeitgenoessischSectionHeading";
import { ZeitgenoessischStrengthsSection } from "./ZeitgenoessischStrengthsSection";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function ZeitgenoessischAdditionalSections({
  profile,
  sections,
  onPage,
}: {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
  /** Whether the section stands on this page (Sprachen and Zertifikate where the page plan names them). */
  onPage: (id: "knowledge" | "languages" | "strengths" | "certifications") => boolean;
}) {
  const certifications = uniqueZeitgenoessischValues(
    profile?.certifications ?? [],
  );

  return (
    <>
      {onPage("knowledge") && sections.skills ? (
        <ZeitgenoessischKnowledge profile={profile} />
      ) : null}
      {onPage("languages") && sections.languages ? (
        <ZeitgenoessischLanguagesSection profile={profile} atsMode />
      ) : null}
      {onPage("strengths") && sections.strengths ? (
        <ZeitgenoessischStrengthsSection profile={profile} atsMode />
      ) : null}
      {onPage("certifications") && sections.certifications && certifications.length ? (
        <section
          className="zeitgenoessisch-section zeitgenoessisch-certifications"
          data-element-id="zeitgenoessisch.certifications"
        >
          <ZeitgenoessischSectionHeading
            title={getResumeSectionTitle(profile, "certifications")}
            icon="certifications"
          />
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
