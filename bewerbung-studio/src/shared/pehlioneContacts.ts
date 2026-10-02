import { renderContactIcon } from "./contactIcons";
import type { ApplicantProfile } from "./schema";
import {
  externalUrl,
  formatPhoneForDisplay,
  formatUrlForDisplay,
  phoneHref,
} from "./contactPresentation";
import {
  formatResumeAddress,
  formatResumeBirth,
  getResumePersonalDetails,
} from "./resumePersonalData";
import { defaultResumePersonalFieldVisibility } from "../features/resume-sections/resume-section-system";

const icon = (_kind: "person") =>
  '<svg data-contact-icon="person" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export const getPehlioneContacts = (profile?: ApplicantProfile) => {
  const visible = {
    ...defaultResumePersonalFieldVisibility,
    ...profile?.resumePersonalFieldVisibility,
  };
  return [
    {
      key: "location" as const,
      label: "Ort",
      visible: visible.address,
      value: formatResumeAddress(profile),
      href: "",
    },
    {
      key: "phone" as const,
      label: "Telefon",
      visible: visible.phone,
      value: formatPhoneForDisplay(profile?.phone),
      href: phoneHref(profile?.phone),
    },
    {
      key: "email" as const,
      label: "E-Mail",
      visible: visible.email,
      value: profile?.email || "",
      href: profile?.email ? `mailto:${profile.email}` : "",
    },
    {
      key: "linkedin" as const,
      label: "LinkedIn",
      visible: visible.linkedin,
      value: formatUrlForDisplay(profile?.linkedin || ""),
      href: externalUrl(profile?.linkedin || ""),
    },
    {
      key: "github" as const,
      label: "GitHub",
      visible: visible.github,
      value: formatUrlForDisplay(profile?.github || ""),
      href: externalUrl(profile?.github || ""),
    },
    {
      key: "website" as const,
      label: "Website",
      visible: visible.website,
      value: formatUrlForDisplay(profile?.portfolio || ""),
      href: externalUrl(profile?.portfolio || ""),
    },
    {
      key: "birth" as const,
      label: "Geboren",
      visible: visible.birthDate || visible.birthPlace,
      value: formatResumeBirth(profile),
      href: "",
    },
    ...getResumePersonalDetails(profile).map((detail) => ({
      key: detail.kind,
      label: detail.label,
      visible: detail.kind === "onlineProfile"
        ? /xing/i.test(detail.label) ? visible.xing : visible.onlineProfiles
        : visible[detail.kind],
      value: detail.value,
      href: detail.href,
    })),
  ].filter((item) => item.visible && item.value);
};

export const renderPehlioneContacts = (profile?: ApplicantProfile) => {
  const contacts = getPehlioneContacts(profile);
  if (!contacts.length) return "";
  return `<section class="pehlione-contacts"><h3>${icon("person")}<span>Kontakt</span></h3><ul>${contacts.map((item) => `<li data-contact-kind="${item.key}">${renderContactIcon({ kind: item.key })}<div><strong>${item.label}</strong>${item.href ? `<a href="${escape(item.href)}">${escape(item.value)}</a>` : `<span>${escape(item.value)}</span>`}</div></li>`).join("")}</ul></section>`;
};

// One set of rules keeps the contact block identical in preview and PDF.
export const pehlioneContactsCss = `
.pehlione-contacts.pehlione-contacts{--contact-heading:var(--pehlione-sidebar-text,#fff);--contact-text:var(--pehlione-sidebar-text,#fff);margin:0 0 4.5mm;color:var(--contact-text);font-family:var(--doc-font,var(--body-font,"Source Sans 3",Arial,sans-serif));font-size:7.8pt;line-height:1.2;break-inside:avoid}
.pehlione-resume--white .pehlione-contacts,.pehlione-pdf-white .pehlione-contacts{--contact-heading:var(--pehlione-primary,#08245c);--contact-text:#142235}
.pehlione-contacts.pehlione-contacts h3{display:grid;grid-template-columns:8mm minmax(0,1fr);gap:2mm;align-items:center;margin:0 0 2mm;padding:0 0 1.5mm;border-bottom:.3mm solid var(--contact-heading);color:var(--contact-heading);font-family:inherit;font-size:9.7pt;font-weight:700;line-height:1.1;text-transform:uppercase}
.pehlione-contacts.pehlione-contacts svg{display:block;width:4.2mm;height:4.2mm;fill:none;stroke:var(--contact-heading);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pehlione-contacts.pehlione-contacts h3 svg{width:8mm;height:8mm}
.pehlione-contacts.pehlione-contacts ul{display:grid;gap:1.35mm;margin:0;padding:0;list-style:none;font-size:7.8pt;line-height:1.2}
.pehlione-contacts.pehlione-contacts li{display:grid;grid-template-columns:5mm minmax(0,1fr);gap:1.5mm;align-items:start;margin:0;padding:0;break-inside:avoid}
.pehlione-contacts.pehlione-contacts li>div{display:grid;gap:.25mm;min-width:0}
.pehlione-contacts.pehlione-contacts strong{display:block;color:var(--contact-heading);font-size:7.8pt;font-weight:700;line-height:1.2}
.pehlione-contacts.pehlione-contacts a,.pehlione-contacts.pehlione-contacts li span{color:var(--contact-text);font-size:7.4pt;line-height:1.2;text-decoration:none;overflow-wrap:anywhere}
`;
