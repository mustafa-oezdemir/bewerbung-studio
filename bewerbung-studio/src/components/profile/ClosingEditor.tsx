import type { Dispatch, SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import { getProfileMediaSource } from "../../shared/profileMedia";
import { FlexibleDateField } from "./FlexibleDateField";
import { ProfileMediaCard } from "./ProfileMediaCard";

export function ClosingEditor({ profile, onChange, onPickSignature, onRemoveSignature }: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
  onPickSignature: () => void;
  onRemoveSignature: () => void;
}) {
  const closing = profile.resumeClosing;
  return <>
    <div className="section-toggle-grid">
      {([ ["showPlace", "Ort anzeigen"], ["showDate", "Datum anzeigen"], ["showSignature", "Unterschrift anzeigen"] ] as const).map(([key, label]) =>
        <label className="checkbox-field" key={key}><input type="checkbox" checked={closing[key]}
          onChange={event => onChange(current => ({ ...current, resumeClosing: { ...current.resumeClosing, [key]: event.target.checked } }))} />
          <span>{label}</span></label>)}
    </div>
    {closing.showPlace && <label className="field"><span>Ort</span><input value={profile.applicationPlace}
      onChange={event => onChange(current => ({ ...current, applicationPlace: event.target.value }))} />
      <small className="field-hint">Leer lassen, um den Wohnort aus den Profildaten zu verwenden{profile.city ? `: ${profile.city}` : "."}</small></label>}
    {closing.showDate && <div className="closing-date-editor">
      <span>Datum</span>
      <label className="checkbox-field"><input type="radio" name="closing-date-mode" checked={(closing.dateMode ?? "application") === "application"}
        onChange={() => onChange(current => ({ ...current, resumeClosing: { ...current.resumeClosing, dateMode: "application" } }))} />
        <span>Bewerbungsdatum verwenden</span></label>
      <label className="checkbox-field"><input type="radio" name="closing-date-mode" checked={(closing.dateMode ?? "application") === "manual"}
        onChange={() => onChange(current => ({ ...current, resumeClosing: { ...current.resumeClosing, dateMode: "manual" } }))} />
        <span>Eigenes Datum</span></label>
      {(closing.dateMode ?? "application") === "manual" && <FlexibleDateField label="Eigenes Datum" value={profile.applicationDate} mode="date"
        onChange={applicationDate => onChange(current => ({ ...current, applicationDate }))} />}
    </div>}
    {closing.showSignature && <ProfileMediaCard kind="signature" label="Unterschrift"
      description="PNG, JPG oder WebP · am besten mit transparentem Hintergrund"
      source={getProfileMediaSource(profile.signaturePath)} onPick={onPickSignature} onRemove={onRemoveSignature} />}
    <p className="field-hint">Die Unterschrift bleibt beim Ausblenden gespeichert. Position und Ausrichtung werden im Lebenslauf-Design festgelegt.</p>
  </>;
}
