import {
  uniqueZeitgenoessischValues,
} from "./zeitgenoessisch.model";
import type { ZeitgenoessischColumnsProps } from "./zeitgenoessisch.types";
import { ZeitgenoessischContactSection } from "./ZeitgenoessischContactSection";
import { ZeitgenoessischLanguagesSection } from "./ZeitgenoessischLanguagesSection";
import { ZeitgenoessischKnowledge } from "./ZeitgenoessischKnowledge";
import { ZeitgenoessischSectionHeading } from "./ZeitgenoessischSectionHeading";
import { ZeitgenoessischStrengthsSection } from "./ZeitgenoessischStrengthsSection";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function ZeitgenoessischLeftColumn({
  profile,
  sections,
}: ZeitgenoessischColumnsProps) {
  const certifications = uniqueZeitgenoessischValues(
    profile?.certifications ?? [],
  );

  return (
    <aside className="zeitgenoessisch-left-column">
      <ZeitgenoessischContactSection profile={profile} />
      {sections.strengths ? (
        <ZeitgenoessischStrengthsSection profile={profile} />
      ) : null}
      {sections.languages ? (
        <ZeitgenoessischLanguagesSection profile={profile} />
      ) : null}
      {sections.skills ? <ZeitgenoessischKnowledge profile={profile} /> : null}
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
    </aside>
  );
}
