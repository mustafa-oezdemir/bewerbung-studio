import type { Dispatch, SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  languageLevelDisplayKeys,
  languageLevelDisplayLabels,
  resolveLanguageLevelDisplay,
} from "../../features/languages/language-levels";

/**
 * Lebenslauf → Sprachen: which parts of a language level the visual Lebenslauf shows – the dots, the GER level
 * ("C1"), its words ("Verhandlungssicher") – in any combination. The ATS layout always writes the level as text.
 */
export function LanguageDisplayOptions({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
}) {
  const display = resolveLanguageLevelDisplay(profile.resumeLanguageDisplay);
  return (
    <fieldset className="career-visibility language-display-options">
      <legend>Im Lebenslauf anzeigen</legend>
      <div className="visibility-checkbox-grid">
        {languageLevelDisplayKeys.map((key) => (
          <label className="checkbox-field compact" key={key}>
            <input
              type="checkbox"
              checked={display[key]}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  resumeLanguageDisplay: {
                    ...resolveLanguageLevelDisplay(current.resumeLanguageDisplay),
                    [key]: event.target.checked,
                  },
                }))
              }
            />
            <span>{languageLevelDisplayLabels[key]}</span>
          </label>
        ))}
      </div>
      <small className="field-hint">
        Gilt für die Lebenslauf-Vorlagen mit Sprachpunkten. Im ATS-Layout steht das Niveau immer als Text.
      </small>
    </fieldset>
  );
}
