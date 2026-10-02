import { ContactIcon } from "../ContactIcon";
import type { ApplicantProfile } from "../../../../shared/schema";
import { toTemplateExternalHref } from "../resume-template-data";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails, getResumeLinkContacts } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";

export function KlassischHeader({
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
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      kind: "email",
      value: profile?.email,
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
    ...getResumeLinkContacts(profile).map((link) => ({ kind: link.kind, value: link.value, href: link.href })),
    { kind: "location", value: location, href: "" },
    { kind: "birth", value: birth, href: "" },
    ...getResumePersonalDetails(profile).map((detail) => ({ kind: detail.kind, value: detail.text, href: detail.href })),
  ].filter((item) => item.value?.trim());

  return (
    <header
      className={`klassisch-header ${compact ? "klassisch-header--compact" : ""} ${!photoSource || atsMode ? "klassisch-header--no-photo" : ""}`}
      data-element-id="klassisch.header"
    >
      <div className="klassisch-header__identity">
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
                <ContactIcon {...contact} />
                {contact.href ? (
                  <a href={contact.href}>{contact.value}</a>
                ) : (
                  contact.value
                )}
              </span>
            ))}
          </address>
        ) : null}
      </div>
      {!compact && !atsMode && photoSource ? (
        <figure data-element-id="klassisch.photo">
          <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
        </figure>
      ) : null}
    </header>
  );
}
