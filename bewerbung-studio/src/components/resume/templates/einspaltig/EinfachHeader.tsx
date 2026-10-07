import { ContactIcon } from "../ContactIcon";
import type { ApplicantProfile } from "../../../../shared/schema";
import { toTemplateExternalHref } from "../resume-template-data";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails, getResumeLinkContacts } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";

export function EinfachHeader({
  profile,
  name,
  photoSource,
  compact = false,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  name: string;
  photoSource: string | null;
  compact?: boolean;
  atsMode?: boolean;
}) {
  const location = formatResumeAddress(profile);
  const birth = formatResumeBirth(profile, { prefix: true });
  const profession = profile?.title.trim() ?? "";
  const contacts = [
    {
      kind: "phone",
      icon: "☎",
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      kind: "email",
      icon: "@",
      value: profile?.email,
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
...getResumeLinkContacts(profile).map((link) => ({ kind: link.kind, icon: link.kind === "website" ? "⌖" : "↗", value: link.value, href: link.href })),
    { kind: "location", icon: "⌾", value: location, href: "" },
    { kind: "birth", icon: "☆", value: birth, href: "" },
    ...getResumePersonalDetails(profile).map((detail) => ({ kind: detail.kind, icon: "☆", value: detail.text, href: detail.href })),
  ].filter((item) => item.value?.trim());
  return (
    <header
      className={`einfach-header ${compact ? "einfach-header--compact" : ""} ${!photoSource || atsMode ? "einfach-header--no-photo" : ""}`}
      data-element-id="einspaltig.header"
    >
      <div>
        {compact ? <p>{resolveResumeHeading(profile).continuationKicker}</p> : null}
        <h1>{name}</h1>
        {profession ? <h2>{profession}</h2> : null}
        {!compact && !atsMode && contacts.length ? (
          <address>
            {contacts.map((contact, index) => (
              <span
                data-contact-kind={contact.kind}
                key={`${contact.value}-${index}`}
              >
                <i aria-hidden="true"><ContactIcon {...contact} /></i>
                {contact.href ? (
                  <a href={contact.href}>{contact.value}</a>
                ) : (
                  <span>{contact.value}</span>
                )}
              </span>
            ))}
          </address>
        ) : null}
      </div>
      {!compact && !atsMode && photoSource ? (
        <figure data-element-id="einspaltig.photo">
          <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
        </figure>
      ) : null}
    </header>
  );
}
