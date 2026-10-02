import { ContactIcon } from "../ContactIcon";
import {
  toIvyLeagueExternalHref,
  uniqueIvyLeagueValues,
} from "./ivy-league.model";
import type { ApplicantProfile } from "../../../../shared/schema";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails, getResumeLinkContacts } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";

export function IvyLeagueHeader({
  profile,
  name,
  compact = false,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  name: string;
  compact?: boolean;
  atsMode?: boolean;
}) {
  const location = formatResumeAddress(profile);
  const birth = formatResumeBirth(profile, { prefix: true });
  const specializations = uniqueIvyLeagueValues(profile?.skills ?? [])
    .slice(0, 3)
    .map((value) => value.split(/\s+(?:–|—|:)\s+/)[0])
    .join(" | ");
  const profession = [profile?.title, specializations]
    .filter(Boolean)
    .join(" | ");
  const contacts = [
    {
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      value: profile?.email,
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
    ...getResumeLinkContacts(profile).map((link) => ({ value: link.value, href: link.href })),
    { value: location, href: "" },
    { value: birth, href: "" },
    ...getResumePersonalDetails(profile).map((detail) => ({ kind: detail.kind, value: detail.text, href: detail.href })),
  ].filter((contact) => contact.value?.trim());

  return (
    <header
      className={`ivy-league-header ${compact ? "ivy-league-header--compact" : ""} ${atsMode ? "ivy-league-header--ats" : ""}`}
      data-element-id="ivy-league.header"
    >
      {compact ? <p>{resolveResumeHeading(profile).continuationKicker}</p> : null}
      <h1>{name}</h1>
      {profession ? <h2>{profession}</h2> : null}
      {!compact && contacts.length ? (
        <address className="ivy-league-header__contacts">
          {contacts.map((contact, index) => (
            <span
              className="ivy-league-header__contact"
              key={`${contact.value}-${index}`}
            >
              {!atsMode ? <ContactIcon {...contact} /> : null}
              {contact.href ? (
                <a href={contact.href}>{contact.value}</a>
              ) : (
                <span>{contact.value}</span>
              )}
            </span>
          ))}
        </address>
      ) : null}
    </header>
  );
}
