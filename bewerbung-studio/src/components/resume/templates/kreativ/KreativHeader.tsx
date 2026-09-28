import { ContactIcon } from "../ContactIcon";
import { toKreativExternalHref } from "./kreativ.model";
import type { KreativHeaderProps } from "./kreativ.types";

type KreativContact = {
  kind: "phone" | "email" | "linkedin" | "github" | "website" | "location" | "birth";
  label: string;
  value: string | undefined;
  href: string;
};

export function KreativHeader({
  profile,
  name,
  photoSource,
  compact = false,
  atsMode = false,
}: KreativHeaderProps) {
  const location = [profile?.postalCode, profile?.city, profile?.country]
    .filter(Boolean)
    .join(" ");
  const birth = [profile?.birthDate, profile?.birthPlace]
    .filter(Boolean)
    .join(", ");
  const contacts: KreativContact[] = [
    {
      kind: "phone",
      label: "Telefon",
      value: profile?.phone,
      href: profile?.phone
        ? `tel:${profile.phone.replace(/[^\d+]/g, "")}`
        : "",
    },
    {
      kind: "email",
      label: "E-Mail",
      value: profile?.email,
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
    {
      kind: "linkedin",
      label: "LinkedIn",
      value: profile?.linkedin,
      href: profile?.linkedin
        ? toKreativExternalHref(profile.linkedin)
        : "",
    },
    {
      kind: "github",
      label: "GitHub",
      value: profile?.github,
      href: profile?.github ? toKreativExternalHref(profile.github) : "",
    },
    {
      kind: "website",
      label: "Website",
      value: profile?.portfolio,
      href: profile?.portfolio ? toKreativExternalHref(profile.portfolio) : "",
    },
    {
      kind: "location",
      label: "Wohnort",
      value: location,
      href: "",
    },
    {
      kind: "birth",
      label: "Geboren",
      value: birth,
      href: "",
    },
  ].filter((contact) => contact.value?.trim()) as KreativContact[];

  return (
    <header
      className={`kreativ-header ${compact ? "kreativ-header--compact" : ""} ${!photoSource || atsMode ? "kreativ-header--no-photo" : ""}`}
      data-element-id="kreativ.header"
    >
      <div className="kreativ-header__identity">
        {compact ? (
          <p className="kreativ-header__kicker">
            Lebenslauf · Fortsetzung
          </p>
        ) : null}
        <h1>{name}</h1>
        {profile?.title ? <h2>{profile.title}</h2> : null}
        {!compact && contacts.length ? (
          <address className="kreativ-header__contacts">
            {contacts.map((contact) => {
              const content = (
                <>
                  <ContactIcon {...contact} />
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
      {!compact && !atsMode && photoSource ? (
        <figure
          className="kreativ-header__photo"
          data-element-id="kreativ.photo"
        >
          <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
        </figure>
      ) : null}
    </header>
  );
}
