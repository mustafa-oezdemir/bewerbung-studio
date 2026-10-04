import type { Dispatch, SetStateAction } from "react";
import { RotateCcw } from "lucide-react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  getResumeSectionTitle,
  setResumeSectionTitle,
  type EditableResumeSectionTitle,
} from "../../features/resume-sections/resume-sections";

export function ResumeSectionTitleEditor({
  profile,
  section,
  onChange,
}: {
  profile: ApplicantProfile;
  section: EditableResumeSectionTitle;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
}) {
  return (
    <div className="resume-title-editor">
      <label className="field">
        <span>Angezeigte Überschrift</span>
        <input
          value={getResumeSectionTitle(profile, section)}
          onChange={(event) =>
            onChange((current) =>
              setResumeSectionTitle(current, section, event.target.value),
            )
          }
        />
      </label>
      <button
        className="button tertiary small-button"
        type="button"
        onClick={() =>
          onChange((current) => setResumeSectionTitle(current, section, ""))
        }>
        <RotateCcw size={14} /> Standard wiederherstellen
      </button>
    </div>
  );
}
