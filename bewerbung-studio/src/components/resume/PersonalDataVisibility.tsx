import type { Dispatch, SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  getResumeSemanticTitle,
  resolveResumePersonalFieldVisibility,
  resumePersonalFieldLabels,
  type ResumePersonalFieldKey,
} from "../../features/resume-sections/resume-section-system";
import { setPersonalDataTitle } from "../../features/resume-sections/resume-manager";
import {
  getMissingPersonalFields,
  personalDataTitleOptions,
  personalRequiredFieldLabels,
  type PersonalRequiredField,
} from "../../shared/resumePersonalData";

const contactKeys: readonly ResumePersonalFieldKey[] = [
  "address",
  "phone",
  "email",
  "linkedin",
  "github",
  "website",
  "onlineProfiles",
];
const voluntaryKeys: readonly ResumePersonalFieldKey[] = [
  "country",
  "birthDate",
  "birthPlace",
  "nationality",
  "familyStatus",
  "children",
  "drivingLicense",
  "xing",
];

/** The contact details a CV is expected to carry: switching one off is allowed, with a calm note. */
const recommendedNotes: Partial<Record<ResumePersonalFieldKey, string>> = {
  address: "Die Adresse gehört zu den empfohlenen Kontaktdaten des Lebenslaufs.",
  phone: "Telefon gehört zu den empfohlenen Kontaktdaten des Lebenslaufs.",
  email: "E-Mail gehört zu den empfohlenen Kontaktdaten des Lebenslaufs.",
};

const profileFieldsOf: Partial<Record<ResumePersonalFieldKey, readonly PersonalRequiredField[]>> = {
  address: ["street", "postalCode", "city"],
  phone: ["phone"],
  email: ["email"],
};

/**
 * What the Lebenslauf panel offers for "Persönliche Daten": the section title and which fields appear. The
 * values themselves are edited in the profile (Profil → 2. Persönliche Daten); nothing is typed here.
 */
export function PersonalDataVisibility({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
}) {
  const visibility = resolveResumePersonalFieldVisibility(
    profile.resumePersonalFieldVisibility,
  );
  const title = getResumeSemanticTitle(profile.resumeSemanticSections, "personalData");
  const titles: readonly string[] = (personalDataTitleOptions as readonly string[]).includes(title)
    ? personalDataTitleOptions
    : [...personalDataTitleOptions, title];
  const missing = getMissingPersonalFields(profile);
  const lacking = (Object.keys(profileFieldsOf) as ResumePersonalFieldKey[])
    .filter((key) => visibility[key])
    .flatMap((key) => (profileFieldsOf[key] ?? []).filter((field) => missing.includes(field)));
  const toggle = (key: ResumePersonalFieldKey, checked: boolean) =>
    onChange((current) => ({
      ...current,
      resumePersonalFieldVisibility: {
        ...resolveResumePersonalFieldVisibility(current.resumePersonalFieldVisibility),
        [key]: checked,
      },
    }));
  const group = (heading: string, keys: readonly ResumePersonalFieldKey[]) => (
    <fieldset className="visibility-group">
      <legend>{heading}</legend>
      <div className="visibility-checkbox-grid">
        {keys.map((key) => (
          <label className="checkbox-field compact" key={key}>
            <input
              type="checkbox"
              checked={visibility[key]}
              onChange={(event) => toggle(key, event.target.checked)}
            />
            <span>{resumePersonalFieldLabels[key]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  const notes = contactKeys.filter((key) => !visibility[key] && recommendedNotes[key]);

  return (
    <div className="personal-data-visibility">
      <p className="manager-hint">
        Die Angaben selbst bearbeiten Sie im Profil unter „2. Persönliche
        Daten“. Hier legen Sie fest, welche davon im Lebenslauf erscheinen.
      </p>
      <label className="field">
        <span>Abschnittsüberschrift</span>
        <select
          aria-label="Persönliche Daten Überschrift"
          value={title}
          onChange={(event) =>
            onChange((current) => setPersonalDataTitle(current, event.target.value))
          }>
          {titles.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {group("Kontaktdaten", contactKeys)}
      <fieldset className="visibility-group">
        <legend>Kontakt auf Folgeseiten</legend>
        <p className="manager-hint">E-Mail und Telefon erscheinen dort nur, wenn Sie sie hier einschalten.</p>
        <div className="visibility-checkbox-grid">
          {(["email", "phone"] as const).map((key) => (
            <label className="checkbox-field compact" key={key}>
              <input
                type="checkbox"
                checked={profile.resumeContinuationContactVisibility[key]}
                disabled={!visibility[key]}
                onChange={(event) => onChange((current) => ({
                  ...current,
                  resumeContinuationContactVisibility: {
                    ...current.resumeContinuationContactVisibility,
                    [key]: event.target.checked,
                  },
                }))}
              />
              <span>{resumePersonalFieldLabels[key]} auf Folgeseiten wiederholen</span>
            </label>
          ))}
        </div>
      </fieldset>
      {group("Freiwillige Angaben", voluntaryKeys)}
      {notes.map((key) => (
        <p className="manager-hint" role="status" key={key}>
          {recommendedNotes[key]}
        </p>
      ))}
      {lacking.length ? (
        <p className="manager-hint" role="status">
          Im Profil fehlen noch:{" "}
          {lacking.map((field) => personalRequiredFieldLabels[field]).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
