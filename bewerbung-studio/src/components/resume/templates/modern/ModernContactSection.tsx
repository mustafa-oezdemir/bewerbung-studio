/**
 * ModernContactSection component
 * Renders contact details with icons: phone, email, location, LinkedIn, website
 */

import { ContactIcon } from "../ContactIcon";
import type { ModernContactSectionProps } from "./modern.types";

/** The links the PDF draws for the same details. */
const contactHref = (key: string, value: string) => {
  const trimmed = value.trim();
  if (key === "phone") return `tel:${trimmed.replace(/[^\d+]/g, "")}`;
  if (key === "email") return `mailto:${trimmed}`;
  if (!["linkedin", "website", "github"].includes(key)) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^[a-z][a-z\d+.-]*:(?:\/\/)?/i, "")}`;
};

export function ModernContactSection({
  profile,
  accentColor,
  atsMode,
  inline = false,
}: ModernContactSectionProps) {
  const contactItems: Array<{
    key: string;
    icon: string;
    label: string;
    value?: string;
  }> = [];

  if (profile?.phone) {
    contactItems.push({
      key: "phone",
      icon: "phone",
      label: "Telefon",
      value: profile.phone,
    });
  }
  if (profile?.email) {
    contactItems.push({
      key: "email",
      icon: "email",
      label: "E-Mail",
      value: profile.email,
    });
  }
  if (profile?.linkedin) {
    contactItems.push({
      key: "linkedin",
      icon: "linkedin",
      label: "LinkedIn",
      value: profile.linkedin,
    });
  }
  if (profile?.portfolio) {
    contactItems.push({
      key: "website",
      icon: "website",
      label: "Website",
      value: profile.portfolio,
    });
  }
  if (profile?.github) {
    contactItems.push({
      key: "github",
      icon: "github",
      label: "GitHub",
      value: profile.github,
    });
  }
  const location = [profile?.city, profile?.country]
    .filter(Boolean)
    .join(", ");
  if (location) {
    contactItems.push({
      key: "location",
      icon: "location",
      label: "Wohnort",
      value: location,
    });
  }
  const birth =
    profile?.birthDate || profile?.birthPlace
      ? `Geb. ${profile?.birthDate || ""}${profile?.birthPlace ? ` in ${profile.birthPlace}` : ""}`.trim()
      : "";
  if (birth) {
    contactItems.push({
      key: "birth",
      icon: "birth",
      label: "Geburtsdaten",
      value: birth,
    });
  }

  if (contactItems.length === 0) {
    return null;
  }

  // The PDF draws the same four details under the name; the website stands in the footer.
  const href = (item: { key: string; value?: string }) => contactHref(item.key, item.value ?? "");
  const visibleItems = inline
    ? contactItems
        .filter((item) => ["phone", "email", "linkedin", "location"].includes(item.key))
        .slice(0, 4)
    : contactItems;

  return (
    <section
      className={`modern-section ${inline ? "modern-contact-section--inline" : ""}`}
    >
      {!inline ? (
        <h2 className="modern-section__title">
          {atsMode ? "Persönliche Daten" : "Kontaktdaten"}
        </h2>
      ) : null}
      <ul className="modern-contact-list">
        {visibleItems.map((item) => (
          <li
            key={item.key}
            className="modern-contact-item"
            data-contact-kind={item.key}
          >
            {!atsMode ? (
              <div
                className="modern-contact-item__icon"
                style={{ color: accentColor }}
              >
                <ContactIcon kind={item.key} />
              </div>
            ) : null}
            <span className="modern-contact-item__value">
              {href(item) ? <a href={href(item)}>{item.value}</a> : item.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
