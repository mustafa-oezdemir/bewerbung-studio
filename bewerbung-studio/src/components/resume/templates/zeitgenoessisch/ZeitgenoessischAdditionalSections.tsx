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
}: {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
}) {
  const certifications = uniqueZeitgenoessischValues(
    profile?.certifications ?? [],
  );

  return (
    <>
      {sections.skills ? (
        <ZeitgenoessischKnowledge profile={profile} />
      ) : null}
      {sections.languages ? (
        <ZeitgenoessischLanguagesSection profile={profile} atsMode />
      ) : null}
      {sections.strengths ? (
        <ZeitgenoessischStrengthsSection profile={profile} atsMode />
      ) : null}
      {sections.certifications && certifications.length ? (
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
