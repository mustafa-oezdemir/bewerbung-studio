import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { presentLanguage } from "../LanguageLevelText";
import {
  getTemplateKnowledge,
  parseTemplateStrengths,
  uniqueTemplateValues,
} from "../resume-template-data";
import type { GepflegtAtsExtraProps } from "./gepflegt.types";

/**
 * The plain (ATS) sheet keeps no sidebar: Stärken, Sprachen, Kenntnisse and Zertifikate stand in two columns below the
 * main column of the last page, in the markup of the PDF (`.gepflegt-pdf-ats-extra`): plain lists, no icons, no dots.
 */
export function GepflegtAtsExtra({ profile, sections }: GepflegtAtsExtraProps) {
  const strengths = parseTemplateStrengths(profile, 3);
  const languages = uniqueTemplateValues(profile?.languages ?? []).map((raw) =>
    presentLanguage(raw, profile?.resumeLanguageDisplay, { dots: true, atsMode: true }),
  );
  const knowledge = getTemplateKnowledge(profile);
  const certifications = uniqueTemplateValues(profile?.certifications ?? []);

  return (
    <div className="gepflegt-ats-extra">
      {sections.strengths && strengths.length ? (
        <section data-element-id="gepflegt.strengths">
          <h2>{getResumeSectionTitle(profile, "strengths")}</h2>
          <ul>
            {strengths.map((strength, index) => (
              <li key={`${strength.title}-${index}`}>
                <strong>{strength.title}</strong>
                {strength.description ? ` - ${strength.description}` : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.languages && languages.length ? (
        <section data-element-id="gepflegt.languages">
          <h2>{getResumeSectionTitle(profile, "languages")}</h2>
          <ul>
            {languages.map((language) => (
              <li key={language.raw}>{language.primaryText}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.skills && knowledge.length ? (
        <section data-element-id="gepflegt.skills">
          <h2>{getResumeSectionTitle(profile, "knowledge")}</h2>
          <p>{knowledge.join(" · ")}</p>
        </section>
      ) : null}

      {sections.certifications && certifications.length ? (
        <section data-element-id="gepflegt.certifications">
          <h2>{getResumeSectionTitle(profile, "certifications")}</h2>
          <ul>
            {certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
