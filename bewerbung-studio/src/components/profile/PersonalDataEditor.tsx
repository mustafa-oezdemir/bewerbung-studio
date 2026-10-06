import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { useId, useState, type Dispatch, type SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  familyStatusOptions,
  getPersonalDataIssues,
  invalidEmailMessage,
  personalFieldMissingMessage,
  personalRequiredFields,
  type PersonalRequiredField,
} from "../../shared/resumePersonalData";
import { FlexibleDateField } from "./FlexibleDateField";

export const personalFieldId = (field: string) => `personal-data-${field}`;

type FieldProps = {
  field: PersonalRequiredField | string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: "text" | "email" | "tel" | "url";
  required?: boolean;
  full?: boolean;
  hint?: string;
  issue?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "url" | "numeric";
};

/** A labelled input with an optional hint and an inline problem; the problem is read out through aria. */
function PersonalField({
  field,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  required = false,
  full = false,
  hint,
  issue,
  placeholder,
  autoComplete,
  inputMode,
}: FieldProps) {
  const id = personalFieldId(field);
  const describedBy = [hint ? `${id}-hint` : "", issue ? `${id}-issue` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={`field${full ? " full" : ""}${issue ? " has-issue" : ""}`}>
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-required={required || undefined}
        aria-invalid={issue ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {hint ? (
        <small className="field-hint" id={`${id}-hint`}>
          {hint}
        </small>
      ) : null}
      {issue ? (
        <small className="field-issue" id={`${id}-issue`}>
          <TriangleAlert size={12} aria-hidden="true" /> {issue}
        </small>
      ) : null}
    </div>
  );
}

const onlinePlatformSuggestions = ["Xing", "Stack Overflow", "Behance", "GitLab", "Dribbble"];

/**
 * The main editor of "Persönliche Daten" (Profil → 2.). It edits the profile fields themselves and nothing
 * else: no second copy of the data lives in the Lebenslauf panel. Pflichtangaben missing in an older profile
 * are marked, never blocked; only what the profile schema cannot store (names, an invalid address) stops a save.
 */
export function PersonalDataEditor({
  profile,
  onChange,
  showIssues,
}: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
  /** Mark every missing Pflichtangabe now (an existing profile, or after a save attempt). */
  showIssues: boolean;
}) {
  const listId = useId();
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const issues = getPersonalDataIssues(profile);
  const touch = (field: string) => () =>
    setTouched((current) => new Set(current).add(field));
  const set = <K extends keyof ApplicantProfile>(key: K) =>
    (value: ApplicantProfile[K]) =>
      onChange((current) => ({ ...current, [key]: value }));
  const issueText = (field: PersonalRequiredField) => {
    if (!showIssues && !touched.has(field)) return undefined;
    const issue = issues[field];
    return issue === "missing"
      ? personalFieldMissingMessage
      : issue === "invalid"
        ? invalidEmailMessage
        : undefined;
  };
  const complete = personalRequiredFields.filter(
    (field) => !issues[field],
  ).length;
  const familyStatus = profile.familyStatus.trim();
  const knownFamilyStatus = (familyStatusOptions as readonly string[]).includes(
    familyStatus,
  );

  return (
    <div className="personal-data-editor">
      <section className="personal-group" aria-labelledby={`${listId}-required`}>
        <header>
          <h4 id={`${listId}-required`}>Pflichtangaben</h4>
          <span className="profile-required-badge">Pflicht</span>
          <small
            className={`personal-completeness${complete === personalRequiredFields.length ? " is-complete" : ""}`}
            aria-live="polite">
            {complete} von {personalRequiredFields.length} vollständig
          </small>
        </header>
        <div className="form-grid">
          <PersonalField
            field="firstName"
            label="Vorname"
            required
            value={profile.firstName}
            autoComplete="given-name"
            issue={issueText("firstName")}
            onChange={set("firstName")}
            onBlur={touch("firstName")}
          />
          <PersonalField
            field="lastName"
            label="Nachname"
            required
            value={profile.lastName}
            autoComplete="family-name"
            issue={issueText("lastName")}
            onChange={set("lastName")}
            onBlur={touch("lastName")}
          />
          <PersonalField
            field="street"
            label="Straße und Hausnummer"
            required
            full
            value={profile.street}
            autoComplete="street-address"
            placeholder="Musterstraße 10"
            issue={issueText("street")}
            onChange={set("street")}
            onBlur={touch("street")}
          />
          <div className="split-fields full">
            <PersonalField
              field="postalCode"
              label="PLZ"
              required
              value={profile.postalCode}
              autoComplete="postal-code"
              inputMode="numeric"
              issue={issueText("postalCode")}
              onChange={set("postalCode")}
              onBlur={touch("postalCode")}
            />
            <PersonalField
              field="city"
              label="Ort"
              required
              value={profile.city}
              autoComplete="address-level2"
              issue={issueText("city")}
              onChange={set("city")}
              onBlur={touch("city")}
            />
          </div>
          <PersonalField
            field="phone"
            label="Telefonnummer"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={profile.phone}
            hint="Für internationale Bewerbungen mit Ländervorwahl, z. B. +49 170 1234567."
            issue={issueText("phone")}
            onChange={set("phone")}
            onBlur={touch("phone")}
          />
          <PersonalField
            field="email"
            label="E-Mail-Adresse"
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            value={profile.email}
            issue={issueText("email")}
            onChange={set("email")}
            onBlur={touch("email")}
          />
        </div>
      </section>

      <section className="personal-group" aria-labelledby={`${listId}-online`}>
        <header>
          <h4 id={`${listId}-online`}>Berufliche Online-Profile</h4>
          <span className="profile-optional-badge">Optional</span>
        </header>
        <div className="form-grid">
          <PersonalField
            field="linkedin"
            label="LinkedIn"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="linkedin.com/in/ihr-name"
            value={profile.linkedin}
            onChange={set("linkedin")}
          />
          <PersonalField
            field="github"
            label="GitHub"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="github.com/ihr-name"
            value={profile.github}
            onChange={set("github")}
          />
          <PersonalField
            field="portfolio"
            label="Website / Portfolio"
            type="url"
            inputMode="url"
            autoComplete="url"
            full
            placeholder="ihre-website.de"
            value={profile.portfolio}
            hint="Links ohne „https://“ werden im Lebenslauf automatisch vervollständigt."
            onChange={set("portfolio")}
          />
        </div>
        <div className="profile-subsection-header">
          <div>
            <strong>Weitere Online-Profile</strong>
            <small>
              Zum Beispiel Xing, Stack Overflow, Behance oder GitLab.
            </small>
          </div>
          <button
            type="button"
            className="button secondary small-button"
            onClick={() =>
              onChange((current) => ({
                ...current,
                onlineProfiles: [
                  ...current.onlineProfiles,
                  { id: crypto.randomUUID(), label: "", url: "" },
                ],
              }))
            }>
            <Plus size={15} /> Online-Profil hinzufügen
          </button>
        </div>
        <datalist id={`${listId}-platforms`}>
          {onlinePlatformSuggestions.map((platform) => (
            <option key={platform} value={platform} />
          ))}
        </datalist>
        <div className="compact-entry-list">
          {profile.onlineProfiles.map((entry, index) => (
            <div className="compact-entry" key={entry.id}>
              <div className="field">
                <label htmlFor={`${listId}-label-${index}`}>Bezeichnung</label>
                <input
                  id={`${listId}-label-${index}`}
                  list={`${listId}-platforms`}
                  value={entry.label}
                  placeholder="z. B. Xing"
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      onlineProfiles: current.onlineProfiles.map((item) =>
                        item.id === entry.id
                          ? { ...item, label: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={`${listId}-url-${index}`}>Adresse / URL</label>
                <input
                  id={`${listId}-url-${index}`}
                  type="url"
                  inputMode="url"
                  value={entry.url}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      onlineProfiles: current.onlineProfiles.map((item) =>
                        item.id === entry.id
                          ? { ...item, url: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
              </div>
              <button
                type="button"
                className="icon-button danger"
                aria-label="Online-Profil löschen"
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    onlineProfiles: current.onlineProfiles.filter(
                      (item) => item.id !== entry.id,
                    ),
                  }))
                }>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="personal-group" aria-labelledby={`${listId}-optional`}>
        <header>
          <h4 id={`${listId}-optional`}>Freiwillige Angaben</h4>
          <span className="profile-optional-badge">Optional</span>
        </header>
        <p className="field-hint">
          Alle Angaben sind freiwillig. Ob eine Angabe im Lebenslauf erscheint,
          legen Sie in der Lebenslauf-Ansicht unter „Persönliche Daten“ fest.
        </p>
        <div className="form-grid">
          <PersonalField
            field="country"
            label="Land"
            full
            value={profile.country}
            autoComplete="country-name"
            onChange={set("country")}
          />
          <PersonalField
            field="title"
            label="Berufsbezeichnung"
            full
            placeholder="Ihre Berufsbezeichnung"
            value={profile.title}
            hint="Erscheint im Lebenslauf unter Ihrem Namen."
            onChange={set("title")}
          />
          <FlexibleDateField
            id={personalFieldId("birthDate")}
            label="Geburtsdatum"
            mode="date"
            value={profile.birthDate}
            onChange={set("birthDate")}
          />
          <PersonalField
            field="birthPlace"
            label="Geburtsort"
            value={profile.birthPlace}
            onChange={set("birthPlace")}
          />
          <PersonalField
            field="nationality"
            label="Staatsangehörigkeit"
            full
            placeholder="z. B. deutsch"
            value={profile.nationality}
            onChange={set("nationality")}
          />
          <div className="field">
            <label htmlFor={personalFieldId("familyStatus")}>Familienstand</label>
            <select
              id={personalFieldId("familyStatus")}
              value={familyStatus}
              onChange={(event) => set("familyStatus")(event.target.value)}>
              <option value="">Keine Angabe</option>
              {familyStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              {familyStatus && !knownFamilyStatus ? (
                <option value={familyStatus}>{familyStatus}</option>
              ) : null}
            </select>
          </div>
          <PersonalField
            field="children"
            label="Kinder"
            placeholder="z. B. 2"
            value={profile.children}
            onChange={set("children")}
          />
        </div>
      </section>
    </div>
  );
}
