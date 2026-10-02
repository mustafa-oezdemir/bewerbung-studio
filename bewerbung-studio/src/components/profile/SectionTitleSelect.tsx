import type { Dispatch, SetStateAction } from "react";
import {
  getResumeSectionTitle,
  setResumeSectionTitle,
  type EditableResumeSectionTitle,
} from "../../features/resume-sections/resume-sections";
import type { ApplicantProfile } from "../../shared/schema";

/**
 * The title of a Lebenslauf section chosen from professional alternatives. It reads and writes the one title
 * system (`getResumeSectionTitle` / `setResumeSectionTitle`), so there is no second title state. A title the
 * user chose earlier stays selectable as an extra option.
 */
export function SectionTitleSelect({
  profile,
  section,
  options,
  onChange,
  ariaLabel,
}: {
  profile: ApplicantProfile;
  section: EditableResumeSectionTitle;
  options: readonly string[];
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
  ariaLabel: string;
}) {
  const title = getResumeSectionTitle(profile, section);
  const all = options.includes(title) ? options : [...options, title];
  return (
    <label className="field">
      <span>Überschrift</span>
      <select
        aria-label={ariaLabel}
        value={title}
        onChange={(event) =>
          onChange((current) => setResumeSectionTitle(current, section, event.target.value))
        }>
        {all.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
