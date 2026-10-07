import { ContactIcon } from "../ContactIcon";
import { toElegantExternalHref } from "./elegant.model";
import type { ElegantHeaderProps } from "./elegant.types";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails, getResumeLinkContacts } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";
import { isElegantWideContact } from "../../../../shared/elegantDesign";

export function ElegantHeader({
  profile,
  name,
  compact = false,
}: ElegantHeaderProps) {
  const location = formatResumeAddress(profile, { postalCode: true });
  const birth = formatResumeBirth(profile);
  const contacts = [
    {
      icon: "☎",
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      icon: "@",
      value: profile?.email || "",
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
...getResumeLinkContacts(profile).map((link) => ({ kind: link.kind, icon: link.kind === "website" ? "⌖" : "↗", value: link.value, href: link.href })),
    { icon: "◆", value: location, href: "" },
    { icon: "☆", value: birth, href: "" },
    ...getResumePersonalDetails(profile).map((detail) => ({ icon: "☆", kind: detail.kind, value: detail.text, href: detail.href })),
  ].filter((contact) => contact.value.trim());

  return (
    <header
      className={`elegant-header ${compact ? "elegant-header--compact" : ""}`}
      data-element-id="elegant.header"
    >
      {compact ? (
        <p className="elegant-header__kicker">
          {resolveResumeHeading(profile).continuationKicker}
        </p>
      ) : null}
      <h1 className="elegant-header__name">{name}</h1>
      {profile?.title ? (
        <p className="elegant-header__title">{profile.title}</p>
      ) : null}

      {!compact && contacts.length ? (
        <address className="elegant-header__contacts">
          {contacts.map((contact, index) => {
            const content = (
              <>
                <i aria-hidden="true"><ContactIcon {...contact} /></i>
                <span>{contact.value}</span>
              </>
            );
            return contact.href ? (
              <a href={contact.href} key={`${contact.value}-${index}`} className={isElegantWideContact(contact.value) ? "elegant-header__contact--wide" : undefined}>
                {content}
              </a>
            ) : (
              <span key={`${contact.value}-${index}`} className={isElegantWideContact(contact.value) ? "elegant-header__contact--wide" : undefined}>{content}</span>
            );
          })}
        </address>
      ) : null}
    </header>
  );
}
