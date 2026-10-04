import { formatResumeAddress, formatResumeBirth, getResumeLinkContacts, getResumePersonalDetails } from "../../../../shared/resumePersonalData";
import { externalUrl, formatPhoneForDisplay, phoneHref } from "../../../../shared/contactPresentation";
import { getResumeSemanticTitle } from "../../../../features/resume-sections/resume-section-system";
/**
 * ModernContactSection component
 * Renders contact details with icons: phone, email, location, LinkedIn, website
 */

import { ContactIcon } from "../ContactIcon";
import type { ModernContactSectionProps } from "./modern.types";

const voluntaryContactKinds = ["birth", "nationality", "familyStatus", "children", "onlineProfile", "github", "website"];

/** The links the PDF draws for the same details. */
const contactHref = (key: string, value: string) => {
  const trimmed = value.trim();
  if (key === "phone") return phoneHref(trimmed);
  if (key === "email") return `mailto:${trimmed}`;
  if (!["linkedin", "website", "github"].includes(key)) return "";
  return externalUrl(trimmed);
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
    href?: string;
  }> = [];

  if (profile?.phone) {
    contactItems.push({
      key: "phone",
      icon: "phone",
      label: "Telefon",
      value: formatPhoneForDisplay(profile.phone),
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
  // LinkedIn, GitHub and the website in the order the PDF draws them.
  for (const link of getResumeLinkContacts(profile)) {
    contactItems.push({ key: link.kind, icon: link.kind, label: link.label, value: link.value, href: link.href });
  }
  const location = formatResumeAddress(profile);
  if (location) {
    contactItems.push({
      key: "location",
      icon: "location",
      label: "Wohnort",
      value: location,
    });
  }
  const birth = formatResumeBirth(profile, { prefix: true });
  if (birth) {
    contactItems.push({
      key: "birth",
      icon: "birth",
      label: "Geburtsdaten",
      value: birth,
    });
  }
  for (const detail of getResumePersonalDetails(profile)) {
    contactItems.push({
      key: detail.kind,
      icon: detail.kind,
      label: detail.label,
      value: detail.text,
      href: detail.href,
    });
  }

  if (contactItems.length === 0) {
    return null;
  }

  // The PDF draws the same four details under the name; the website stands in the footer.
  const href = (item: { key: string; value?: string; href?: string }) => item.href || contactHref(item.key, item.value ?? "");
  // The header line keeps its four core details; a voluntary detail the user switched on follows them.
  const visibleItems = inline
    ? [
        ...contactItems
          .filter((item) => ["phone", "email", "linkedin", "location"].includes(item.key))
          .slice(0, 4),
        ...contactItems.filter((item) => voluntaryContactKinds.includes(item.key)),
      ]
    : contactItems;

  return (
    <section
      className={`modern-section ${inline ? "modern-contact-section--inline" : ""}`}
    >
      {!inline ? (
        <h2 className="modern-section__title">
          {atsMode ? getResumeSemanticTitle(profile?.resumeSemanticSections, "personalData") : "Kontaktdaten"}
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
