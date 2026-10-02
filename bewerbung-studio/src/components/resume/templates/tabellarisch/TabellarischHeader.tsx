import { ContactIcon } from "../ContactIcon";
import { toExternalHref } from "./tabellarisch.model";
import type { TabellarischHeaderProps } from "./tabellarisch.types";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";

type HeaderContact = {
  kind: "phone" | "email" | "linkedin" | "github" | "website" | "location" | "birth" | "nationality" | "familyStatus" | "children";
  label: string;
  value: string;
  href: string;
};

export function TabellarischHeader({
  name,
  profile,
  photoSource,
  atsMode,
}: TabellarischHeaderProps) {
  const location = formatResumeAddress(profile);
  const birth = formatResumeBirth(profile);
  const contacts: HeaderContact[] = [
    {
      kind: "phone",
      label: "Telefon",
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      kind: "email",
      label: "E-Mail",
      value: profile?.email || "",
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
    {
      kind: "linkedin",
      label: "LinkedIn",
      value: profile?.linkedin || "",
      href: profile?.linkedin ? toExternalHref(profile.linkedin) : "",
    },
    {
      kind: "location",
      label: "Wohnort",
      value: location,
      href: "",
    },
    {
      kind: "github",
      label: "GitHub",
      value: profile?.github || "",
      href: profile?.github ? toExternalHref(profile.github) : "",
    },
    {
      kind: "website",
      label: "Portfolio",
      value: profile?.portfolio || "",
      href: profile?.portfolio ? toExternalHref(profile.portfolio) : "",
    },
    {
      kind: "birth",
      label: "Geboren",
      value: birth,
      href: "",
    },
    // The plain layout prints the label in front; the visual one shows the detail with its label.
    ...getResumePersonalDetails(profile).map((detail) => ({ kind: detail.kind, label: detail.label, value: atsMode || detail.href ? detail.value : detail.text, href: detail.href })),
  ].filter((contact) => contact.value.trim()) as HeaderContact[];

  return (
    <header
      className={`tabellarisch-header ${!photoSource || atsMode ? "tabellarisch-header--without-photo" : ""}`}
      data-element-id="tabellarisch.header"
    >
      <div className="tabellarisch-header__identity">
        <h1 className="tabellarisch-header__name">{name}</h1>
        {profile?.title ? (
          <p className="tabellarisch-header__title">{profile.title}</p>
        ) : null}
        {contacts.length ? (
          <address className="tabellarisch-header__contacts">
            {contacts.map((contact) => {
              const content = (
                <>
                  {!atsMode ? <ContactIcon {...contact} /> : null}
                  {atsMode ? <strong>{contact.label}:</strong> : null}
                  <span>{contact.value}</span>
                </>
              );
              return contact.href ? (
                <a
                  aria-label={`${contact.label}: ${contact.value}`}
                  data-contact-kind={contact.kind}
                  href={contact.href}
                  key={contact.label}
                >
                  {content}
                </a>
              ) : (
                <span
                  aria-label={`${contact.label}: ${contact.value}`}
                  data-contact-kind={contact.kind}
                  key={contact.label}
                >
                  {content}
                </span>
              );
            })}
          </address>
        ) : null}
      </div>

      {photoSource && !atsMode ? (
        <figure className="tabellarisch-header__photo">
          <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
        </figure>
      ) : null}
    </header>
  );
}
