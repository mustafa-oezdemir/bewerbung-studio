import {
  toZeitgenoessischExternalHref,
} from "./zeitgenoessisch.model";
import type { ZeitgenoessischHeaderProps } from "./zeitgenoessisch.types";
import { ZeitgenoessischPhoto } from "./ZeitgenoessischPhoto";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails, getResumeLinkContacts } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";

export function ZeitgenoessischHeader({
  profile,
  name,
  photoSource,
  compact = false,
  atsMode = false,
}: ZeitgenoessischHeaderProps) {
  const location = formatResumeAddress(profile, { postalCode: true });
  const birth = formatResumeBirth(profile);
  const contacts = [
    {
      label: "Telefon",
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      label: "E-Mail",
      value: profile?.email,
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
    { label: "Wohnort", value: location, href: "" },
    ...getResumeLinkContacts(profile).map((link) => ({ label: link.label, value: link.value, href: link.href })),
    { label: "Geboren", value: birth, href: "" },
    ...getResumePersonalDetails(profile).map((detail) => ({ label: detail.label, value: detail.value, href: detail.href })),
  ].filter((contact) => contact.value?.trim());

  return (
    <header
      className={`zeitgenoessisch-header ${compact ? "zeitgenoessisch-header--compact" : ""} ${!photoSource || atsMode ? "zeitgenoessisch-header--no-photo" : ""}`}
      data-element-id="zeitgenoessisch.header"
    >
      {!compact && !atsMode ? (
        <ZeitgenoessischPhoto photoSource={photoSource} name={name} />
      ) : null}
      <div className="zeitgenoessisch-header__identity">
        {compact ? (
          <p className="zeitgenoessisch-header__kicker">
            {resolveResumeHeading(profile).continuationKicker}
          </p>
        ) : null}
        <h1>{name}</h1>
        {profile?.title ? <p>{profile.title}</p> : null}
        {atsMode && !compact && contacts.length ? (
          <address className="zeitgenoessisch-header__contacts">
            {contacts.map((contact) =>
              contact.href ? (
                <a href={contact.href} key={contact.label}>
                  <strong>{contact.label}:</strong> {contact.value}
                </a>
              ) : (
                <span key={contact.label}>
                  <strong>{contact.label}:</strong> {contact.value}
                </span>
              ),
            )}
          </address>
        ) : null}
      </div>
    </header>
  );
}
