import { useId, type Dispatch, type SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  getResumeSemanticSection,
  resumeHeadingModes,
  type ResumeHeadingMode,
} from "../../features/resume-sections/resume-section-system";
import {
  resolveResumeHeading,
  setResumeHeading,
} from "../../shared/resumeHeading";

export const resumeHeadingModeLabels: Record<ResumeHeadingMode, string> = {
  default: "Lebenslauf",
  "with-name": "Lebenslauf + Name",
  "curriculum-vitae": "Curriculum Vitae",
  custom: "Benutzerdefiniert",
};

/**
 * Edits the Lebenslauf-Überschrift of a profile draft. The profile page shows the full editor with the live
 * preview; the section panel shows the compact one. Both write through `setResumeHeading`, so there is one
 * data path. Name and Berufsbezeichnung are profile data and are never edited here.
 */
export function ResumeHeadingEditor({
  profile,
  onChange,
  variant = "full",
}: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
  variant?: "full" | "compact";
}) {
  const groupId = useId();
  const heading = resolveResumeHeading(profile);
  const setMode = (mode: ResumeHeadingMode) =>
    onChange((current) => setResumeHeading(current, { mode }));
  const customField =
    heading.mode === "custom" ? (
      <>
        <label className="field">
          <span>Eigene Überschrift</span>
          <input
            // Not trimmed while typing; the profile save stores it trimmed.
            value={
              getResumeSemanticSection(profile.resumeSemanticSections, "heading")
                .customTitle
            }
            aria-invalid={heading.customTitleMissing || undefined}
            placeholder="Mein Lebenslauf"
            onChange={(event) =>
              onChange((current) =>
                setResumeHeading(current, {
                  mode: "custom",
                  customTitle: event.target.value,
                }),
              )
            }
          />
        </label>
        {heading.customTitleMissing ? (
          <small className="resume-heading-validation" role="alert">
            Die Überschrift darf nicht leer sein. Bis dahin wird „Lebenslauf“
            verwendet.
          </small>
        ) : null}
      </>
    ) : null;

  if (variant === "compact")
    return (
      <div className="resume-heading-editor is-compact">
        <label className="field">
          <span>Überschrift</span>
          <select
            aria-label="Überschrift Darstellung"
            value={heading.mode}
            onChange={(event) =>
              setMode(event.target.value as ResumeHeadingMode)
            }>
            {resumeHeadingModes.map((mode) => (
              <option key={mode} value={mode}>
                {resumeHeadingModeLabels[mode]}
              </option>
            ))}
          </select>
        </label>
        {customField}
        <p className="manager-hint">
          Aktuell: <strong>{heading.title}</strong>. Name und Berufsbezeichnung
          stammen aus den Profildaten.
        </p>
      </div>
    );

  return (
    <div className="resume-heading-editor">
      <div className="field">
        <span id={`${groupId}-label`}>Darstellung</span>
        <div
          className="resume-heading-options"
          role="radiogroup"
          aria-labelledby={`${groupId}-label`}>
          {resumeHeadingModes.map((mode) => (
            <label
              className={`resume-heading-option${heading.mode === mode ? " is-selected" : ""}`}
              key={mode}>
              <input
                type="radio"
                name={groupId}
                value={mode}
                checked={heading.mode === mode}
                onChange={() => setMode(mode)}
              />
              <span>{resumeHeadingModeLabels[mode]}</span>
            </label>
          ))}
        </div>
      </div>
      {customField}
      <div className="resume-heading-preview" aria-live="polite">
        <span>Vorschau</span>
        <strong>{heading.title}</strong>
        <small>
          Name und Berufsbezeichnung werden aus den Profildaten übernommen.
        </small>
      </div>
    </div>
  );
}
