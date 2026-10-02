import { ContactIcon } from "../ContactIcon";
import { toTemplateExternalHref } from "../resume-template-data";
import type { GepflegtHeaderProps } from "./gepflegt.types";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { formatResumeAddress, formatResumeBirth, getResumePersonalDetails, getResumeLinkContacts } from "../../../../shared/resumePersonalData";
import { formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";

export function GepflegtHeader({
  name,
  profile,
  atsMode,
  compact = false,
}: GepflegtHeaderProps) {
  const location = formatResumeAddress(profile);
  const birth = formatResumeBirth(profile);
  const extras = [
    ...(birth ? [{ kind: "birth", text: birth, href: "" }] : []),
    ...getResumePersonalDetails(profile).map((detail) => ({ kind: detail.kind, text: detail.text, href: detail.href })),
  ];
  const links = getResumeLinkContacts(profile);

  return (
    <header
      className={`gepflegt-header ${compact ? "gepflegt-header--compact" : ""}`}
      data-element-id="gepflegt.header"
    >
      {compact ? (
        <p className="gepflegt-header__kicker">{resolveResumeHeading(profile).continuationKicker}</p>
      ) : null}
      <h1 className="gepflegt-header__name">{name}</h1>
      {profile?.title ? (
        <p className="gepflegt-header__title">{profile.title}</p>
      ) : null}

      {!compact &&
      (profile?.phone ||
        profile?.email ||
        links.length ||
        location ||
        extras.length) ? (
        <address className="gepflegt-header__contacts">
          {profile?.phone ? (
            <a href={phoneHref(profile.phone)}>
              {!atsMode ? <ContactIcon kind="phone" /> : null}
              <span>{formatPhoneForDisplay(profile.phone)}</span>
            </a>
          ) : null}
          {profile?.email ? (
            <a href={`mailto:${profile.email}`}>
              {!atsMode ? <ContactIcon kind="email" /> : null}
              <span>{profile.email}</span>
            </a>
          ) : null}
          {links.map((link) => (
            <a href={link.href} key={link.kind}>
              {!atsMode ? <ContactIcon href={link.href} /> : null}
              <span>{link.value}</span>
            </a>
          ))}
          {location ? (
            <span>
              {!atsMode ? <ContactIcon kind="location" /> : null}
              <span>{location}</span>
            </span>
          ) : null}
          {extras.map((item, index) => {
            const content = (
              <>
                {!atsMode ? <ContactIcon kind={item.kind} href={item.href} /> : null}
                <span>{item.text}</span>
              </>
            );
            return item.href
              ? <a href={item.href} key={`${item.kind}-${index}`}>{content}</a>
              : <span key={`${item.kind}-${index}`}>{content}</span>;
          })}
        </address>
      ) : null}
    </header>
  );
}
