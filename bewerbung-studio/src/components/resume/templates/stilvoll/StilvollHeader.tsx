import { ContactIcon } from "../ContactIcon";
import type { ApplicantProfile } from "../../../../shared/schema";
import { toTemplateExternalHref } from "../resume-template-data";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails, getResumeLinkContacts } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";

export function StilvollHeader({
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
  const profession = profile?.title.trim() || "";
  const contacts = [
    {
      icon: "☎",
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      icon: "@",
      value: profile?.email,
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
...getResumeLinkContacts(profile).map((link) => ({ kind: link.kind, icon: link.kind === "website" ? "⌖" : "↗", value: link.value, href: link.href })),
    { icon: "⌖", value: location, href: "" },
    { icon: "☆", value: birth, href: "" },
    ...getResumePersonalDetails(profile).map((detail) => ({ icon: "☆", kind: detail.kind, value: detail.text, href: detail.href })),
  ].filter((item) => item.value?.trim());
  return (
    <header
      className={`stilvoll-header ${compact ? "stilvoll-header--compact" : ""} ${!photoSource || atsMode ? "stilvoll-header--no-photo" : ""}`}
      data-element-id="stilvoll.header"
    >
      <div>
        {compact ? <p>{resolveResumeHeading(profile).continuationKicker}</p> : null}
        <h1>{name}</h1>
        {profession ? <h2>{profession}</h2> : null}
        {!compact && contacts.length ? (
          <address>
            {contacts.map((contact, index) => (
              <span key={`${contact.value}-${index}`}>
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
        <figure data-element-id="stilvoll.photo">
          <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
        </figure>
      ) : null}
    </header>
  );
}
