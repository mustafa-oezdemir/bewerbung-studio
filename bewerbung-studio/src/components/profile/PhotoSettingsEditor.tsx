import { Info } from "lucide-react";
import { useId, type Dispatch, type SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import { getProfileMediaSource } from "../../shared/profileMedia";
import {
  isResumePhotoVisible,
  resolveResumePhotoSize,
  resumePhotoSizeLabels,
  resumePhotoSizes,
  setResumePhotoSize,
  setResumePhotoVisible,
  type ResumePhotoSize,
} from "../../shared/resumePhoto";
import { ProfileMediaCard } from "./ProfileMediaCard";

/** What makes a good Bewerbungsfoto: a short German note, not a rule the app enforces. */
export const photoTips = [
  "Aktuelles Porträt mit gut erkennbarem Gesicht",
  "Neutraler, ruhiger Hintergrund und gutes Licht",
  "Seriöse Kleidung, freundlicher Ausdruck",
  "Hoch- oder Quadratformat, scharf und ausreichend groß",
] as const;

/**
 * The settings of "3. Bewerbungsfoto" in the profile: the picture, whether the Lebenslauf uses it and its size.
 * The shape (rund, eckig, abgerundet) and the lines around the photo stay in the design of the Lebenslauf.
 * "Foto ausblenden" only hides it in the Lebenslauf: the picture stays in the profile until it is removed.
 */
export function PhotoSettingsEditor({
  profile,
  onChange,
  fileName,
  onPick,
  onRemove,
}: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
  fileName?: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  const source = getProfileMediaSource(profile.photoPath);
  const visible = isResumePhotoVisible(profile);
  const size = resolveResumePhotoSize(profile);

  return (
    <div className="photo-settings">
      <ProfileMediaCard
        kind="photo"
        label="Lebenslauf-Foto"
        description="PNG, JPG oder WebP · maximal 8 MB"
        source={source}
        fileName={fileName}
        emptyText="Noch kein Bewerbungsfoto ausgewählt."
        pickLabel={{ select: "Foto auswählen", replace: "Foto ersetzen" }}
        removeLabel="Foto entfernen"
        onPick={onPick}
        onRemove={onRemove}
      />

      <label className="checkbox-field full photo-visibility">
        <input
          type="checkbox"
          checked={visible}
          disabled={!source}
          onChange={(event) =>
            onChange((current) => setResumePhotoVisible(current, event.target.checked))
          }
        />
        <span>Im Lebenslauf anzeigen</span>
      </label>

      <div className="field photo-size-field" aria-disabled={!source || undefined}>
        <span id={`${id}-size`}>Fotogröße</span>
        <div className="photo-size-options" role="radiogroup" aria-labelledby={`${id}-size`}>
          {resumePhotoSizes.map((option: ResumePhotoSize) => (
            <label
              className={`photo-size-option${size === option ? " is-selected" : ""}${source ? "" : " is-disabled"}`}
              key={option}>
              <input
                type="radio"
                name={`${id}-size`}
                value={option}
                checked={size === option}
                disabled={!source}
                onChange={() => onChange((current) => setResumePhotoSize(current, option))}
              />
              <span>{resumePhotoSizeLabels[option]}</span>
            </label>
          ))}
        </div>
        <small className="field-hint">
          „Mittel“ entspricht der Originalgröße der gewählten Vorlage. „Klein“ und „Groß“ verkleinern oder
          vergrößern das Foto der jeweiligen Vorlage um etwa ein Fünftel.
        </small>
      </div>

      <aside className="photo-tips" aria-label="Hinweis zum Bewerbungsfoto">
        <strong>
          <Info size={14} aria-hidden="true" /> So sollte Ihr Foto aussehen
        </strong>
        <ul>
          {photoTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <small>
          Ein Foto ist freiwillig. Form und Rahmen stellen Sie im Design der Lebenslauf-Ansicht ein; bei
          der ATS-Variante wird kein Foto gezeigt.
        </small>
      </aside>
    </div>
  );
}
