import { ContactIcon } from "../ContactIcon";
import { toZweispaltigExternalHref } from "./zweispaltig.model";
import type { ZweispaltigHeaderProps } from "./zweispaltig.types";

type ZweispaltigContact = {
  kind:
    | "phone"
    | "email"
    | "linkedin"
    | "location"
    | "birth"
    | "github"
    | "portfolio";
  label: string;
  value: string | undefined;
  href: string;
};

export function ZweispaltigHeader({
  profile,
  name,
  photoSource,
  compact = false,
  atsMode = false,
}: ZweispaltigHeaderProps) {
  const location = [profile?.postalCode, profile?.city, profile?.country]
    .filter(Boolean)
    .join(" ");
  const birth = [profile?.birthDate, profile?.birthPlace]
    .filter(Boolean)
    .join(", ");
  const contacts: ZweispaltigContact[] = [
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
        ? toZweispaltigExternalHref(profile.linkedin)
        : "",
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
    {
      kind: "github",
      label: "GitHub",
      value: profile?.github,
      href: profile?.github
        ? toZweispaltigExternalHref(profile.github)
        : "",
    },
    {
      kind: "portfolio",
      label: "Portfolio",
      value: profile?.portfolio,
      href: profile?.portfolio
        ? toZweispaltigExternalHref(profile.portfolio)
        : "",
    },
  ].filter((contact) => contact.value?.trim()) as ZweispaltigContact[];

  return (
    <header
      className={`zweispaltig-header ${compact ? "zweispaltig-header--compact" : ""}`}
      data-element-id="zweispaltig.header"
    >
      <div className="zweispaltig-header__identity">
        {compact ? (
          <p className="zweispaltig-header__kicker">
            Lebenslauf · Fortsetzung
          </p>
        ) : null}
        <h1>{name}</h1>
        {profile?.title ? (
          <h2>
            <span>{profile.title}</span>
          </h2>
        ) : null}

        {!compact && contacts.length ? (
          <address className="zweispaltig-header__contacts">
            {contacts.map((contact) => {
              const content = atsMode ? (
                <>
                  <strong>{contact.label}</strong>
                  <span>{contact.value}</span>
                </>
              ) : (
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
          className="zweispaltig-header__photo"
          data-element-id="zweispaltig.photo"
        >
          <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
        </figure>
      ) : null}
    </header>
  );
}
